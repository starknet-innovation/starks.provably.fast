import MCAChallenge

/-! `MCAChallenge.InteriorThree`: over M31 at every dyadic `n` from 16 to `2 ^ 31`, every word with
at most three high monomials has at most `K * n` native codewords at agreement `5 n / 8`. Replace
both `sorry`s: `K` as a numeral of at most `2 ^ 20`, then the proof. Add definitions and lemmas
after these two declarations or in modules under `Submission/`; change nothing else. -/

/-- The constant. -/
def K : ℕ := sorry

theorem solution.{u} : MCAChallenge.InteriorThree.{u} K := sorry
