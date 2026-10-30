# Refute fibre alignment on the subgroup of order $n (k = $k, A = $A)

This is an upper-bound task of the mathematics challenge on https://starks.provably.fast/
(statement: https://starks.provably.fast/MATHEMATICS.md), in a sandbox. The fibre-alignment
statement says: at the pool threshold on mu_n over BabyBear, every exceptional challenge of every
pair (f, g) has an agreement set containing an anchor that is a union of fibres minus shared
punctures, hence E(f, g) <= h * m_max + O(h). Proved, it gives E <= C n with an explicit C, the
shortest known route to fewer STARK queries (https://starks.provably.fast/state/t3.md). Refute
it here: one certified exceptional challenge whose agreement set holds no such anchor.

## The setting

- Field BabyBear, p = $p. Domain: the $n-th roots of unity, in any order. k = $k, A = $A (rate 1/2,
  gap 1/8: rung 0 of T3). Fibres: the level map x -> x^$h onto the subgroup of order 16, $h points each.
- A challenge z is exceptional when some polynomial of degree below k agrees with f + z g on at
  least A points S and f, g are not both interpolable on S. Its agreement set T(z) is every point
  where that polynomial agrees with f + z g.
- T(z) is **fibre-aligned** when it holds an anchor of at least A - 1 points that is a union of whole
  fibres plus at most one punctured fibre: $h times the fibres inside T, plus the largest part of a
  fibre partly inside T, is at least A - 1. `/opt/proven/exceptional.py` has the code
  (`agreement_set`, `fibre_aligned`), the same the verifier runs. Every challenge built so far on
  this cell (kernel-point lifts, towers, plants) is fibre-aligned; the 340 exceptional challenges
  of the stored pair at n = 32 all are, exhaustively.

## What to submit

Write `/workspace/instance.json` in the kit's format, listing the challenges you claim:

```json
{"p": $p, "k": $k, "A": $A,
 "domain": [x_0, ..., x_{n-1}], "f": [...], "g": [...],
 "challenges": [{"z": 12345, "witness": [i_1, ..., i_k]}, ...]}
```

At most $max_listed challenges. Check first: `python3 /opt/proven/certify.py /workspace/instance.json`,
then classify each certified z with `exceptional.agreement_set` and `exceptional.fibre_aligned`.

## Grading

The file is copied to a fresh machine whose code and trusted inputs are isolated from you.

- `reward` = 1 when at least one listed challenge is certified exceptional from the definition and
  its agreement set is not fibre-aligned; 0 otherwise. `reward.json` reports `certified`,
  `not_aligned` (how many certified challenges refute alignment), and for the first refuting
  challenge its `agreement`, `full_fibres` and `largest_partial`.
- An instance with the wrong field, k, A or domain, or a malformed challenge, scores 0.

## Environment

Python 3.12 with numpy; `/opt/proven/certify.py` and `/opt/proven/exceptional.py`. No internet.
