import MCAChallenge

/-! The milestone toward T3, `MCAChallenge.T3Exponent`: one exponent `c` for every gap. Replace
every `sorry`: `c` a numeral, `N` and `C` in closed form, then the proof. Add definitions and lemmas
after these declarations or in modules under `Submission/`; change nothing else. -/

/-- The exponent, the same at every gap. -/
def c : ℕ := sorry

/-- The threshold at gap `δ`. -/
noncomputable def N : ℝ → ℕ := sorry

/-- The constant at gap `δ`. -/
noncomputable def C : ℝ → ℝ := sorry

theorem solution.{u} : MCAChallenge.T3Exponent.{u} c N C := sorry
