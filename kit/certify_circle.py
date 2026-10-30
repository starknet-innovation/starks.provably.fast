#!/usr/bin/env python3
"""Certify bad challenges for the native Circle code over M31 from the definition. Standard
library only. The Reed-Solomon certifier is certify.py; this is the same check on the code STARK
provers on M31 use (Stwo's Circle-FFT space), so the Circle cells of starks.provably.fast have a
certificate of their own.

Field: K = F_{M31^2} = F_p[i] / (i^2 + 1), p = 2^31 - 1, elements as pairs (a, b) = a + b i.
Domain: n distinct points z = x + i y with x^2 + y^2 = 1 (the circle C(F_p), |z| = 1) that all
satisfy z^n = eta for one eta in {1, -1}: the subgroup D_n of size n (eta = 1) or the Stwo twin
coset (eta = -1). Words f, g take values in the base field F_p.
Code: the native Circle-FFT space L'_k, Stwo's k-dimensional space for the pair (D_n, k): a word
w on D_n is a codeword iff z^(k/2) w(z) = P(z) on D_n for a polynomial P of degree at most k with
P[0] + P[k] = 0 (equivalently P in span{1 - z^k, z, ..., z^(k-1)}), which is where the Chebyshev
basis {T_j(x), y U_j(x)} lands after multiplication by z^(k/2) (verify_m31_native_circle_fft_tower.py
on the thread bt1_b556b712, Section 1). Since |z| = 1, z^(-k/2) = conj(z)^(k/2).
Bad challenge: z (a base-field element) is bad at agreement A if some codeword agrees with
f + z g on at least A points S and f, g are not both codewords on S: the definition of
certify.py with the Circle code in place of Reed-Solomon.

Usage: python3 certify_circle.py instance.json
Instance: {"field": 2147483647, "k": K, "A": A, "eta": 1 or -1, "domain_xy": [[x, y], ...],
"f": [...], "g": [...], "challenges": [{"z": Z, "witness": [k domain indices]}, ...]}, or with
"witness_sets" and an index per challenge as certify.py's @2 form. A witness is k points on which
the code is interpolated: P is found as a_0 (1 - z^k) + S(z) with S of degree below k and S(0) = 0,
through two ordinary interpolations (a_0 = L_c(0) / L_v(0), L_v the interpolant of 1 - z^k); a
witness with L_v(0) = 0 does not determine the codeword and fails.
"""
import json
import sys

P = (1 << 31) - 1
ZERO, ONE = (0, 0), (1, 0)


def add(a, b):
    return ((a[0] + b[0]) % P, (a[1] + b[1]) % P)


def sub(a, b):
    return ((a[0] - b[0]) % P, (a[1] - b[1]) % P)


def mul(a, b):
    return ((a[0] * b[0] - a[1] * b[1]) % P, (a[0] * b[1] + a[1] * b[0]) % P)


def inv(a):
    n = (a[0] * a[0] + a[1] * a[1]) % P
    if n == 0:
        raise ZeroDivisionError("inverse of zero in F_{p^2}")
    t = pow(n, P - 2, P)
    return (a[0] * t % P, (-a[1]) * t % P)


def conj(a):
    return (a[0], (-a[1]) % P)


def power(a, e):
    out, base = ONE, a
    while e:
        if e & 1:
            out = mul(out, base)
        base = mul(base, base)
        e >>= 1
    return out


def base(v):
    return (v % P, 0)


# ---- polynomials over K, coefficients low to high ----

def master_product(points):
    poly = [ONE]
    for z in points:
        new = [ZERO] * (len(poly) + 1)
        for t, c in enumerate(poly):
            new[t + 1] = add(new[t + 1], c)
            new[t] = sub(new[t], mul(c, z))
        poly = new
    return poly


def divide_by_root(poly, z):
    """poly / (X - z), exact when z is a root; coefficients low to high."""
    out = [ZERO] * (len(poly) - 1)
    carry = ZERO
    for t in range(len(poly) - 1, 0, -1):
        carry = add(poly[t], mul(carry, z))
        out[t - 1] = carry
    return out


def evaluate(poly, z):
    out = ZERO
    for c in reversed(poly):
        out = add(mul(out, z), c)
    return out


def interpolate(points, values):
    """The unique polynomial of degree below len(points) through (points, values) over K."""
    m = master_product(points)
    out = [ZERO] * len(points)
    for z, v in zip(points, values):
        basis = divide_by_root(m, z)
        scale = mul(v, inv(evaluate(basis, z)))
        for t, c in enumerate(basis):
            out[t] = add(out[t], mul(c, scale))
    return out


# ---- the Circle code ----

def circle_interpolant(points, values, k):
    """P of degree at most k with P[0] + P[k] = 0 and P(z_j) = values_j on k points, or None when
    the k points do not determine one (L_v(0) = 0)."""
    if len(points) != k:
        raise ValueError("a witness is exactly k points")
    # P(z) = z^(k/2) w(z): the interpolation runs on the lifted values.
    Lc = interpolate(points, [mul(v, power(z, k // 2)) for z, v in zip(points, values)])
    Lv = interpolate(points, [sub(ONE, power(z, k)) for z in points])
    if Lv[0] == ZERO:
        return None
    a0 = mul(Lc[0], inv(Lv[0]))
    S = [sub(c, mul(a0, v)) for c, v in zip(Lc, Lv)]       # degree below k, S(0) = 0
    Pp = S + [ZERO] * (k + 1 - len(S))
    Pp[0] = add(Pp[0], a0)
    Pp[k] = sub(Pp[k], a0)
    return Pp


def codeword_values(Pp, domain, k):
    """w(z) = P(z) z^(-k/2) at every domain point, z^(-1) = conj(z) on the circle."""
    return [mul(evaluate(Pp, z), power(conj(z), k // 2)) for z in domain]


def is_codeword(domain, values, k, indices):
    """Whether the word restricted to `indices` lies in the Circle code: interpolate on its first
    k points and compare on the rest. Fewer than k points are always explained."""
    if len(indices) <= k:
        return True
    head = indices[:k]
    Pp = circle_interpolant([domain[i] for i in head], [values[i] for i in head], k)
    if Pp is None:
        return False
    for i in indices[k:]:
        if mul(evaluate(Pp, domain[i]), power(conj(domain[i]), k // 2)) != values[i]:
            return False
    return True


def load_domain(inst):
    p = inst.get("field", P)
    if p != P:
        raise ValueError("the field is M31")
    domain = []
    for x, y in inst["domain_xy"]:
        x, y = x % P, y % P
        if (x * x + y * y) % P != 1:
            raise ValueError("a domain point is not on the circle")
        domain.append((x, y))
    n = len(domain)
    if len(set(domain)) != n:
        raise ValueError("domain points must be distinct")
    eta = base(inst.get("eta", 1))
    for z in domain:
        if power(z, n) != eta:
            raise ValueError("every domain point must satisfy z^n = eta")
    return domain


def check(inst):
    """The distinct bad z and the failures, as certify.py reports them."""
    domain = load_domain(inst)
    n, k, A = len(domain), inst["k"], inst["A"]
    if not (0 < k < A <= n and k % 2 == 0):
        raise ValueError("need 0 < k < A <= n with k even")
    f = [base(v) for v in inst["f"]]
    g = [base(v) for v in inst["g"]]
    if len(f) != n or len(g) != n:
        raise ValueError("f and g are words on the domain")
    sets = inst.get("witness_sets")
    bad, failures = set(), []
    cache = {}
    explained = {}
    for ch in inst["challenges"]:
        z = ch["z"] % P
        witness = ch["witness"]
        if isinstance(witness, int) and not isinstance(witness, bool):
            witness = sets[witness] if sets is not None and 0 <= witness < len(sets) else []
        if len(witness) != k or len(set(witness)) != k or not all(isinstance(i, int) and 0 <= i < n for i in witness):
            failures.append((z, "the witness must be k distinct domain indices"))
            continue
        key = tuple(witness)
        if key not in cache:
            pts = [domain[i] for i in witness]
            Pf = circle_interpolant(pts, [f[i] for i in witness], k)
            Pg = circle_interpolant(pts, [g[i] for i in witness], k)
            cache[key] = (codeword_values(Pf, domain, k), codeword_values(Pg, domain, k)) if Pf and Pg else None
        if cache[key] is None:
            failures.append((z, "the witness does not determine a codeword (L_v(0) = 0)"))
            continue
        wf, wg = cache[key]
        zz = base(z)
        S = [i for i in range(n) if add(wf[i], mul(zz, wg[i])) == add(f[i], mul(zz, g[i]))]
        if len(S) < A:
            failures.append((z, f"agreement {len(S)} < {A}"))
            continue
        skey = tuple(S)
        if skey not in explained:
            explained[skey] = is_codeword(domain, f, k, S) and is_codeword(domain, g, k, S)
        if explained[skey]:
            failures.append((z, "explained: f and g are both Circle codewords on S"))
            continue
        bad.add(z)
    return bad, failures


def main(argv):
    if len(argv) != 1:
        print(__doc__.strip().splitlines()[-1])
        return 2
    inst = json.load(open(argv[0]))
    bad, failures = check(inst)
    n = len(inst["domain_xy"])
    print(f"Circle code on {n} points of C(F_M31), k = {inst['k']}, A = {inst['A']}: {len(bad)} distinct bad challenges certified "
          f"({len(bad) / n:.4f} n); {len(failures)} listed challenges failed")
    for z, why in failures[:10]:
        print(f"  z = {z}: {why}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
