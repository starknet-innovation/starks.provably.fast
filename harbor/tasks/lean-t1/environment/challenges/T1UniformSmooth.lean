import MCAChallenge

/-! `MCAChallenge.T1UniformSmooth`: `T1Uniform` on smooth domains, at most `C * n` bad challenges at
agreement `k + 6 n / 25`. Replace both `sorry`s: `C` in closed form, then the proof. Add
definitions and lemmas after these two declarations or in modules under `Submission/`; change
nothing else. -/

/-- The constant. -/
noncomputable def C : ℝ := sorry

theorem solution.{u} : MCAChallenge.T1UniformSmooth.{u} C := sorry
