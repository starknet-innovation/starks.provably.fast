# starks.provably.fast: prove `MCAChallenge.FibreM31`

Prove one pinned statement of the mathematics challenge on https://starks.provably.fast/ in Lean 4
against the pinned ArkLib commit, with a proof the Lean kernel accepts. The problem in words, what
is known and the discussion are at https://starks.provably.fast/MATHEMATICS.md; this task is
lane 1, the named statement.

The pinned statement, from `lean/MCAChallenge.lean` (installed and prebuilt here):

```lean
/-- The fibre case over M31, at every `h`: at most `C * n` labels. The field with
`(2 ^ 31 - 1) ^ 2` elements is the quadratic extension of M31, which holds the circle domain. A
result supplies `C`, a numeral of at most `2 ^ 20` (over one finite field any count is at most the
field's size, so the constant is capped); `C = 16` is `T3Goal`'s constant. -/
def FibreM31 (C : ℕ) : Prop :=
  C ≤ 2 ^ 20 ∧
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ h : ℕ, 0 < h → FibreCaseOn F h (C * (32 * h))
```

The challenge is `FibreM31`, also at `/opt/proven-math/challenges/FibreM31.lean`:

```lean
import MCAChallenge

/-! `MCAChallenge.FibreM31`: the fibre case of Lemma R over M31 at every `h`, at most `C * n` labels
of fibre-type anchors when the common defect set has odd size at most `7 h`. Replace both `sorry`s:
`C` as a numeral of at most `2 ^ 20`, then the proof. Add definitions and lemmas after these two
declarations or in modules under `Submission/`; change nothing else. -/

/-- The constant: `16` is the constant of `T3Goal`. -/
def C : ℕ := sorry

theorem solution.{u} : MCAChallenge.FibreM31.{u} C := sorry
```

## What to submit

Write `/workspace/Submission.lean`. Start from a copy of the challenge:

```bash
cp /opt/proven-math/challenges/FibreM31.lean /workspace/Submission.lean
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
