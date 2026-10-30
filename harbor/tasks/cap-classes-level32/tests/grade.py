#!/usr/bin/env python3
"""Grade one cap-classes task: enumerate the family F_32(base; residue) and count its ray classes
at each base fibre; reward = 1 iff the submitted counts match. Runs in a separate verifier sandbox
that never ran agent code."""
from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path

TESTS = Path("/tests")
VERIFIER_DIR = Path("/logs/verifier")
INSTANCE = Path("/logs/artifacts/instance.json")
MAX_BYTES = 1 << 20


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Rejected(Exception):
    pass


def read_instance() -> dict:
    try:
        st = INSTANCE.lstat()
    except FileNotFoundError:
        raise Rejected("no submission: /workspace/instance.json was not found after the agent finished")
    if not INSTANCE.is_file() or INSTANCE.is_symlink() or st.st_size > MAX_BYTES:
        raise Rejected("instance.json is not a regular file of at most 1 MiB")
    try:
        inst = json.loads(INSTANCE.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise Rejected(f"instance.json is not valid JSON: {exc}")
    if not isinstance(inst, dict):
        raise Rejected("instance.json must be a JSON object")
    return inst


def validate(inst, task):
    p, level, size = task["p"], task["level"], task["member_size"]
    if inst.get("p") != p:
        raise Rejected(f"p must be {p}")
    zeta = inst.get("zeta")
    if not isinstance(zeta, int) or isinstance(zeta, bool) or not 1 < zeta < p \
            or pow(zeta, level, p) != 1 or any(pow(zeta, level // q, p) == 1 for q in (2,)):
        raise Rejected(f"zeta must be a primitive {level}th root of unity in F_p")
    base = inst.get("base")
    if not isinstance(base, list) or len(base) != 2 or not all(isinstance(b, int) and not isinstance(b, bool) and 0 <= b < level for b in base) \
            or base[0] == base[1]:
        raise Rejected("base must be two distinct indices in [0, 32)")
    residue = inst.get("residue")
    if not isinstance(residue, int) or isinstance(residue, bool) or not 0 <= residue < level:
        raise Rejected("residue must be an integer in [0, 32)")
    classes = inst.get("classes")
    if not isinstance(classes, dict) or set(classes) != {str(b) for b in base} \
            or not all(isinstance(v, int) and not isinstance(v, bool) and v >= 0 for v in classes.values()):
        raise Rejected("classes must map each base index (as a string) to a non-negative count")
    return zeta, tuple(base), residue, {int(k): v for k, v in classes.items()}, size, level


def main() -> int:
    VERIFIER_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("reward.txt", "reward.json"):
        (VERIFIER_DIR / name).unlink(missing_ok=True)
    details: dict = {"started_at": time.time()}
    reward = None
    metrics: dict = {}
    try:
        task = json.loads((TESTS / "task.json").read_text())
        exc = load("exceptional", TESTS / "exceptional.py")
        zeta, base, residue, claimed, size, level = validate(read_instance(), task)
        counted = exc.ray_classes(task["p"], zeta, base, residue, size=size, modulus=level)
        match = all(counted[b] == claimed[b] for b in base)
        reward = 1.0 if match else 0.0
        metrics = {"reward": reward, "classes": {str(b): counted[b] for b in base}, "max": max(counted.values())}
        details.update(metrics, claimed={str(b): claimed[b] for b in base}, base=list(base), residue=residue,
                       reason="the counts match" if match else "the counts differ")
    except Rejected as e:
        reward, metrics = 0.0, {"reward": 0.0, "classes": {}, "max": 0}
        details["reason"] = f"rejected: {e}"
    except MemoryError:
        reward, metrics = 0.0, {"reward": 0.0, "classes": {}, "max": 0}
        details["reason"] = "rejected: the computation needs more memory than the verifier has"
    except Exception as e:  # a bug in this grader, never the agent's fault
        details["reason"] = f"grading error: {type(e).__name__}: {e}"
    details["finished_at"] = time.time()
    (VERIFIER_DIR / "grading.json").write_text(json.dumps(details, indent=2))
    print(json.dumps(details, indent=2))
    if reward is not None:
        (VERIFIER_DIR / "reward.json").write_text(json.dumps(metrics) + "\n")
        (VERIFIER_DIR / "reward.txt").write_text(f"{metrics['reward']}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
