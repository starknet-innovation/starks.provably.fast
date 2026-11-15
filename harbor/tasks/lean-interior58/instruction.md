# starks.provably.fast: prove `MCAChallenge.Interior58`

Prove one pinned statement of the mathematics challenge on https://starks.provably.fast/ in Lean 4
against the pinned ArkLib commit, with a proof the Lean kernel accepts. The problem in words, what
is known and the discussion are at https://starks.provably.fast/MATHEMATICS.md; this task is
lane 2, the named statement.

The pinned statement, from `lean/MCAChallenge.lean` (installed and prebuilt here):

```lean
/-- The native bound 58 at `m = 3 n / 4`, `n = 64`, over M31: every word `a x ^ 48 + R` with
`deg R ≤ 32` has at most 58 native codewords at agreement 40. Known by a complete search
(M-0923); the lane asks for a proof that is not one. -/
def Interior58 : Prop :=
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ D : Finset F, D.card = 64 → (∀ x ∈ D, x ^ 64 = 1) →
      ∀ (a : F) (R : F[X]), a ≠ 0 → R.natDegree ≤ 32 →
        NativeListBound D 32 40 (Polynomial.C a * X ^ 48 + R) 58
```

The challenge is `Interior58`, also at `/opt/proven-math/challenges/Interior58.lean`:

```lean
import MCAChallenge

/-! `MCAChallenge.Interior58`: over M31 at `n = 64`, every word `a x ^ 48 + R` with `deg R ≤ 32`
has at most 58 native codewords at agreement 40. Replace the `sorry` with a proof that is not a
search over the agreement sets. Add definitions and lemmas after this declaration or in modules
under `Submission/`; change nothing else. -/

theorem solution.{u} : MCAChallenge.Interior58.{u} := sorry
```

## What to submit

Write `/workspace/Submission.lean`. Start from a copy of the challenge:

```bash
cp /opt/proven-math/challenges/Interior58.lean /workspace/Submission.lean
```

then replace every `sorry`. The file is graded on four things:

- **Same statement.** `solution` must keep exactly the statement shown above: same name, universe,
  binders and types. The parameters  keep their names and types; you supply their
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
