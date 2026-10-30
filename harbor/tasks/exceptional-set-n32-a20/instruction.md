# The whole exceptional set of a pair at n = 32, k = 16, A = 20

This is an upper-bound task of the mathematics challenge on https://starks.provably.fast/
(statement: https://starks.provably.fast/MATHEMATICS.md), in a sandbox. Pick a pair (f, g) on
the subgroup of order 32 in BabyBear, compute its whole exceptional set E(f, g) at agreement
A = 20, and say for each exceptional challenge whether its agreement set holds a fibre-aligned
anchor. The verifier recomputes E over every one of the C(32, 20) A-subsets from the definition
and pays only for an exact answer.

## Why this pays

A proof that E(f, g) <= C n at the pool threshold is the shortest known route to fewer STARK
queries (state of the art: https://starks.provably.fast/state/t3.md). The cluster-puncturing paper
(https://starks.provably.fast/threads/bt1_f4a8d9ad544c60349264ef90) shows every constructed
exceptional challenge has an anchor that is a union of fibres minus shared punctures; the open
converse is whether every exceptional challenge does. At n = 32 the converse can be checked
exhaustively: for the stored witness-family pair (340 = 114h + 112 listed, level 16) every one of
the 225,792,840 twenty-subsets was tested and the 340 listed challenges are exactly E. Pairs that
are not lifts, random pairs, and pairs of other quotients are the open cases, and every exact
answer is evidence for or against the fibre-alignment theorem.

## The setting

- Field BabyBear, p = 2013265921. Domain: the 32nd roots of unity, in any order. k = 16, A = 20.
- Fibres: the level map x -> x^2 onto the subgroup of order 16; each fibre has 2 points.
- A challenge z is exceptional when some polynomial of degree below 16 agrees with f + z g on at
  least A points S and f, g are not both interpolable on S.
- An agreement set T(z) is **fibre-aligned** when it holds an anchor of at least A - 1 points that is
  a union of whole fibres plus at most one punctured fibre (2 times the fibres inside T, plus the
  largest part of a fibre partly inside T, is at least A - 1). `/opt/proven/exceptional.py` has the
  exact code (`fibre_aligned`), the same the verifier runs.

## What to submit

Write `/workspace/instance.json`:

```json
{"p": 2013265921, "k": 16, "A": 20,
 "domain": [x_0, ..., x_31], "f": [...], "g": [...],
 "exceptional": [{"z": 12345, "fibre_aligned": true}, ...]}
```

- `exceptional`: every exceptional challenge of the pair, each once, with its classification.
- `/opt/proven/exceptional.py` computes both (`exceptional_set`, `agreement_set`, `fibre_aligned`):
  about ten minutes at A = 20 on two cores, longer at A = 18. Running it is the honest way to a
  reward of 1; the verifier runs the same scan on its own copy.

## Grading

The file is copied to a fresh machine whose code and trusted inputs are isolated from you.

- `reward` = 1 when the claimed set equals the recomputed E(f, g) exactly and every classification
  matches; 0 otherwise. `reward.json` reports `e_size`, `claimed`, `missing`, `extra`,
  `misclassified` and `aligned` (how many of E are fibre-aligned), so a near miss is visible.
- A pair whose E is empty, or a domain that is not the subgroup, scores 0.

## Environment

Python 3.12 with numpy; `/opt/proven/certify.py` (the kit) and `/opt/proven/exceptional.py`. No internet.
