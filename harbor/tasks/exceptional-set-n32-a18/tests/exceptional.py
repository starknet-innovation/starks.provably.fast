"""The exceptional set of a pair, its anchors, and the ray classes of a witness family: what the
upper-bound tasks verify. numpy for the exhaustive scans; the kit (certify.py) for the definition.

Exceptional set. A challenge z is exceptional for the pair (f, g) at agreement A when f + z g
agrees with some polynomial of degree below k on at least A points S and f, g are not both
interpolable on S. For |S| = A, a word h restricted to S is interpolable iff its A - k syndromes
vanish: syndrome_t(S) = sum_{i in S} w_i(S) x_i^t h(x_i) for t < A - k, where
w_i(S) = 1 / prod_{j in S, j != i} (x_i - x_j) (the dual of the evaluation code on S is a
generalised Reed-Solomon code). With U the complement of S, w_i(S) = W_i P_U(x_i) for
W_i = 1 / prod_{j != i} (x_i - x_j) over the whole domain and P_U(X) = prod_{u in U} (X - x_u);
P_U vanishes on U, so the sum may run over the whole domain and syndrome_t(S) = sum_m c_m(U) M[t][m],
with c_m(U) the coefficients of P_U and M[t][m] = sum_i x_i^(m + t) W_i h(x_i) a table computed
once. A subset S gives a candidate z when syndrome(g) is not zero and syndrome(f) is proportional
to it, z = -ratio. Every exceptional z arises this way from an A-subset of its agreement set: two
A-subsets of a set of A + 1 points share at least k points when A >= k + 1, so if f and g were
jointly interpolable on every A-subset they would be on the whole set. Every candidate is then
certified from the definition by the kit's own check.

Anchors. On mu_n with the level map x -> x^h (fibres of size h), the agreement set T(z) is
fibre-aligned when it contains an anchor of at least A - 1 points that is a union of whole fibres
plus at most one punctured fibre: h * (fibres inside T) + (the largest part of a fibre partly in T)
>= A - 1. This is the operational form of "a union of fibres minus shared punctures above the base
fibre" in the cluster-puncturing paper (thread bt1_f4a8d9ad544c60349264ef90), where every
constructed exceptional challenge has such an anchor; the open converse is whether every exceptional
challenge does.

Ray classes. The level-32 witness family F_32(b; s): members are 15-subsets S of Z_32 containing
the base b with index sum s (mod 32); the class of a member at a base fibre y is
prod_{j in S minus b} (zeta^y - zeta^j) for zeta a primitive 32nd root of unity in the field.
The number of distinct classes at each base fibre bounds the mechanism's count: at most
385,196 (h + 1) + 1 defect directions at level 32 on mu_32h over BabyBear (Proposition A of the
paper, attained by F_32({0, 8}; 8) at fibre 8).
"""
from __future__ import annotations

import itertools
import time

import numpy as np


def esf_batch(roots: np.ndarray, p: int) -> np.ndarray:
    """Coefficients (low to high, length r + 1) of prod (X - root) for each row of roots."""
    b, r = roots.shape
    coeffs = np.zeros((b, r + 1), dtype=np.int64)
    coeffs[:, 0] = 1
    for j in range(r):
        x = roots[:, j]
        shifted = np.zeros_like(coeffs)
        shifted[:, 1:] = coeffs[:, :-1]
        coeffs = (shifted - (x[:, None] * coeffs) % p) % p
    return coeffs


def candidate_challenges(p: int, k: int, A: int, dom: list[int], f: list[int], g: list[int],
                         batch: int = 200_000, log=None) -> dict[int, tuple[int, ...]]:
    """Every z some A-subset of the domain makes a candidate, with that subset's complement."""
    n = len(dom)
    r, s = n - A, A - k
    if s < 1 or r < 0:
        raise ValueError("need k < A <= n")
    W = []
    for i in range(n):
        prod = 1
        for j in range(n):
            if j != i:
                prod = prod * (dom[i] - dom[j]) % p
        W.append(pow(prod, p - 2, p))

    def table(h):
        out = np.zeros((s, r + 1), dtype=np.int64)
        for t in range(s):
            for m in range(r + 1):
                out[t, m] = sum(pow(dom[i], m + t, p) * W[i] % p * h[i] for i in range(n)) % p
        return out

    Mf, Mg = table(f), table(g)
    xs = np.array(dom, dtype=np.int64)
    found: dict[int, tuple[int, ...]] = {}
    total, started = 0, time.time()
    combos = itertools.combinations(range(n), r)
    while True:
        chunk = list(itertools.islice(combos, batch))
        if not chunk:
            break
        idx = np.array(chunk, dtype=np.int64)
        coeffs = esf_batch(xs[idx], p) if r else np.ones((len(chunk), 1), dtype=np.int64)
        sf = np.zeros((len(chunk), s), dtype=np.int64)
        sg = np.zeros((len(chunk), s), dtype=np.int64)
        for m in range(r + 1):
            sf = (sf + coeffs[:, m:m + 1] * Mf[:, m][None, :] % p) % p
            sg = (sg + coeffs[:, m:m + 1] * Mg[:, m][None, :] % p) % p
        prop = np.any(sg != 0, axis=1)
        for t in range(s):
            for u in range(t + 1, s):
                prop &= ((sf[:, t] * sg[:, u]) % p) == ((sf[:, u] * sg[:, t]) % p)
        for row in np.nonzero(prop)[0]:
            t0 = int(np.nonzero(sg[row])[0][0])
            lam = int(sf[row, t0]) * pow(int(sg[row, t0]), p - 2, p) % p
            z = (-lam) % p
            if z not in found:
                found[z] = tuple(chunk[row])
        total += len(chunk)
        if log and total % (batch * 50) == 0:
            log(f"{total:,} subsets, {len(found)} candidates, {time.time() - started:.0f} s")
    return found


def exceptional_set(kit, inst: dict, batch: int = 200_000, log=None) -> tuple[set[int], dict, dict[int, list[int]]]:
    """E(f, g) from the definition, how it was reached, and a witness (k indices) per exceptional z.
    `kit` is the loaded certify.py."""
    p, k, A = inst["p"], inst["k"], inst["A"]
    dom = [x % p for x in inst["domain"]]
    n = len(dom)
    found = candidate_challenges(p, k, A, dom, [v % p for v in inst["f"]], [v % p for v in inst["g"]], batch, log)
    chal, witness = [], {}
    for z, U in found.items():
        S = [i for i in range(n) if i not in set(U)]
        chal.append({"z": z, "witness": S[:k]})
        witness[z] = S[:k]
    bad, failures = kit.check({"p": p, "k": k, "A": A, "domain": dom, "f": inst["f"], "g": inst["g"], "challenges": chal})
    E = set(bad)
    return E, {"subsets": __import__("math").comb(n, n - A), "candidates": len(found), "failed": len(failures)}, {z: witness[z] for z in E}


def agreement_set(kit, p: int, k: int, dom: list[int], f: list[int], g: list[int], z: int, witness: list[int]) -> list[int]:
    """Indices where f + z g agrees with its interpolant on the witness (the kit's definition)."""
    xs = [dom[i] for i in witness]
    word = [(a + z * b) % p for a, b in zip(f, g)]
    P = kit.interpolate(xs, [word[i] for i in witness], p)
    return [i for i in range(len(dom)) if kit.evaluate(P, dom[i], p) == word[i]]


def fibre_aligned(p: int, dom: list[int], T: list[int], h: int, A: int) -> dict:
    """Whether T holds an anchor of at least A - 1 points that is a union of whole fibres of
    x -> x^h plus at most one punctured fibre, and the parts behind that answer."""
    parts: dict[int, int] = {}
    for i in T:
        y = pow(dom[i], h, p)
        parts[y] = parts.get(y, 0) + 1
    full = sum(1 for c in parts.values() if c == h)
    partial = max((c for c in parts.values() if c < h), default=0)
    anchor = h * full + partial
    return {"aligned": anchor >= A - 1, "full_fibres": full, "largest_partial": partial, "anchor": anchor, "agreement": len(T)}


def ray_classes(p: int, zeta: int, base: tuple[int, ...], s: int, size: int = 15, modulus: int = 32,
                batch: int = 500_000, log=None) -> dict[int, int]:
    """Distinct classes of F(base; s) at each base fibre: members are `size`-subsets of Z_modulus
    containing the base with index sum s; the class at y is prod over the free part of (zeta^y - zeta^j)."""
    free = [j for j in range(modulus) if j not in base]
    r = size - len(base)
    pw = [pow(zeta, j, p) for j in range(modulus)]
    want = (s - sum(base)) % modulus
    diff = {y: (pw[y] - np.array(pw, dtype=np.int64)) % p for y in base}
    seen = {y: set() for y in base}
    total = members = 0
    started = time.time()
    combos = itertools.combinations(free, r)
    while True:
        chunk = list(itertools.islice(combos, batch))
        if not chunk:
            break
        idx = np.array(chunk, dtype=np.int64)
        idx = idx[(idx.sum(axis=1) % modulus) == want]
        members += len(idx)
        for y in base:
            prod = np.ones(len(idx), dtype=np.int64)
            for c in range(r):
                prod = prod * diff[y][idx[:, c]] % p
            seen[y].update(np.unique(prod).tolist())
        total += len(chunk)
        if log and total % (batch * 40) == 0:
            log(f"{total:,} subsets, {members:,} members, {time.time() - started:.0f} s")
    return {y: len(v) for y, v in seen.items()}


# ---- Unique decoding and the joint core -------------------------------------------------------
#
# The large-joint-core theorem (record M-0023): if a pair (P0, Q0) of degree below k matches (f, g)
# jointly on L >= n - A + k points, every qualifying polynomial of every challenge is P0 + z Q0 and
# |E(f, g)| <= floor(b / max(1, A - L)), b the points where g differs from Q0. A nonaligned
# challenge from such a pair is therefore known territory (the n/8 family of M-0022 is sharp
# there); the open case of the aligned-or-small-residual theorem is a pair whose joint core is
# smaller. The refutation tasks pay only there. Berlekamp-Welch unique decoding finds the codeword
# within (n - k) / 2 of a word when one exists, by solving N(x_i) = y_i E(x_i) for a monic error
# locator E of degree e and N of degree below k + e; P = N / E.


def solve_mod_p(M: np.ndarray, rhs: np.ndarray, p: int) -> np.ndarray | None:
    """One solution x of M x = rhs over F_p (free variables 0), or None when inconsistent."""
    M = M.copy() % p
    rhs = rhs.copy() % p
    rows, cols = M.shape
    pivots = []
    r = 0
    for c in range(cols):
        if r >= rows:
            break
        nz = np.nonzero(M[r:, c])[0]
        if len(nz) == 0:
            continue
        piv = r + int(nz[0])
        if piv != r:
            M[[r, piv]] = M[[piv, r]]
            rhs[[r, piv]] = rhs[[piv, r]]
        inv = pow(int(M[r, c]), p - 2, p)
        M[r] = M[r] * inv % p
        rhs[r] = rhs[r] * inv % p
        others = np.nonzero(M[:, c])[0]
        others = others[others != r]
        if len(others):
            factors = M[others, c].copy()
            M[others] = (M[others] - (factors[:, None] * M[r][None, :]) % p) % p
            rhs[others] = (rhs[others] - factors * rhs[r] % p) % p
        pivots.append((r, c))
        r += 1
    # Inconsistent rows: all-zero coefficients with a nonzero right-hand side.
    for i in range(r, rows):
        if rhs[i] % p != 0:
            return None
    x = np.zeros(cols, dtype=np.int64)
    for row, col in pivots:
        x[col] = rhs[row]
    return x


def poly_divmod(num: list[int], den: list[int], p: int) -> tuple[list[int], list[int]]:
    """Quotient and remainder of num / den over F_p, coefficients low to high."""
    num = [c % p for c in num]
    den = [c % p for c in den]
    while den and den[-1] == 0:
        den.pop()
    if not den:
        raise ZeroDivisionError("division by the zero polynomial")
    inv_lead = pow(den[-1], p - 2, p)
    q = [0] * max(0, len(num) - len(den) + 1)
    rem = num[:]
    for i in range(len(num) - len(den), -1, -1):
        coeff = rem[i + len(den) - 1] * inv_lead % p
        q[i] = coeff
        if coeff:
            for j, d in enumerate(den):
                rem[i + j] = (rem[i + j] - coeff * d) % p
    while rem and rem[-1] == 0:
        rem.pop()
    return q, rem


def unique_decode(p: int, dom: list[int], word: list[int], k: int, errors: int | None = None) -> list[int] | None:
    """Coefficients (low to high, length k) of the unique polynomial of degree below k that agrees
    with the word on at least n - errors points, or None when no such polynomial exists. errors
    defaults to the unique-decoding radius floor((n - k) / 2)."""
    n = len(dom)
    e = (n - k) // 2 if errors is None else errors
    if e < 0 or k + 2 * e > n:
        raise ValueError("errors must satisfy k + 2 errors <= n")
    xs = np.array(dom, dtype=np.int64) % p
    ys = np.array(word, dtype=np.int64) % p
    # Columns: E coefficients e_0 .. e_{e-1} (E monic of degree e), then N coefficients n_0 .. n_{k+e-1}.
    # Row i: sum_j n_j x_i^j - y_i sum_j e_j x_i^j = y_i x_i^e.
    powers = np.ones((n, k + e + 1), dtype=np.int64)
    for j in range(1, k + e + 1):
        powers[:, j] = powers[:, j - 1] * xs % p
    M = np.zeros((n, k + 2 * e), dtype=np.int64)
    if e:
        M[:, :e] = (-(ys[:, None] * powers[:, :e] % p)) % p
    M[:, e:] = powers[:, :k + e]
    rhs = ys * powers[:, e] % p
    sol = solve_mod_p(M, rhs, p)
    if sol is None:
        return None
    E = [int(c) for c in sol[:e]] + [1]
    N = [int(c) for c in sol[e:]]
    q, rem = poly_divmod(N, E, p)
    if rem:
        return None
    P = (q + [0] * k)[:k]
    # The decoded codeword must really be within the radius, else there was none.
    agree = sum(1 for x, y in zip(dom, word) if sum(c * pow(x, i, p) for i, c in enumerate(P)) % p == y % p)
    return P if agree >= n - e else None


def joint_core(p: int, dom: list[int], f: list[int], g: list[int], k: int) -> dict:
    """The joint core of (f, g): the points where both agree with their unique closest codewords
    within the unique-decoding radius. Each word has at most one codeword within that radius, so
    when both decode the core is well defined; when either does not, every pair of codewords is
    farther than the radius from it and the joint core is below n - (n - k) / 2."""
    n = len(dom)
    P0 = unique_decode(p, dom, f, k)
    Q0 = unique_decode(p, dom, g, k)
    if P0 is None or Q0 is None:
        return {"decodable": False, "core": None, "bound": n - (n - k) // 2 - 1}
    ev = lambda P, x: sum(c * pow(x, i, p) for i, c in enumerate(P)) % p  # noqa: E731
    core = sum(1 for i, x in enumerate(dom) if ev(P0, x) == f[i] % p and ev(Q0, x) == g[i] % p)
    return {"decodable": True, "core": core, "bound": core}
