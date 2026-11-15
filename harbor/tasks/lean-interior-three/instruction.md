# starks.provably.fast: prove `MCAChallenge.InteriorThree`

Prove one pinned statement of the mathematics challenge on https://starks.provably.fast/ in Lean 4
against the pinned ArkLib commit, with a proof the Lean kernel accepts. The problem in words, what
is known and the discussion are at https://starks.provably.fast/MATHEMATICS.md; this task is
lane 2, the statement after it.

The pinned statement, from `lean/MCAChallenge.lean` (installed and prebuilt here):

```lean
/-- At most three high monomials, at every dyadic `n = 2 ^ r` from 16 to `2 ^ 31`, at agreement
`5 n / 8`: at most `K * n` native codewords. A result supplies `K`, a numeral of at most `2 ^ 20`
(a count of agreement sets gives `2 ^ n` for free). -/
def InteriorThree (K : ℕ) : Prop :=
  K ≤ 2 ^ 20 ∧
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ r : ℕ, 4 ≤ r → r ≤ 31 → ∀ D : Finset F, D.card = 2 ^ r → (∀ x ∈ D, x ^ 2 ^ r = 1) →
      ∀ (m : Fin 3 → ℕ) (a : Fin 3 → F) (R : F[X]),
        (∀ i, 2 ^ (r - 1) < m i ∧ m i < 2 ^ r) → R.natDegree ≤ 2 ^ (r - 1) →
        NativeListBound D (2 ^ (r - 1)) (5 * 2 ^ (r - 3))
          (∑ i, Polynomial.C (a i) * X ^ m i + R) (K * 2 ^ r)
```

The challenge is `InteriorThree`, also at `/opt/proven-math/challenges/InteriorThree.lean`:

```lean
import MCAChallenge

/-! `MCAChallenge.InteriorThree`: over M31 at every dyadic `n` from 16 to `2 ^ 31`, every word with
at most three high monomials has at most `K * n` native codewords at agreement `5 n / 8`. Replace
both `sorry`s: `K` as a numeral of at most `2 ^ 20`, then the proof. Add definitions and lemmas
after these two declarations or in modules under `Submission/`; change nothing else. -/

/-- The constant. -/
def K : ℕ := sorry

theorem solution.{u} : MCAChallenge.InteriorThree.{u} K := sorry
```

## What to submit

Write `/workspace/Submission.lean`. Start from a copy of the challenge:

```bash
cp /opt/proven-math/challenges/InteriorThree.lean /workspace/Submission.lean
```

then replace every `sorry`. The file is graded on four things:

- **Same statement.** `solution` must keep exactly the statement shown above: same name, universe,
  binders and types. The parameters `K` keep their names and types; you supply their
  bodies.
- **Parameters in closed form.** A parameter is a term built from numerals, arithmetic, powers and
  roots, `exp`, `log`, trigonometric functions and their inverses, floor and ceiling, `min`,
  `max`, case splits on comparisons, and the pinned definitions. `Classical.choose`, `Nat.find`,
  `sSup`, `sInf`, limits and the like are refused, even when the proof is accepted: a result names
  its constants.
- **Standard axioms only.** Proofs may use only `propext`, `Quot.sound` and `Classical.choice`.
  `sorry`, `admit`, new `axiom`s and `native_decide` (it introduces an axiom of its own) are rejected.
- **Kernel-checked.** The proof is re-checked by the Lean kernel, not just the elaborator.

Put new lemmas after the parameter definitions, or in modules under `/workspace/Submission/`
(module names `Submission.Foo`) imported from `Submission.lean`. Only `.lean` files at those two
paths are graded. You may import any module of the pinned packages (ArkLib and its Mathlib).

## Environment

- Lean `v4.34.0`, ArkLib at `35ddcaa8` with its pinned Mathlib, and `MCAChallenge` are
  installed and prebuilt; `/workspace` is a Lake project. Check your work with
  `cd /workspace && lake build Submission`, and `#print axioms solution`.
- The sandbox has 4 CPUs and 12 GB of memory; `LEAN_NUM_THREADS=3` bounds `lake build`.
- There is no internet access.

## Grading

When you finish, `Submission.lean` and `Submission/**.lean` are copied to a fresh machine and
checked with [Comparator](https://github.com/leanprover/comparator), the Lean FRO's proof checker,
then the parameters are read for closed form. The reward is 1 if both pass and 0 otherwise. A
partial proof scores 0. The targets are open problems: a reward of 1 is a result, and the file
should also be posted on starks.provably.fast for review and credit.
