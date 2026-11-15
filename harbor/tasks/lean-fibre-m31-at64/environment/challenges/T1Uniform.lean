import MCAChallenge

/-! The milestone toward T1, `MCAChallenge.T1Uniform`: at most `C * n` bad challenges at agreement
`k + 6 n / 25`. Replace both `sorry`s: `C` in closed form, then the proof. Add definitions and
lemmas after these two declarations or in modules under `Submission/`; change nothing else. -/

/-- The constant. -/
noncomputable def C : ℝ := sorry

theorem solution.{u} : MCAChallenge.T1Uniform.{u} C := sorry
