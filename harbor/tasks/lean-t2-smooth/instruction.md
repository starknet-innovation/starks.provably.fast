# starks.provably.fast: prove `MCAChallenge.T2Smooth`

Prove one pinned statement of the mathematics challenge on https://starks.provably.fast/ in Lean 4
against the pinned ArkLib commit, with a proof the Lean kernel accepts. The problem in words, what
is known and the discussion are at https://starks.provably.fast/MATHEMATICS.md; this task is
lane 3.

The pinned statement, from `lean/MCAChallenge.lean` (installed and prebuilt here):

```lean
/-- `T2` on smooth domains: a threshold curve strictly between capacity and the first-order curve
at every rate, with a count at most quadratic in `n`. A result supplies `a₂`, `C` and `B`. -/
def T2Smooth (a₂ : ℝ → ℝ) (C : ℝ → ℝ → ℝ) (B : ℝ → ℝ → ℕ) : Prop :=
  (∀ rho : ℝ, 0 < rho → rho < 1 → rho < a₂ rho ∧ a₂ rho < firstOrderCurve rho) ∧
  ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta → a₂ rho + eta < 1 →
    0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
    (a₂ rho + eta) * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F],
      (ringChar F = 0 ∨ max (k - 1) (B rho eta) < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C rho eta * n ^ 2)
```

The challenge is `T2Smooth`, also at `/opt/proven-math/challenges/T2Smooth.lean`:

```lean
import MCAChallenge

/-! `MCAChallenge.T2Smooth`: `T2` on smooth domains, a threshold curve strictly between capacity and
the first-order curve, with a quadratic count. Replace every `sorry`: `a₂`, `C` and `B` in closed
form, then the proof. Add definitions and lemmas after these declarations or in modules under
`Submission/`; change nothing else. -/

/-- The threshold curve, as a function of the rate. -/
noncomputable def a₂ : ℝ → ℝ := sorry

/-- The constant at rate `ρ` and slack `η`. -/
noncomputable def C : ℝ → ℝ → ℝ := sorry

/-- The characteristic bound at rate `ρ` and slack `η`. -/
noncomputable def B : ℝ → ℝ → ℕ := sorry

theorem solution.{u} : MCAChallenge.T2Smooth.{u} a₂ C B := sorry
```

## What to submit

Write `/workspace/Submission.lean`. Start from a copy of the challenge:

```bash
cp /opt/proven-math/challenges/T2Smooth.lean /workspace/Submission.lean
```

then replace every `sorry`. The file is graded on four things:

- **Same statement.** `solution` must keep exactly the statement shown above: same name, universe,
  binders and types. The parameters `a₂` and `C` and `B` keep their names and types; you supply their
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
