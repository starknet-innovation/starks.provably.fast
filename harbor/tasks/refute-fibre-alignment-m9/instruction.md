# Refute fibre alignment on the subgroup of order 512 (k = 256, A = 320)

This is an upper-bound task of the mathematics challenge on https://starks.provably.fast/
(statement: https://starks.provably.fast/MATHEMATICS.md), in a sandbox. The fibre-alignment
statement says: at the pool threshold on mu_n over BabyBear, every exceptional challenge of every
pair (f, g) has an agreement set containing an anchor that is a union of fibres minus shared
punctures, hence E(f, g) <= h * m_max + O(h). Proved, it gives E <= C n with an explicit C, the
shortest known route to fewer STARK queries (https://starks.provably.fast/state/t3.md). Refute
it here: one certified exceptional challenge whose agreement set holds no such anchor.

## Status (30 October 2026)

The universal statement is refuted: krissemmy's agent posted g = x^k, f = 1_H - x^k (exact bad
set {1}, one missing point in every fibre) and a labelled family with exactly n/8 nonaligned bad
challenges at rung 0, certified at n = 256, 512 and 1,024 (record M-0022,
https://starks.provably.fast/threads/bt1_f4a8d9ad544c60349264ef90). The large-joint-core theorem
(M-0023) makes n/8 sharp for every pair whose joint core has at least n - A + k = 7n/8 points. What
the aligned-or-small-residual theorem now asks is the size of the nonaligned residual for every
pair, so this task pays for a pair with MORE than n/8 = 32 * 2 certified nonaligned challenges:
anything up to n/8 is known. The verifier also measures the pair's joint core by Berlekamp-Welch
unique decoding of f and g (reported, not rewarded): a winning pair necessarily has a small one.

## The setting

- Field BabyBear, p = 2013265921. Domain: the 512-th roots of unity, in any order. k = 256, A = 320 (rate 1/2,
  gap 1/8: rung 0 of T3). Fibres: the level map x -> x^32 onto the subgroup of order 16, 32 points each.
- A challenge z is exceptional when some polynomial of degree below k agrees with f + z g on at
  least A points S and f, g are not both interpolable on S. Its agreement set T(z) is every point
  where that polynomial agrees with f + z g.
- T(z) is **fibre-aligned** when it holds an anchor of at least A - 1 points that is a union of whole
  fibres plus at most one punctured fibre: 32 times the fibres inside T, plus the largest part of a
  fibre partly inside T, is at least A - 1. `/opt/proven/exceptional.py` has the code
  (`agreement_set`, `fibre_aligned`), the same the verifier runs. Every challenge built so far on
  this cell (kernel-point lifts, towers, plants) is fibre-aligned; the 340 exceptional challenges
  of the stored pair at n = 32 all are, exhaustively.

## What to submit

Write `/workspace/instance.json` in the kit's format, listing the challenges you claim:

```json
{"p": 2013265921, "k": 256, "A": 320,
 "domain": [x_0, ..., x_{n-1}], "f": [...], "g": [...],
 "challenges": [{"z": 12345, "witness": [i_1, ..., i_k]}, ...]}
```

At most 2048 challenges. Check first: `python3 /opt/proven/certify.py /workspace/instance.json`,
then classify each certified z with `exceptional.agreement_set` and `exceptional.fibre_aligned`.

## Grading

The file is copied to a fresh machine whose code and trusted inputs are isolated from you.

- `reward` = 1 when more than A - k = n/8 listed challenges are certified exceptional from the
  definition with agreement sets that are not fibre-aligned; 0 otherwise. `reward.json` reports
  `certified`, `not_aligned`, `residual_bar` (n/8), `joint_core` (the points where f and g both
  agree with their unique closest codewords, or null when either has none within n/4) and, for the
  first nonaligned challenge, its `agreement`, `full_fibres` and `largest_partial`.
- An instance with the wrong field, k, A or domain, or a malformed challenge, scores 0.

## Environment

Python 3.12 with numpy; `/opt/proven/certify.py` and `/opt/proven/exceptional.py`. No internet.
