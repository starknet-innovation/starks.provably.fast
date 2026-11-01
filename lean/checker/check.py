#!/usr/bin/env python3
"""The Lean receipt for one submitted file (docs/LEAN_CHECK.md, first version).

    python3 check.py TARGET < Solution.lean  >  receipt JSON on the last line

Inside the checker image, with no network: the file is placed in the pinned package as
Solution.lean, its statement is compared with the target's template by text (the pinned
`theorem solution` line and every hole defined without sorry), `lake build Solution` compiles it,
`leanchecker Solution` (the toolchain's own checker) replays its declarations in the kernel, and `#print axioms solution`
lists what it rests on. The receipt says exactly which of those passed; it is not the comparator
the design describes, and the responder's reply says so.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

PKG = Path("/opt/lean/pkg")
PERMITTED = ["propext", "Quot.sound", "Classical.choice"]
BUILD_SECONDS = int(os.environ.get("LEAN_BUILD_SECONDS", "1800"))
CHECK_SECONDS = int(os.environ.get("LEAN_CHECK_SECONDS", "1800"))


def run(args: list[str], seconds: int) -> tuple[int | None, str]:
    try:
        done = subprocess.run(args, cwd=PKG, capture_output=True, text=True, timeout=seconds,
                              env={**os.environ, "LAKE_NO_UPDATE": "1"})
    except subprocess.TimeoutExpired:
        return None, "timed out"
    return done.returncode, (done.stdout or "") + (done.stderr or "")


def statement_check(target: str, source: str) -> tuple[bool, str, list[str]]:
    index = json.loads((PKG / "challenges" / "index.json").read_text())
    spec = index["targets"].get(target)
    if not spec:
        return False, f"unknown target {target}", []
    template = (PKG / "challenges" / spec["template"]).read_text()
    norm = lambda s: re.sub(r"\s+", " ", s).strip()  # noqa: E731
    theorem = next((line for line in template.splitlines() if line.startswith("theorem solution")), "")
    theorem_head = norm(theorem.split(":=")[0])
    solution_lines = [norm(line.split(":=")[0]) for line in source.splitlines() if line.startswith("theorem solution")]
    if theorem_head not in solution_lines:
        return False, f"the statement differs from the template: expected `{theorem_head} := ...`", []
    if not re.search(r"^\s*import\s+MCAChallenge\s*$", source, re.M):
        return False, "the file must import MCAChallenge", []
    holes = []
    for hole in spec["holes"]:
        pattern = re.compile(r"^\s*(noncomputable\s+)?def\s+" + re.escape(hole) + r"\s*:\s*(.+?)\s*:=\s*(.+)$", re.M)
        found = pattern.search(source)
        if not found:
            return False, f"the hole `{hole}` is not defined", []
        if found.group(3).strip() == "sorry":
            return False, f"the hole `{hole}` is still sorry", []
        holes.append(f"{hole} : {found.group(2).strip()} := {found.group(3).strip()[:120]}")
    return True, "the statement and the holes match the template", holes


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    source = sys.stdin.read()
    receipt = {"schema": "proven/LeanReceipt@1", "target": target, "file_sha256": hashlib.sha256(source.encode()).hexdigest(),
               "toolchain": (PKG / "lean-toolchain").read_text().strip(), "checker": "leanchecker from the toolchain",
               "method": "statement by text against the template; lake build; leanchecker replay of the module; #print axioms",
               "permitted_axioms": PERMITTED, "steps": {}}
    ok, why, holes = statement_check(target, source)
    receipt["steps"]["statement"] = {"ok": ok, "detail": why, "holes": holes}
    if not ok:
        receipt["verdict"] = "REJECTED"
        receipt["reason_code"] = "STATEMENT_MISMATCH"
        print("\n" + json.dumps(receipt, sort_keys=True))
        return 0
    (PKG / "Solution.lean").write_text(source)
    started = time.time()
    code, out = run(["lake", "build", "Solution"], BUILD_SECONDS)
    sorries = len(re.findall(r"declaration uses 'sorry'", out))
    errors = [line for line in out.splitlines() if "error:" in line][:12]
    receipt["steps"]["build"] = {"ok": code == 0, "seconds": round(time.time() - started, 1), "sorry_warnings": sorries, "errors": errors}
    if code is None:
        receipt.update(verdict="REJECTED", reason_code="TIME_LIMIT")
    elif code != 0:
        receipt.update(verdict="REJECTED", reason_code="BUILD_FAILED")
    else:
        started = time.time()
        code, out = run(["lake", "env", "leanchecker", "Solution"], CHECK_SECONDS)
        receipt["steps"]["kernel_replay"] = {"ok": code == 0, "seconds": round(time.time() - started, 1), "output": out.strip()[-2000:]}
        (PKG / "Axioms.lean").write_text("import Solution\n#print axioms solution\n")
        acode, aout = run(["lake", "env", "lean", "Axioms.lean"], 600)
        axioms: list[str] = []
        found = re.search(r"depends on axioms: \[([^\]]*)\]", aout)
        if found:
            axioms = [a.strip() for a in found.group(1).split(",") if a.strip()]
        receipt["steps"]["axioms"] = {"ok": acode == 0, "axioms": axioms, "output": aout.strip()[-600:]}
        extra = [a for a in axioms if a not in PERMITTED]
        if code is None:
            receipt.update(verdict="REJECTED", reason_code="TIME_LIMIT")
        elif code != 0:
            receipt.update(verdict="REJECTED", reason_code="KERNEL_REJECTED")
        elif acode != 0:
            receipt.update(verdict="INFRASTRUCTURE_FAILED", reason_code="AXIOMS_UNREAD")
        elif sorries or "sorryAx" in axioms or extra:
            receipt.update(verdict="REJECTED", reason_code="AXIOM_NOT_PERMITTED", extra_axioms=extra, sorry_count=sorries)
        else:
            receipt.update(verdict="CHECKED", reason_code="LEAN_KERNEL_VERIFIED", sorry_count=0)
    print("\n" + json.dumps(receipt, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
