"""The native Circle-code certifier (kit/certify_circle.py): the code, its interpolation, and
bad challenges from the definition, on the subgroup and the Stwo coset of size 16."""
from __future__ import annotations

import importlib.util
import random
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("certify_circle", ROOT / "kit" / "certify_circle.py")
cc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cc)

# A primitive 2^31-th root of unity on the circle: (3 + i)^(p - 1) has norm one and order 2^31.
G = cc.power((3, 1), cc.P - 1)


def domain(n: int, eta: int):
    w = cc.power(G, (1 << 31) // n)
    pts = [cc.power(w, j) for j in range(n)]
    if eta == -1:
        gamma = cc.power(G, (1 << 31) // (2 * n))
        pts = [cc.mul(gamma, z) for z in pts]
    return pts


def real_codeword(rng, dom, k):
    """A codeword with base-field values: P[j] = conj(P[k - j]), P[k/2] real, P[0] imaginary."""
    Pp = [cc.ZERO] * (k + 1)
    Pp[0] = (0, rng.randrange(cc.P)); Pp[k] = cc.conj(Pp[0])
    for j in range(1, k // 2):
        Pp[j] = (rng.randrange(cc.P), rng.randrange(cc.P)); Pp[k - j] = cc.conj(Pp[j])
    Pp[k // 2] = (rng.randrange(cc.P), 0)
    values = cc.codeword_values(Pp, dom, k)
    assert all(v[1] == 0 for v in values), "not base-field valued"
    return [v[0] for v in values]


class CircleCode(unittest.TestCase):
    def test_domains_lie_on_the_circle_with_the_right_eta(self):
        for n, eta in ((16, 1), (16, -1), (32, 1)):
            dom = domain(n, eta)
            self.assertEqual(len(set(dom)), n)
            self.assertTrue(all((z[0] * z[0] + z[1] * z[1]) % cc.P == 1 for z in dom))
            self.assertTrue(all(cc.power(z, n) == cc.base(eta) for z in dom))

    def test_interpolation_recovers_a_codeword_and_rejects_a_random_word(self):
        rng = random.Random(1)
        for eta in (1, -1):
            dom, k = domain(16, eta), 8
            f = real_codeword(rng, dom, k)
            values = [cc.base(v) for v in f]
            self.assertTrue(cc.is_codeword(dom, values, k, list(range(16))))
            # A codeword is determined by any k points: the interpolant agrees everywhere.
            idx = rng.sample(range(16), k)
            Pp = cc.circle_interpolant([dom[i] for i in idx], [values[i] for i in idx], k)
            self.assertIsNotNone(Pp)
            self.assertEqual(cc.add(Pp[0], Pp[k]), cc.ZERO)
            self.assertEqual(cc.codeword_values(Pp, dom, k), values)
            noise = [cc.base(rng.randrange(cc.P)) for _ in range(16)]
            self.assertFalse(cc.is_codeword(dom, noise, k, list(range(16))))

    def test_a_planted_bad_challenge_is_certified_and_a_random_one_fails(self):
        rng = random.Random(2)
        dom, n, k, A = domain(16, 1), 16, 8, 10
        C = real_codeword(rng, dom, k)
        Gw = real_codeword(rng, dom, k)
        z0 = rng.randrange(1, cc.P)
        S = sorted(rng.sample(range(n), A))
        g = Gw[:]
        g[S[0]] = (g[S[0]] + 1) % cc.P                         # g is no codeword on S
        f = [rng.randrange(cc.P) for _ in range(n)]
        for i in S:
            f[i] = (C[i] - z0 * g[i]) % cc.P                   # f + z0 g = C on S
        inst = {"field": cc.P, "k": k, "A": A, "eta": 1, "domain_xy": [list(z) for z in dom], "f": f, "g": g,
                "challenges": [{"z": z0, "witness": S[:k]}, {"z": (z0 + 1) % cc.P, "witness": S[:k]}]}
        bad, failures = cc.check(inst)
        self.assertEqual(bad, {z0})
        self.assertEqual(len(failures), 1)
        self.assertTrue(failures[0][1].startswith("agreement"))
        # Two codewords are explained everywhere.
        both = {**inst, "f": C, "g": Gw, "challenges": [{"z": z0, "witness": S[:k]}]}
        bad2, failures2 = cc.check(both)
        self.assertEqual(bad2, set())
        self.assertIn("explained", failures2[0][1])

    def test_the_shipped_instance_format_rejects_bad_domains(self):
        dom, k, A = domain(16, 1), 8, 10
        off = [list(z) for z in dom]
        off[0] = [2, 2]
        with self.assertRaises(ValueError):
            cc.check({"field": cc.P, "k": k, "A": A, "eta": 1, "domain_xy": off, "f": [0] * 16, "g": [0] * 16, "challenges": []})
        with self.assertRaises(ValueError):
            cc.check({"field": cc.P, "k": k, "A": A, "eta": -1, "domain_xy": [list(z) for z in dom], "f": [0] * 16, "g": [0] * 16, "challenges": []})


class Degeneracy(unittest.TestCase):
    def test_a_degenerate_window_is_skipped_and_the_next_one_decides(self):
        rng = random.Random(9)
        dom, k = domain(16, -1), 8
        # On the Stwo coset of size 16 the eight consecutive points from index 1 do not determine a
        # codeword (L_v(0) = 0): the first window of these indices is exactly that.
        idx = list(range(1, 16))
        pts = [dom[i] for i in idx[:k]]
        self.assertIsNone(cc.circle_interpolant(pts, [cc.ZERO] * k, k))
        values = [cc.base(v) for v in real_codeword(rng, dom, k)]
        self.assertTrue(cc.is_codeword(dom, values, k, idx))
        noise = [cc.base(rng.randrange(cc.P)) for _ in range(16)]
        self.assertFalse(cc.is_codeword(dom, noise, k, idx))

    def test_an_undecidable_agreement_set_fails_the_challenge_instead_of_certifying_it(self):
        rng = random.Random(10)
        dom, n, k, A = domain(16, 1), 16, 8, 10
        C = real_codeword(rng, dom, k); Gw = real_codeword(rng, dom, k)
        z0 = 4242
        S = sorted(rng.sample(range(n), A))
        g = Gw[:]; g[S[0]] = (g[S[0]] + 1) % cc.P
        f = [rng.randrange(cc.P) for _ in range(n)]
        for i in S:
            f[i] = (C[i] - z0 * g[i]) % cc.P
        inst = {"field": cc.P, "k": k, "A": A, "eta": 1, "domain_xy": [list(z) for z in dom], "f": f, "g": g,
                "challenges": [{"z": z0, "witness": S[:k]}]}
        original = cc.is_codeword
        try:
            cc.is_codeword = lambda *args: None
            bad, failures = cc.check(inst)
        finally:
            cc.is_codeword = original
        self.assertEqual(bad, set())
        self.assertTrue(failures[0][1].startswith("undecided"))
