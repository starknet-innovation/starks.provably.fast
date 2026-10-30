#!/usr/bin/env python3
"""Grade one count task: certify the submitted line's bad challenges from the definition.

Runs in a separate verifier sandbox that never ran agent code. The only input the agent controls
is /logs/artifacts/instance.json; the task's parameters come from /tests/task.json.

A challenge z with witness W (k domain indices) is certified when the polynomial P of degree
below k through f + z g at W agrees with f + z g on at least A points S, and f and g are not both
interpolable by polynomials of degree below k on S. Certified challenges are counted once each.

reward = 1 if certified > goal_per_n * n, else 0 (rules v2, 30 October 2026: this cell is open for
records only above 16 n, the one count that would refute the pinned statement at this n; the graded
reward min(1, certified / 16 n) paid for one more challenge and was retired). reward.json also
reports the uncapped count certified_bad (the authoritative number), bad_per_n, over_floor
(certified minus the public baseline), beats_floor and above_goal. A malformed instance (wrong
field, k, A or domain, a bad witness) scores 0. A broken grading setup writes no reward, so Harbor
reports an error rather than a score.

The arithmetic is numpy on int64: p < 2^31, so every product stays below 2^62. The same
definition, in pure Python, is the kit's certify.py; the two agree on every instance tested.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

TESTS = Path("/tests")
VERIFIER_DIR = Path("/logs/verifier")
INSTANCE = Path("/logs/artifacts/instance.json")
MAX_BYTES = 64 << 20


class Rejected(Exception):
    """The instance is invalid: reward 0."""


class GradingError(Exception):
    """The grading setup is broken: no reward."""


class Mod:
    """Vectorised arithmetic modulo a prime below 2^31."""

    def __init__(self, p: int):
        if not (2 < p < 1 << 31):
            raise GradingError("the prime must be below 2^31")
        self.p = p

    def inv(self, a: np.ndarray) -> np.ndarray:
        """Elementwise inverses by Fermat; an entry 0 gives 0."""
        p = self.p
        base = np.asarray(a, dtype=np.int64) % p
        result = np.ones_like(base)
        e = p - 2
        while e:
            if e & 1:
                result = result * base % p
            base = base * base % p
            e >>= 1
        return result

    def newton(self, xs: np.ndarray, ys: np.ndarray, inv_table: np.ndarray | None = None) -> np.ndarray:
        """Newton coefficients of the polynomial of degree below len(xs) through (xs, ys)."""
        p, k = self.p, len(xs)
        d = ys.copy() % p
        if inv_table is None:
            inv_table = self.inverse_table(xs)
        pos = 0
        for j in range(1, k):
            width = k - j
            d[j:] = (d[j:] - d[j - 1:k - 1]) % p * inv_table[pos:pos + width] % p
            pos += width
        return d

    def inverse_table(self, xs: np.ndarray) -> np.ndarray:
        """Inverses of every x_i - x_{i-j}, j = 1..k-1, in the order newton() consumes them."""
        p, k = self.p, len(xs)
        dens = np.concatenate([(xs[j:] - xs[:k - j]) % p for j in range(1, k)]) if k > 1 else np.zeros(0, np.int64)
        return self.inv(dens)

    def eval_newton(self, c: np.ndarray, xs: np.ndarray, X: np.ndarray) -> np.ndarray:
        """Evaluate the Newton form (coefficients c, centres xs) at every point of X."""
        p, k = self.p, len(c)
        v = np.full(X.shape, int(c[k - 1]), dtype=np.int64)
        for j in range(k - 2, -1, -1):
            v = (v * ((X - xs[j]) % p) + c[j]) % p
        return v

    def interpolable(self, pts: np.ndarray, vals: np.ndarray, k: int) -> bool:
        """Does some polynomial of degree below k take these values at these points?"""
        if len(pts) <= k:
            return True
        c = self.newton(pts[:k], vals[:k])
        return bool(np.all(self.eval_newton(c, pts[:k], pts[k:]) == vals[k:] % self.p))


def load_task() -> dict:
    task = json.loads((TESTS / "task.json").read_text())
    for key in ("p", "n", "k", "A", "floor", "goal_per_n", "max_listed"):
        if key not in task:
            raise GradingError(f"task.json lacks {key}")
    return task


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


def int_list(value, name: str, length: int, low: int, high: int) -> np.ndarray:
    if not isinstance(value, list) or len(value) != length:
        raise Rejected(f"{name} must be a list of {length} integers")
    if not all(isinstance(v, int) and not isinstance(v, bool) and low <= v < high for v in value):
        raise Rejected(f"{name} must hold integers in [{low}, {high})")
    return np.array(value, dtype=np.int64)


def validate(inst: dict, task: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, list]:
    p, n, k, A = task["p"], task["n"], task["k"], task["A"]
    for key, want in (("p", p), ("k", k), ("A", A)):
        if inst.get(key) != want:
            raise Rejected(f"{key} must be {want}, got {inst.get(key)!r}")
    dom = int_list(inst.get("domain"), "domain", n, 1, p)
    if len(set(dom.tolist())) != n:
        raise Rejected("domain points must be distinct")
    # The n-th roots of unity form the only subgroup of order n, so this pins the domain.
    if not all(pow(int(x), n, p) == 1 for x in dom):
        raise Rejected(f"every domain point must satisfy x^{n} = 1 (the subgroup of order {n})")
    f = int_list(inst.get("f"), "f", n, 0, p)
    g = int_list(inst.get("g"), "g", n, 0, p)
    chal = inst.get("challenges")
    if not isinstance(chal, list):
        raise Rejected("challenges must be a list")
    if len(chal) > task["max_listed"]:
        raise Rejected(f"at most {task['max_listed']} challenges may be listed, got {len(chal)}")
    out = []
    for idx, ch in enumerate(chal):
        if not isinstance(ch, dict) or "z" not in ch or "witness" not in ch:
            raise Rejected(f"challenge {idx} must be an object with z and witness")
        z = ch["z"]
        if not isinstance(z, int) or isinstance(z, bool) or not 0 <= z < p:
            raise Rejected(f"challenge {idx}: z must be an integer in [0, {p})")
        w = ch["witness"]
        # Check element types before anything hashes them: a composite entry must be a rejection,
        # not a grading error.
        if (not isinstance(w, list) or len(w) != k
                or not all(isinstance(i, int) and not isinstance(i, bool) and 0 <= i < n for i in w)
                or len(set(w)) != k):
            raise Rejected(f"challenge {idx}: the witness must be {k} distinct domain indices")
        out.append((z, w))
    return dom, f, g, out


def certify(dom: np.ndarray, f: np.ndarray, g: np.ndarray, chal: list, k: int, A: int, p: int) -> tuple[set, list]:
    """Certified distinct bad challenges and the failures, by the definition."""
    mod = Mod(p)
    bad: set[int] = set()
    failures = []
    tables: dict[tuple, tuple[np.ndarray, np.ndarray]] = {}
    for z, w in chal:
        key = tuple(w)
        if key not in tables:
            xs = dom[np.array(w, dtype=np.int64)]
            tables[key] = (xs, mod.inverse_table(xs))
            if len(tables) > 4096:
                tables.pop(next(iter(tables)))
        xs, table = tables[key]
        word = (f + z * g) % p
        c = mod.newton(xs, word[np.array(w, dtype=np.int64)], table)
        values = mod.eval_newton(c, xs, dom)
        S = np.nonzero(values == word)[0]
        if len(S) < A:
            failures.append((z, f"agreement {len(S)} < {A}"))
            continue
        pts = dom[S]
        if mod.interpolable(pts, f[S], k) and mod.interpolable(pts, g[S], k):
            failures.append((z, "explained: f and g are jointly interpolable on S"))
            continue
        bad.add(z)
    return bad, failures


def main() -> int:
    VERIFIER_DIR.mkdir(parents=True, exist_ok=True)
    for name in ("reward.txt", "reward.json"):
        (VERIFIER_DIR / name).unlink(missing_ok=True)
    details: dict = {"started_at": time.time()}
    reward = None
    metrics: dict = {}
    try:
        task = load_task()
        n, floor, goal = task["n"], task["floor"], task["goal_per_n"] * task["n"]
        inst = read_instance()
        dom, f, g, chal = validate(inst, task)
        bad, failures = certify(dom, f, g, chal, task["k"], task["A"], task["p"])
        certified = len(bad)
        reward = 1.0 if certified > goal else 0.0
        metrics = {
            "reward": round(reward, 6),
            "certified_bad": certified,
            "bad_per_n": round(certified / n, 4),
            "over_floor": certified - floor,
            "beats_floor": int(certified > floor),
            "above_goal": int(certified > goal),
        }
        details.update(metrics, floor=floor, goal=goal, listed=len(chal), failed=len(failures),
                       failures=failures[:10], reason="certified from the definition; reward 1 only above 16 n")
    except Rejected as exc:
        reward = 0.0
        metrics = {"reward": 0.0, "certified_bad": 0, "bad_per_n": 0.0, "over_floor": 0, "beats_floor": 0, "above_goal": 0}
        details["reason"] = f"rejected: {exc}"
    except GradingError as exc:
        details["reason"] = f"grading error: {exc}"
    except MemoryError:
        reward = 0.0
        metrics = {"reward": 0.0, "certified_bad": 0, "bad_per_n": 0.0, "over_floor": 0, "beats_floor": 0, "above_goal": 0}
        details["reason"] = "rejected: the instance needs more memory than the verifier has"
    except Exception as exc:  # a bug in this grader, never the agent's fault
        details["reason"] = f"grading error: {type(exc).__name__}: {exc}"
    details["finished_at"] = time.time()
    (VERIFIER_DIR / "grading.json").write_text(json.dumps(details, indent=2))
    print(json.dumps(details, indent=2))
    if reward is not None:
        (VERIFIER_DIR / "reward.json").write_text(json.dumps(metrics) + "\n")
        (VERIFIER_DIR / "reward.txt").write_text(f"{metrics['reward']}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
