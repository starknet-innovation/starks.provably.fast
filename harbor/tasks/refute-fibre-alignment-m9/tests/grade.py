#!/usr/bin/env python3
"""Grade one refutation task: certify each listed challenge from the definition (the kit's code),
classify each agreement set, and measure the pair's joint core. reward = 1 iff the certified
nonaligned challenges outnumber the known residual, A - k (n/8 at rung 0): the n/8 family of
M-0022 is sharp for pairs with a joint core of at least n - A + k (M-0023), and a lone nonaligned
challenge from a smaller core is known too (g = x^k). Runs in a separate verifier sandbox that
never ran agent code."""
from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path

TESTS = Path("/tests")
VERIFIER_DIR = Path("/logs/verifier")
INSTANCE = Path("/logs/artifacts/instance.json")
MAX_BYTES = 64 << 20


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
        raise Rejected("instance.json is not a regular file of at most 64 MiB")
    try:
        inst = json.loads(INSTANCE.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise Rejected(f"instance.json is not valid JSON: {exc}")
    if not isinstance(inst, dict):
        raise Rejected("instance.json must be a JSON object")
    return inst


def validate(inst, task, kit):
    p, n, k, A = task["p"], task["n"], task["k"], task["A"]
    for key, want in (("p", p), ("k", k), ("A", A)):
        if inst.get(key) != want:
            raise Rejected(f"{key} must be {want}, got {inst.get(key)!r}")
    dom = inst.get("domain")
    if not isinstance(dom, list) or len(dom) != n or not all(isinstance(x, int) and not isinstance(x, bool) and 1 <= x < p for x in dom) \
            or len(set(dom)) != n or not all(pow(x, n, p) == 1 for x in dom):
        raise Rejected(f"the domain must be the {n} distinct {n}th roots of unity")
    for name in ("f", "g"):
        v = inst.get(name)
        if not isinstance(v, list) or len(v) != n or not all(isinstance(x, int) and not isinstance(x, bool) and 0 <= x < p for x in v):
            raise Rejected(f"{name} must be {n} integers in [0, p)")
    try:
        expanded = kit.expand(inst)
        # @2 and @3 name a witness by its index in witness_sets; resolve it so every form is judged alike.
        sets = expanded.get("witness_sets")
        resolved = []
        for ch in expanded.get("challenges") or []:
            w = ch.get("witness") if isinstance(ch, dict) else None
            if isinstance(w, int) and not isinstance(w, bool):
                if not isinstance(sets, list) or not 0 <= w < len(sets):
                    raise Rejected("a witness index points outside witness_sets")
                ch = {**ch, "witness": list(sets[w])}
            resolved.append(ch)
        expanded = {**expanded, "challenges": resolved}
    except Rejected:
        raise
    except Exception as exc:
        raise Rejected(f"malformed challenges: {exc}")
    chal = expanded.get("challenges")
    if not isinstance(chal, list) or not chal:
        raise Rejected("list at least one challenge")
    if len(chal) > task["max_listed"]:
        raise Rejected(f"at most {task['max_listed']} challenges may be listed")
    for idx, ch in enumerate(chal):
        w = ch.get("witness") if isinstance(ch, dict) else None
        if not isinstance(ch, dict) or not isinstance(ch.get("z"), int) or isinstance(ch.get("z"), bool) or not 0 <= ch["z"] < p \
                or not isinstance(w, list) or not 1 <= len(w) <= k or len(set(w)) != len(w) \
                or not all(isinstance(i, int) and not isinstance(i, bool) and 0 <= i < n for i in w):
            raise Rejected(f"challenge {idx} must give z in [0, p) and a witness of at most {k} distinct domain indices")
    return expanded


def main() -> int:
    VERIFIER_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("reward.txt", "reward.json"):
        (VERIFIER_DIR / name).unlink(missing_ok=True)
    details: dict = {"started_at": time.time()}
    reward = None
    metrics: dict = {}
    zero = {"reward": 0.0, "certified": 0, "not_aligned": 0, "residual_bar": 0, "joint_core": None, "joint_core_decodable": False}
    try:
        task = json.loads((TESTS / "task.json").read_text())
        kit = load("kit_certify", TESTS / "certify.py")
        exc = load("exceptional", TESTS / "exceptional.py")
        inst = validate(read_instance(), task, kit)
        bad, failures = kit.check(inst)
        p, k, A, h = task["p"], task["k"], task["A"], task["h"]
        dom, f, g = inst["domain"], inst["f"], inst["g"]
        refuting = []
        seen = set()
        for ch in inst["challenges"]:
            z = ch["z"]
            if z not in bad or z in seen:
                continue
            seen.add(z)
            T = exc.agreement_set(kit, p, k, dom, f, g, z, ch["witness"])
            verdict = exc.fibre_aligned(p, dom, T, h, A)
            if not verdict["aligned"]:
                refuting.append({"z": z, **verdict})
        residual_bar = A - k
        core = exc.joint_core(p, dom, f, g, k)
        reward = 1.0 if len(refuting) > residual_bar else 0.0
        metrics = {"reward": reward, "certified": len(bad), "not_aligned": len(refuting), "residual_bar": residual_bar,
                   "joint_core": core["core"], "joint_core_decodable": core["decodable"]}
        if refuting:
            metrics.update({key: refuting[0][key] for key in ("agreement", "full_fibres", "largest_partial")})
        details.update(metrics, failed=len(failures), failures=failures[:10], refuting=refuting[:10],
                       reason=f"{len(refuting)} certified nonaligned challenges, past the known residual {residual_bar}" if reward
                       else f"{len(refuting)} certified nonaligned challenges; the known residual is {residual_bar} (M-0022), a reward needs more")
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
