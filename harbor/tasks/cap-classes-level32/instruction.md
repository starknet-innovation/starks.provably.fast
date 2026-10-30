# Verify a cap: the ray classes of a level-32 witness family

This is a cap-verification task of the mathematics challenge on https://starks.provably.fast/
(statement: https://starks.provably.fast/MATHEMATICS.md), in a sandbox. The cluster-puncturing
paper (https://starks.provably.fast/threads/bt1_f4a8d9ad544c60349264ef90) caps the RS
two-base-fibre mechanism at level 32 by 385,196 (h + 1) + 1 defect directions, where 385,196 is the
largest number of ray classes any family F_32(b; s) has at a base fibre, attained by F_32({0, 8}; 8)
at fibre 8. Recompute the class counts of one family yourself; the verifier enumerates the family
on its own and pays for a match. A matching recomputation is a credited review on the site.

## The family

- Field BabyBear, p = 2013265921; zeta a primitive 32nd root of unity (give the one you used).
- F_32(b; s): the 15-subsets S of Z_32 that contain the base b (two indices) and have index sum
  s (mod 32). The free part is T = S minus b (13 indices).
- The class of a member at a base fibre y (one of the two base indices) is
  prod over j in T of (zeta^y - zeta^j). Count the distinct classes at each base fibre.
- `/opt/proven/exceptional.py` has `ray_classes` (numpy, a few minutes).

## What to submit

Write `/workspace/instance.json`:

```json
{"p": 2013265921, "zeta": 1234567, "base": [0, 8], "residue": 8,
 "classes": {"0": 384242, "8": 385196}}
```

Any base of two distinct indices and any residue are accepted; the posted maximum is the
pair above. The counts must be yours; the verifier does not read them from the paper.

## Grading

The file is copied to a fresh machine whose code and trusted inputs are isolated from you.

- `reward` = 1 when the verifier's recomputed class count at each base fibre equals yours; 0
  otherwise. `reward.json` reports the verifier's `classes` and `members`, so a mismatch is visible.
- A zeta that is not a primitive 32nd root of unity, a base of fewer than two indices, or a
  malformed file scores 0.

## Environment

Python 3.12 with numpy; `/opt/proven/exceptional.py`. No internet.
