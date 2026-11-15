import MCAChallenge

/-! T3, `MCAChallenge.T3`: at every gap `δ` above capacity, on smooth domains, at most `C δ * n`
bad challenges once `n ≥ N δ`. Replace every `sorry`: `N` and `C` in closed form, then the proof.
Add definitions and lemmas after these declarations or in modules under `Submission/`; change
nothing else. -/

/-- The threshold at gap `δ`. -/
noncomputable def N : ℝ → ℕ := sorry

/-- The constant at gap `δ`. -/
noncomputable def C : ℝ → ℝ := sorry

theorem solution.{u} : MCAChallenge.T3.{u} N C := sorry
