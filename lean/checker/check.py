#!/usr/bin/env python3
"""The Lean receipt for one submitted file (docs/LEAN_CHECK.md, first version).

    python3 check.py TARGET < Solution.lean  >  receipt JSON on the last line
    python3 check.py LEMMA  < Any.lean       >  the same, for a file that proves no pinned statement

Inside the checker image, with no network: the file is placed in the pinned package as
Solution.lean, its statement is compared with the target's template by text (the pinned
`theorem solution` line and every hole defined without sorry), `lake build Solution` compiles it,
`leanchecker Solution` (the toolchain's own checker) replays its declarations in the kernel, and `#print axioms solution`
lists what it rests on. With the target LEMMA no statement is compared: every declaration the file
adds is replayed and its axioms collected, so a posted lemma gets a receipt too. The receipt says
exactly which of those passed; it is not the comparator the design describes, and the responder's
reply says so.
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


# Every declaration the module Solution adds, and the union of the axioms they rest on, in the
# words `#print axioms` uses so the same regex reads both.
ALL_AXIOMS = """import Solution
import Lean
open Lean Meta in
#eval show MetaM Unit from do
  let env ← getEnv
  let some idx := env.getModuleIdx? `Solution | throwError "no module Solution"
  let mut axioms : NameSet := {}
  let mut count := 0
  for (n, _) in env.constants.toList do
    if env.getModuleIdxFor? n == some idx && !n.isInternal then
      count := count + 1
      for a in (← collectAxioms n) do
        axioms := axioms.insert a
  IO.println s!"declarations: {count}"
  IO.println s!"depends on axioms: [{", ".intercalate (axioms.toList.map toString)}]"
"""


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


MODULE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def read_job() -> tuple[str, list[dict]]:
    """stdin is the file itself, or a JSON job {"source", "siblings": [{"name", "source"}]} when the
    file imports other files posted in its thread."""
    raw = sys.stdin.read()
    if raw.lstrip().startswith("{"):
        try:
            job = json.loads(raw)
        except ValueError:
            return raw, []
        if isinstance(job, dict) and isinstance(job.get("source"), str):
            return job["source"], [s for s in job.get("siblings") or [] if isinstance(s, dict)]
    return raw, []


def place_siblings(siblings: list[dict]) -> list[str]:
    """Each sibling becomes a module next to Solution.lean with a lean_lib entry of its own, so lake
    finds it when Solution imports it; returns the module names placed."""
    placed: list[str] = []
    with (PKG / "lakefile.toml").open("a") as lakefile:
        for sibling in siblings:
            name = str(sibling.get("name") or "")
            module = name[:-5] if name.endswith(".lean") else ""
            if not MODULE.fullmatch(module) or module in ("Solution", "Axioms", "MCAChallenge") or module in placed:
                continue
            (PKG / f"{module}.lean").write_text(str(sibling.get("source") or ""))
            lakefile.write(f'\n[[lean_lib]]\nname = "{module}"\n')
            placed.append(module)
    return placed


def main() -> int:
    target = sys.argv[1] if len(sys.argv) > 1 else ""
    source, siblings = read_job()
    receipt = {"schema": "proven/LeanReceipt@1", "target": target, "file_sha256": hashlib.sha256(source.encode()).hexdigest(),
               "toolchain": (PKG / "lean-toolchain").read_text().strip(), "checker": "leanchecker from the toolchain",
               "method": "statement by text against the template; lake build; leanchecker replay of the module; #print axioms",
               "permitted_axioms": PERMITTED, "steps": {}}
    lemma = target == "LEMMA"
    ok, why, holes = (True, "no pinned statement: every declaration in the file is checked", []) if lemma else statement_check(target, source)
    receipt["steps"]["statement"] = {"ok": ok, "detail": why, "holes": holes}
    if not ok:
        receipt["verdict"] = "REJECTED"
        receipt["reason_code"] = "STATEMENT_MISMATCH"
        print("\n" + json.dumps(receipt, sort_keys=True))
        return 0
    (PKG / "Solution.lean").write_text(source)
    if siblings:
        receipt["bundle"] = place_siblings(siblings)
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
        (PKG / "Axioms.lean").write_text(ALL_AXIOMS if lemma else "import Solution\n#print axioms solution\n")
        acode, aout = run(["lake", "env", "lean", "Axioms.lean"], 600)
        if lemma:
            found = re.search(r"declarations: (\d+)", aout)
            receipt["declarations"] = int(found.group(1)) if found else 0
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
