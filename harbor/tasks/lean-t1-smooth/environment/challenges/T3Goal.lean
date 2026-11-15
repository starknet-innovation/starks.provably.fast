import MCAChallenge

/-! The first goal, `MCAChallenge.T3Goal`: at rate 1/2 with the exact `k = n / 2`, gap 1/8, on
smooth domains, at most `16 n` bad challenges once `n ≥ N`. Replace both `sorry`s: `N` in closed
form, then the proof. Add definitions and lemmas after these two declarations or in modules under
`Submission/`; change nothing else. -/

/-- The threshold: the goal holds for every `n ≥ N`. -/
def N : ℕ := sorry

theorem solution.{u} : MCAChallenge.T3Goal.{u} N := sorry
