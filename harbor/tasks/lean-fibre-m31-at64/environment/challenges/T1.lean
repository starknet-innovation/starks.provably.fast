import MCAChallenge

/-! T1, `MCAChallenge.T1`: a linear count at every rate and slack above the first-order curve.
Replace every `sorry`: `C` and `B` in closed form, then the proof. Add definitions and lemmas after
these declarations or in modules under `Submission/`; change nothing else. -/

/-- The constant at rate `ρ` and slack `η`. -/
noncomputable def C : ℝ → ℝ → ℝ := sorry

/-- The characteristic bound at rate `ρ` and slack `η`. -/
noncomputable def B : ℝ → ℝ → ℕ := sorry

theorem solution.{u} : MCAChallenge.T1.{u} C B := sorry
