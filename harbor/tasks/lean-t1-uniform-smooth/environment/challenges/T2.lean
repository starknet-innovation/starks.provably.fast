import MCAChallenge

/-! T2, `MCAChallenge.T2`: a threshold curve strictly between capacity and the first-order curve,
with a quadratic count. Replace every `sorry`: `a₂`, `C` and `B` in closed form, then the proof.
Add definitions and lemmas after these declarations or in modules under `Submission/`; change
nothing else. -/

/-- The threshold curve, as a function of the rate. -/
noncomputable def a₂ : ℝ → ℝ := sorry

/-- The constant at rate `ρ` and slack `η`. -/
noncomputable def C : ℝ → ℝ → ℝ := sorry

/-- The characteristic bound at rate `ρ` and slack `η`. -/
noncomputable def B : ℝ → ℝ → ℕ := sorry

theorem solution.{u} : MCAChallenge.T2.{u} a₂ C B := sorry
