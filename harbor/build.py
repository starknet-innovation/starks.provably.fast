#!/usr/bin/env python3
"""Generate the Harbor tasks in tasks/ from templates/, the starter kit and the pinned Lean files.

    python3 build.py            # rewrite tasks/, registry.json and manifest.json
    python3 build.py --check    # exit 1 if they are out of date (the test suite runs this)

Every task is generated; none is written by hand. Count tasks (one per domain size) grade a line's
bad challenges from the definition with a dense reward; Lean tasks (one per pinned target) grade a
proof with Comparator. See README.md.
"""
from __future__ import annotations

import filecmp
import json
import math
import re
import shutil
import sys
import tempfile
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parent
PROVEN = ROOT.parent
TEMPLATES = ROOT / "templates"
DATASET, VERSION = "proven-mca", "0.2"
BABYBEAR = 2**31 - 2**27 + 1
GOAL_PER_N = 16
# Domain sizes and the verifier's time: certifying grows with n^2 per challenge. The kit's minutes
# per 1,000 challenges are its worst case, every challenge with its own witness (2026-10-14, after
# the kit moved to quadratic interpolation shared per witness).
COUNT_TASKS = [dict(m=8, verifier_timeout=1800, kit_minutes="0.7"),
               dict(m=9, verifier_timeout=3600, kit_minutes="2.6"),
               dict(m=10, verifier_timeout=10800, kit_minutes="5.6")]
# Rules v2 (30 October 2026): the upper-bound families. The exceptional-set tasks scan every
# A-subset of mu_32 (C(32, 20) = 225,792,840 at A = 20: about 9 minutes in numpy on one core;
# C(32, 18) = 471,435,600 at A = 18). The refutation tasks run on rung 0's cells. The cap task
# enumerates one level-32 witness family (C(30, 13) 13-subsets filtered by index sum: 3,742,309
# members for F_32({0, 8}; 8), about two minutes).
EXCEPTIONAL_TASKS = [dict(A=20, h=2, level=16, verifier_timeout=3600),
                     dict(A=18, h=1, level=32, verifier_timeout=7200)]
REFUTE_TASKS = [dict(m=8, verifier_timeout=1800), dict(m=9, verifier_timeout=3600), dict(m=10, verifier_timeout=10800)]
CAP_VERIFIER_TIMEOUT = 3600


def toml_str(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render(template: Path, out: Path, mapping: dict) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(Template(template.read_text()).substitute(mapping))
    if out.suffix == ".sh":
        out.chmod(0o755)


def copy_tree(src: Path, dst: Path) -> None:
    shutil.copytree(src, dst, dirs_exist_ok=True)
    for path in dst.rglob("*.sh"):
        path.chmod(0o755)


# The public floor of each task: the best count certified at its size, from the core-anchored towers
# of 14 October 2026 (record M-0014, thread bt1_afa60af3, certified independently): ten pairs at
# n = 256 and eleven at n = 512 on the subgroup itself, eleven lifted from order 512 at n = 1,024.
FLOORS = {
    8: (720, "45n/16", "ten codeword pairs in a tower over this subgroup"),
    9: (1488, "93n/32", "eleven codeword pairs in a tower over this subgroup"),
    10: (2992, "187n/64", "eleven codeword pairs in a tower over the subgroup of order 512, lifted to this one"),
}


def count_task(cfg: dict, out: Path) -> dict:
    m = cfg["m"]
    n = 1 << m
    k, A = n // 2, 5 * n // 8
    floor, floor_rule, floor_how = FLOORS[m]
    params = dict(m=m, n=n, k=k, A=A, p=BABYBEAR, floor=floor, floor_rule=floor_rule, floor_how=floor_how,
                  floor_reward=f"{floor / (GOAL_PER_N * n):.2f}", goal=GOAL_PER_N * n, goal_per_n=GOAL_PER_N,
                  max_listed=24 * n, verifier_timeout=cfg["verifier_timeout"], kit_minutes=cfg["kit_minutes"])
    task = out / f"count-babybear-m{m}"
    src = TEMPLATES / "count"
    render(src / "instruction.md", task / "instruction.md", params)
    render(src / "task.toml", task / "task.toml", params)
    render(src / "solution" / "solve.sh", task / "solution" / "solve.sh", params)
    copy_tree(src / "environment", task / "environment")
    shutil.copy(PROVEN / "kit" / "certify.py", task / "environment" / "certify.py")
    copy_tree(src / "tests", task / "tests")
    (task / "tests" / "task.json").write_text(json.dumps(
        {"p": BABYBEAR, "m": m, "n": n, "k": k, "A": A, "floor": floor, "goal_per_n": GOAL_PER_N,
         "max_listed": 24 * n}, indent=2) + "\n")
    return {"task": task.name, "kind": "count", "target": "T3", "n": n, "k": k, "A": A, "floor": floor,
            "goal_per_n": GOAL_PER_N, "oracle": "four-pair construction, 4(n - A + 1), below 16 n", "oracle_reward": 0}


def upper_bound_environment(task: Path, src: Path) -> None:
    """The sandbox files the three upper-bound families share: the kit and the exceptional-set library,
    for the agent (/opt/proven) and for the verifier (/tests)."""
    copy_tree(src / "environment", task / "environment")
    copy_tree(src / "tests", task / "tests")
    for where in ("environment", "tests"):
        shutil.copy(PROVEN / "kit" / "certify.py", task / where / "certify.py")
        shutil.copy(TEMPLATES / "shared" / "exceptional.py", task / where / "exceptional.py")


def exceptional_task(cfg: dict, out: Path) -> dict:
    params = dict(p=BABYBEAR, A=cfg["A"], h=cfg["h"], level=cfg["level"], verifier_timeout=cfg["verifier_timeout"])
    task = out / f"exceptional-set-n32-a{cfg['A']}"
    src = TEMPLATES / "exceptional"
    render(src / "instruction.md", task / "instruction.md", params)
    render(src / "task.toml", task / "task.toml", params)
    render(src / "solution" / "solve.sh", task / "solution" / "solve.sh", params)
    upper_bound_environment(task, src)
    (task / "tests" / "task.json").write_text(json.dumps(
        {"p": BABYBEAR, "n": 32, "k": 16, "A": cfg["A"], "h": cfg["h"], "level": cfg["level"]}, indent=2) + "\n")
    return {"task": task.name, "kind": "exceptional-set", "target": "T3", "n": 32, "k": 16, "A": cfg["A"], "h": cfg["h"],
            "level": cfg["level"], "subsets": math.comb(32, cfg["A"]), "oracle": "none (negative control, must score 0)"}


def refute_task(cfg: dict, out: Path) -> dict:
    m = cfg["m"]
    n = 1 << m
    k, A, h = n // 2, 5 * n // 8, n // 16
    params = dict(p=BABYBEAR, m=m, n=n, k=k, A=A, h=h, max_listed=4 * n, verifier_timeout=cfg["verifier_timeout"])
    task = out / f"refute-fibre-alignment-m{m}"
    src = TEMPLATES / "refute"
    render(src / "instruction.md", task / "instruction.md", params)
    render(src / "task.toml", task / "task.toml", params)
    render(src / "solution" / "solve.sh", task / "solution" / "solve.sh", params)
    upper_bound_environment(task, src)
    (task / "tests" / "task.json").write_text(json.dumps(
        {"p": BABYBEAR, "m": m, "n": n, "k": k, "A": A, "h": h, "level": 16, "max_listed": 4 * n}, indent=2) + "\n")
    return {"task": task.name, "kind": "refute-fibre-alignment", "target": "T3", "n": n, "k": k, "A": A, "h": h,
            "oracle": "none (negative control, must score 0)"}


def cap_task(out: Path) -> dict:
    params = dict(p=BABYBEAR, verifier_timeout=CAP_VERIFIER_TIMEOUT)
    task = out / "cap-classes-level32"
    src = TEMPLATES / "capclasses"
    render(src / "instruction.md", task / "instruction.md", params)
    render(src / "task.toml", task / "task.toml", params)
    render(src / "solution" / "solve.sh", task / "solution" / "solve.sh", params)
    upper_bound_environment(task, src)
    (task / "tests" / "task.json").write_text(json.dumps({"p": BABYBEAR, "level": 32, "member_size": 15}, indent=2) + "\n")
    return {"task": task.name, "kind": "cap-verification", "target": "T3", "level": 32, "member_size": 15,
            "posted_maximum": {"family": "F_32({0, 8}; 8)", "fibre": 8, "classes": 385196},
            "oracle": "none (negative control, must score 0)"}


def definition_block(lean: str, name: str) -> str:
    """The docstring and `def` of one pinned declaration, up to the next blank line."""
    m = re.search(rf"(?ms)^(?:/--(?:(?!-/).)*-/\n)?def {re.escape(name)}\b.*?(?=\n\n)", lean)
    if not m:
        raise SystemExit(f"{name} is not defined in MCAChallenge.lean")
    return m.group(0)


def lean_task(name: str, spec: dict, index: dict, out: Path) -> dict:
    lean_dir = PROVEN / "lean"
    pinned = (lean_dir / "MCAChallenge.lean").read_text()
    lakefile = (lean_dir / "lakefile.toml").read_text()
    commit = re.search(r'rev = "([0-9a-f]{40})"', lakefile).group(1)
    toolchain = (lean_dir / "lean-toolchain").read_text().strip()
    template = (lean_dir / "challenges" / spec["template"]).read_text().rstrip()
    holes = spec["holes"]
    slug = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", name).lower()
    params = dict(target=name, slug=slug, level=spec["level"], arklib_commit=commit, arklib_short=commit[:8],
                  toolchain=toolchain.split(":")[-1], definition=definition_block(pinned, name), template=template,
                  holes_toml="[" + ", ".join(toml_str(h) for h in holes) + "]",
                  holes_prose=" and ".join(f"`{h}`" for h in holes))
    task = out / f"lean-{slug}"
    src = TEMPLATES / "lean"
    render(src / "instruction.md", task / "instruction.md", params)
    render(src / "task.toml", task / "task.toml", params)
    render(src / "solution" / "solve.sh", task / "solution" / "solve.sh", params)
    copy_tree(src / "environment", task / "environment")
    for file in ("lakefile.toml", "lake-manifest.json", "lean-toolchain", "MCAChallenge.lean"):
        shutil.copy(lean_dir / file, task / "environment" / file)
    (task / "environment" / "challenges").mkdir(exist_ok=True)
    for path in sorted((lean_dir / "challenges").glob("*.lean")):
        shutil.copy(path, task / "environment" / "challenges" / path.name)
    copy_tree(src / "tests", task / "tests")
    shutil.copy(lean_dir / "challenges" / spec["template"], task / "tests" / "Challenge.lean")
    (task / "tests" / "task.json").write_text(json.dumps(
        {"challenge": name, "comparator": {"theorem_names": [index["theorem"]], "definition_names": holes,
                                            "permitted_axioms": index["permitted_axioms"]},
         "grade_timeout_sec": 6300}, indent=2) + "\n")
    return {"task": task.name, "kind": "lean", "target": name, "level": spec["level"], "holes": holes,
            "arklib_commit": commit, "oracle": "none (negative control, must score 0)"}


def generate(out: Path) -> None:
    index = json.loads((PROVEN / "lean" / "challenges" / "index.json").read_text())
    tasks_dir = out / "tasks"
    tasks_dir.mkdir(parents=True)
    rows = [count_task(cfg, tasks_dir) for cfg in COUNT_TASKS]
    rows += [exceptional_task(cfg, tasks_dir) for cfg in EXCEPTIONAL_TASKS]
    rows += [refute_task(cfg, tasks_dir) for cfg in REFUTE_TASKS]
    rows.append(cap_task(tasks_dir))
    rows += [lean_task(name, spec, index, tasks_dir) for name, spec in index["targets"].items()]
    (out / "registry.json").write_text(json.dumps([{
        "name": DATASET, "version": VERSION,
        "description": "Mathematics tasks of starks.provably.fast: exceptional sets, fibre-alignment refutations "
                       "and cap verifications (reward 1 for an exact answer), counts above 16 n, and Lean proofs of the pinned targets (Comparator).",
        "tasks": [{"name": r["task"], "path": f"tasks/{r['task']}"} for r in rows]}], indent=2) + "\n")
    (out / "manifest.json").write_text(json.dumps({"dataset": DATASET, "version": VERSION, "tasks": rows},
                                                  indent=1, ensure_ascii=False) + "\n")


def differs(a: Path, b: Path) -> list[str]:
    cmp = filecmp.dircmp(a, b)
    out = [f"only in {a.name}: {x}" for x in cmp.left_only] + [f"only in {b.name}: {x}" for x in cmp.right_only]
    out += [f"differs: {x}" for x in cmp.diff_files]
    for sub in cmp.common_dirs:
        out += [f"{sub}/{x}" for x in differs(a / sub, b / sub)]
    return out


def main(argv: list[str]) -> int:
    if argv == ["--check"]:
        with tempfile.TemporaryDirectory() as tmp:
            generate(Path(tmp))
            problems = []
            for name in ("tasks", "registry.json", "manifest.json"):
                if not (ROOT / name).exists():
                    problems.append(f"missing {name}")
                elif name == "tasks":
                    problems += differs(Path(tmp) / "tasks", ROOT / "tasks")
                elif (Path(tmp) / name).read_text() != (ROOT / name).read_text():
                    problems.append(f"differs: {name}")
            if problems:
                print("harbor/ is out of date; run python3 harbor/build.py:\n  " + "\n  ".join(problems))
                return 1
            print("harbor/ is up to date")
            return 0
    if argv:
        raise SystemExit(__doc__)
    with tempfile.TemporaryDirectory() as tmp:
        generate(Path(tmp))
        if (ROOT / "tasks").exists():
            shutil.rmtree(ROOT / "tasks")
        shutil.copytree(Path(tmp) / "tasks", ROOT / "tasks")
        for name in ("registry.json", "manifest.json"):
            shutil.copy(Path(tmp) / name, ROOT / name)
    print(f"generated {len(list((ROOT / 'tasks').iterdir()))} tasks")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
