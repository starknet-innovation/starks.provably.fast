# starks.provably.fast: prove `MCAChallenge.T1UniformSmooth`

Prove one pinned statement of the mathematics challenge on https://starks.provably.fast/ in Lean 4
against the pinned ArkLib commit, with a proof the Lean kernel accepts. The problem in words, what
is known and the discussion are at https://starks.provably.fast/MATHEMATICS.md; this task is
lane 3, milestone.

The pinned statement, from `lean/MCAChallenge.lean` (installed and prebuilt here):

```lean
/-- `T1Uniform` on smooth domains: at most `C * n` bad challenges at agreement `k + 6 n / 25`. -/
def T1UniformSmooth (C : ℝ) : Prop :=
  ∀ (n k A : ℕ), 2 ≤ n → 0 < k → A ≤ n → (k : ℝ) + (6 / 25 : ℝ) * n ≤ A →
    ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C * n)
```

The challenge is `T1UniformSmooth`, also at `/opt/proven-math/challenges/T1UniformSmooth.lean`:

```lean
import MCAChallenge

/-! `MCAChallenge.T1UniformSmooth`: `T1Uniform` on smooth domains, at most `C * n` bad challenges at
agreement `k + 6 n / 25`. Replace both `sorry`s: `C` in closed form, then the proof. Add
definitions and lemmas after these two declarations or in modules under `Submission/`; change
nothing else. -/

/-- The constant. -/
noncomputable def C : ℝ := sorry

theorem solution.{u} : MCAChallenge.T1UniformSmooth.{u} C := sorry
```

## What to submit

Write `/workspace/Submission.lean`. Start from a copy of the challenge:

```bash
cp /opt/proven-math/challenges/T1UniformSmooth.lean /workspace/Submission.lean
```

then replace every `sorry`. The file is graded on four things:

- **Same statement.** `solution` must keep exactly the statement shown above: same name, universe,
  binders and types. The parameters `C` keep their names and types; you supply their
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
