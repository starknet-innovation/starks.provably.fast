#!/usr/bin/env python3
"""Grade one exceptional-set task: recompute E(f, g) over every A-subset and compare.

Runs in a separate verifier sandbox that never ran agent code. The only input the agent controls is
/logs/artifacts/instance.json; the task's parameters come from /tests/task.json. reward = 1 iff the
claimed set is exactly E(f, g) and each challenge's fibre-alignment matches; 0 otherwise.
"""
from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path

TESTS = Path("/tests")
VERIFIER_DIR = Path("/logs/verifier")
INSTANCE = Path("/logs/artifacts/instance.json")
MAX_BYTES = 8 << 20


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Rejected(Exception):
    pass


class GradingError(Exception):
    pass


def read_instance() -> dict:
    try:
        st = INSTANCE.lstat()
    except FileNotFoundError:
        raise Rejected("no submission: /workspace/instance.json was not found after the agent finished")
    if not INSTANCE.is_file() or INSTANCE.is_symlink() or st.st_size > MAX_BYTES:
        raise Rejected("instance.json is not a regular file of at most 8 MiB")
    try:
        inst = json.loads(INSTANCE.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise Rejected(f"instance.json is not valid JSON: {exc}")
    if not isinstance(inst, dict):
        raise Rejected("instance.json must be a JSON object")
    return inst


def ints(value, name, length, low, high):
    if not isinstance(value, list) or len(value) != length:
        raise Rejected(f"{name} must be a list of {length} integers")
    if not all(isinstance(v, int) and not isinstance(v, bool) and low <= v < high for v in value):
        raise Rejected(f"{name} must hold integers in [{low}, {high})")
    return list(value)


def validate(inst, task):
    p, n, k, A = task["p"], task["n"], task["k"], task["A"]
    for key, want in (("p", p), ("k", k), ("A", A)):
        if inst.get(key) != want:
            raise Rejected(f"{key} must be {want}, got {inst.get(key)!r}")
    dom = ints(inst.get("domain"), "domain", n, 1, p)
    if len(set(dom)) != n or not all(pow(x, n, p) == 1 for x in dom):
        raise Rejected(f"the domain must be the {n} distinct {n}th roots of unity")
    f = ints(inst.get("f"), "f", n, 0, p)
    g = ints(inst.get("g"), "g", n, 0, p)
    claimed = inst.get("exceptional")
    if not isinstance(claimed, list) or len(claimed) > 100_000:
        raise Rejected("exceptional must be a list of at most 100,000 entries")
    out = {}
    for idx, entry in enumerate(claimed):
        if not isinstance(entry, dict) or not isinstance(entry.get("z"), int) or isinstance(entry.get("z"), bool) \
                or not 0 <= entry["z"] < p or not isinstance(entry.get("fibre_aligned"), bool):
            raise Rejected(f"exceptional[{idx}] must be {{z: integer in [0, p), fibre_aligned: bool}}")
        if entry["z"] in out:
            raise Rejected(f"exceptional lists z = {entry['z']} twice")
        out[entry["z"]] = entry["fibre_aligned"]
    return dom, f, g, out


def main() -> int:
    VERIFIER_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("reward.txt", "reward.json"):
        (VERIFIER_DIR / name).unlink(missing_ok=True)
    details: dict = {"started_at": time.time()}
    reward = None
    metrics: dict = {}
    zero = {"reward": 0.0, "e_size": 0, "claimed": 0, "missing": 0, "extra": 0, "misclassified": 0, "aligned": 0}
    try:
        task = json.loads((TESTS / "task.json").read_text())
        kit = load("kit_certify", TESTS / "certify.py")
        exc = load("exceptional", TESTS / "exceptional.py")
        inst = read_instance()
        dom, f, g, claimed = validate(inst, task)
        E, how, witness = exc.exceptional_set(kit, {"p": task["p"], "k": task["k"], "A": task["A"], "domain": dom, "f": f, "g": g})
        if not E:
            raise Rejected("the pair has no exceptional challenge; pick another pair")
        # Classify from the definition: the agreement set of each exceptional z.
        aligned, mis = 0, 0
        for z in sorted(E):
            T = exc.agreement_set(kit, task["p"], task["k"], dom, f, g, z, witness[z])
            verdict = exc.fibre_aligned(task["p"], dom, T, task["h"], task["A"])["aligned"]
            aligned += verdict
            if z in claimed and claimed[z] != verdict:
                mis += 1
        missing = len(E - set(claimed))
        extra = len(set(claimed) - E)
        exact = missing == 0 and extra == 0 and mis == 0
        reward = 1.0 if exact else 0.0
        metrics = {"reward": reward, "e_size": len(E), "claimed": len(claimed), "missing": missing, "extra": extra,
                   "misclassified": mis, "aligned": aligned}
        details.update(metrics, scan=how, reason="exact" if exact else "the claimed set or classification differs from E(f, g)")
    except Rejected as e:
        reward, metrics = 0.0, dict(zero)
        details["reason"] = f"rejected: {e}"
    except GradingError as e:
        details["reason"] = f"grading error: {e}"
    except MemoryError:
        reward, metrics = 0.0, dict(zero)
        details["reason"] = "rejected: the instance needs more memory than the verifier has"
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
