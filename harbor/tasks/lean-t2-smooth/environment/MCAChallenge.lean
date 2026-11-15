/-
starks.provably.fast: the pinned statements of the mathematics targets T1, T2 and T3.

Each target is a `Prop` about Reed-Solomon line mutual correlated agreement on a prescribed
evaluation set, stated with ArkLib's `LineExactAgreementBound`: for every received line `f + z g`,
one exceptional set of at most `B` challenges, outside of which every polynomial of degree below
`k` agreeing with the line in at least `A` places splits as `P₀ + z P₁` with the same agreement set
for `f` and `g`.

The targets are `T1`, `T2` and `T3`; `T1Uniform` and `T3Exponent` are milestones toward `T1` and
`T3`. Every quantitative parameter (constants, curves, characteristic bounds, minimum lengths) is
an argument, and a result supplies it in closed form; the proof itself may reason classically. A
result compiles against the ArkLib commit pinned in `lakefile.toml` and depends on no axioms beyond
`propext`, `Classical.choice` and `Quot.sound` (check with `#print axioms`). The `baseline_*`
theorems at the end restate ArkLib's quadratic bounds in the same shape.
-/
module

public import ArkLib.Data.CodingTheory.ReedSolomon.MutualCorrelatedAgreement.FirstOrder.UniformLineMca
public import ArkLib.Data.CodingTheory.ReedSolomon.MutualCorrelatedAgreement.FirstOrder.RateBounds
public import ArkLib.Data.CodingTheory.ReedSolomon.MutualCorrelatedAgreement.Capacity
public import Mathlib.RingTheory.RootsOfUnity.PrimitiveRoots
public import Mathlib.Analysis.SpecialFunctions.Trigonometric.Inverse

@[expose] public section

namespace MCAChallenge

open Polynomial ReedSolomon ReedSolomon.HiddenDerivative

universe u

/-- The first-order curve `a₁(ρ)` of Dao, Kominers and Thaler (ePrint 2026/2056, equation 31). From
`ρ_c = 11 - 3√13` on it is ArkLib's `firstOrderRateThreshold`; below `ρ_c` it is `√(ρ/2) (1 + u)`
with `u > 0` the root of `u² (u + 3) = √(ρ/2)` (equation 30), here in closed form:
`1 + u = 2 cos (arccos ((√(ρ/2) - 2) / 2) / 3)`. -/
noncomputable def firstOrderCurve (rho : ℝ) : ℝ :=
  if 11 - 3 * Real.sqrt 13 ≤ rho then firstOrderRateThreshold rho
  else Real.sqrt (rho / 2) * (2 * Real.cos (Real.arccos ((Real.sqrt (rho / 2) - 2) / 2) / 3))

theorem firstOrderCurve_eq_threshold {rho : ℝ} (h : 11 - 3 * Real.sqrt 13 ≤ rho) :
    firstOrderCurve rho = firstOrderRateThreshold rho := by
  simp [firstOrderCurve, h]

/-- Below `ρ_c`, the closed form is DKT's lower branch: `firstOrderCurve ρ = √(ρ/2) (1 + u)` with
`u > 0` and `u² (u + 3) = √(ρ/2)` (equation 30). -/
theorem firstOrderCurve_lower_branch {rho : ℝ} (h0 : 0 < rho) (h1 : rho < 11 - 3 * Real.sqrt 13) :
    ∃ u : ℝ, 0 < u ∧ u ^ 2 * (u + 3) = Real.sqrt (rho / 2) ∧
      firstOrderCurve rho = Real.sqrt (rho / 2) * (1 + u) := by
  have hs13 : (10 : ℝ) / 3 < Real.sqrt 13 := by
    rw [Real.lt_sqrt (by norm_num)]; norm_num
  have ht1 : Real.sqrt (rho / 2) < 1 := by
    rw [Real.sqrt_lt' (by norm_num)]; nlinarith
  have ht0 : 0 < Real.sqrt (rho / 2) := Real.sqrt_pos.mpr (by linarith)
  set t := Real.sqrt (rho / 2) with ht
  set w := (t - 2) / 2 with hw
  have hw1 : -1 < w := by rw [hw]; linarith
  have hw2 : w ≤ 1 := by rw [hw]; linarith
  set θ := Real.arccos w / 3 with hθ
  refine ⟨2 * Real.cos θ - 1, ?_, ?_, ?_⟩
  · have hθ0 : 0 ≤ θ := div_nonneg (Real.arccos_nonneg w) (by norm_num)
    have hθ3 : θ < Real.pi / 3 := by
      have := Real.arccos_lt_pi.mpr hw1
      rw [hθ]; linarith
    have := Real.cos_lt_cos_of_nonneg_of_le_pi hθ0 (by linarith [Real.pi_pos]) hθ3
    rw [Real.cos_pi_div_three] at this
    linarith
  · have h3 : Real.cos (3 * θ) = 4 * Real.cos θ ^ 3 - 3 * Real.cos θ := Real.cos_three_mul θ
    have hc : Real.cos (3 * θ) = w := by
      rw [hθ, show 3 * (Real.arccos w / 3) = Real.arccos w by ring]
      exact Real.cos_arccos hw1.le hw2
    rw [hc, hw] at h3
    linear_combination (-2) * h3
  · unfold firstOrderCurve
    simp only [not_le.mpr h1, ↓reduceIte]
    rw [hθ, hw, ht]
    ring

/-- A milestone toward T1, not T1: ArkLib's `ReedSolomon.exists_uniformFirstOrder_lineMca` (Dao,
Kominers and Thaler, Theorem 5.13: `1325775 * n ^ 2` bad challenges at agreement `k + 6 n / 25`)
with the bound replaced by `C * n`, for a numeral `C`. Agreement `ρ + 0.24` lies below the Johnson
threshold only for `0.16 < ρ < 0.36`. -/
def T1Uniform (C : ℝ) : Prop :=
  ∀ (n k A : ℕ), 2 ≤ n → 0 < k → A ≤ n → (k : ℝ) + (6 / 25 : ℝ) * n ≤ A →
    ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
      ∀ domain : Fin n ↪ F, LineExactAgreementBound domain k A (C * n)

/-- T1: a linear bound at every rate `ρ` and slack `η` above the first-order curve, where Dao,
Kominers and Thaler prove `O_ρ(n² / η⁴)` (Theorem 1.1). A result supplies the constant `C ρ η` and
the characteristic bound `B ρ η`. -/
def T1 (C : ℝ → ℝ → ℝ) (B : ℝ → ℝ → ℕ) : Prop :=
  ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta →
    firstOrderCurve rho + eta < 1 →
    0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
    (firstOrderCurve rho + eta) * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F],
      (ringChar F = 0 ∨ max (k - 1) (B rho eta) < ringChar F) →
      ∀ domain : Fin n ↪ F, LineExactAgreementBound domain k A (C rho eta * n)

/-- T2: a threshold curve strictly between capacity and the first-order curve at every rate, with a
count at most quadratic in `n`. A result supplies `a₂`, `C` and `B`. -/
def T2 (a₂ : ℝ → ℝ) (C : ℝ → ℝ → ℝ) (B : ℝ → ℝ → ℕ) : Prop :=
  (∀ rho : ℝ, 0 < rho → rho < 1 → rho < a₂ rho ∧ a₂ rho < firstOrderCurve rho) ∧
  ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta → a₂ rho + eta < 1 →
    0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
    (a₂ rho + eta) * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F],
      (ringChar F = 0 ∨ max (k - 1) (B rho eta) < ringChar F) →
      ∀ domain : Fin n ↪ F, LineExactAgreementBound domain k A (C rho eta * n ^ 2)

/-- A smooth evaluation domain: a multiplicative coset `s ⟨ω⟩` of the subgroup of order `n = 2 ^ m`. -/
def IsSmoothDomain {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) : Prop :=
  ∃ (m : ℕ) (ω s : F), n = 2 ^ m ∧ IsPrimitiveRoot ω n ∧ s ≠ 0 ∧
    ∀ i : Fin n, domain i = s * ω ^ (i : ℕ)

/-- A milestone toward T3: at every gap `δ > 0` above capacity, on smooth domains, at most
`C δ * n ^ c` bad challenges once `n ≥ N δ`, with the exponent `c` independent of `δ`. Known
bounds for arbitrary domains have exponent `d_δ + 1`, `d_δ = ⌈exp(1.5 / δ)⌉` for `δ < 0.24`
(`exists_capacity_lineAgreement`). A result supplies `c`, `N` and `C`. -/
def T3Exponent (c : ℕ) (N : ℝ → ℕ) (C : ℝ → ℝ) : Prop :=
  ∀ (δ : ℝ) (n k A : ℕ), 0 < δ → N δ ≤ n → 0 < k → (k : ℝ) + δ * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C δ * n ^ c)

/-- T3: the linear case, at most `C δ * n` bad challenges at every fixed gap `δ` above capacity on
smooth domains, once `n ≥ N δ`. A result supplies `N` and `C`. -/
def T3 (N : ℝ → ℕ) (C : ℝ → ℝ) : Prop :=
  T3Exponent.{u} 1 N C

/-- The first goal of T3, in the numbers the page states: rate `1/2` with the exact `k = n / 2`
that provers use, gap `1/8` (`A ≥ 5 n / 8`), constant `16`, on smooth domains, once `n ≥ N`. A
result supplies `N`. `T3Goal_of_T3` shows that a T3 result with `C (1/8) ≤ 16` gives it. -/
def T3Goal (N : ℕ) : Prop :=
  ∀ (n k A : ℕ), N ≤ n → 0 < k → 2 * k = n → 5 * n ≤ 8 * A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (16 * n)

theorem T3Goal_of_T3 {N : ℝ → ℕ} {C : ℝ → ℝ} (h : T3.{u} N C) (hC : C (1 / 8) ≤ 16) :
    T3Goal.{u} (N (1 / 8)) := by
  intro n k A hN hk0 hk hA hAn F _ _ hchar domain hsmooth
  have hgap : (k : ℝ) + (1 / 8 : ℝ) * n ≤ A := by
    have hk' : (2 * k : ℝ) = n := by exact_mod_cast hk
    have hA' : (5 * n : ℝ) ≤ 8 * A := by exact_mod_cast hA
    linarith
  have hn : (0 : ℝ) ≤ n := Nat.cast_nonneg n
  have := h (1 / 8) n k A (by norm_num) hN hk0 hgap hAn F hchar domain hsmooth
  rw [pow_one] at this
  exact this.mono (mul_le_mul_of_nonneg_right hC hn)

/-! ## Rules v7.3, lane 3: T1 and T2 on smooth domains

`T1`, `T1Uniform` and `T2` quantify over every evaluation set. These are the same statements on
smooth domains only, the hypothesis `T3` carries. A result on FRI's own domains proves these. -/

/-- `T1Uniform` on smooth domains: at most `C * n` bad challenges at agreement `k + 6 n / 25`. -/
def T1UniformSmooth (C : ℝ) : Prop :=
  ∀ (n k A : ℕ), 2 ≤ n → 0 < k → A ≤ n → (k : ℝ) + (6 / 25 : ℝ) * n ≤ A →
    ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C * n)

/-- `T1` on smooth domains: a linear bound at every rate `ρ` and slack `η` above the first-order
curve. A result supplies `C` and `B`. -/
def T1Smooth (C : ℝ → ℝ → ℝ) (B : ℝ → ℝ → ℕ) : Prop :=
  ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta →
    firstOrderCurve rho + eta < 1 →
    0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
    (firstOrderCurve rho + eta) * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F],
      (ringChar F = 0 ∨ max (k - 1) (B rho eta) < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C rho eta * n)

/-- `T2` on smooth domains: a threshold curve strictly between capacity and the first-order curve
at every rate, with a count at most quadratic in `n`. A result supplies `a₂`, `C` and `B`. -/
def T2Smooth (a₂ : ℝ → ℝ) (C : ℝ → ℝ → ℝ) (B : ℝ → ℝ → ℕ) : Prop :=
  (∀ rho : ℝ, 0 < rho → rho < 1 → rho < a₂ rho ∧ a₂ rho < firstOrderCurve rho) ∧
  ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta → a₂ rho + eta < 1 →
    0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
    (a₂ rho + eta) * n ≤ A → A ≤ n →
    ∀ (F : Type u) [Field F] [DecidableEq F],
      (ringChar F = 0 ∨ max (k - 1) (B rho eta) < ringChar F) →
      ∀ domain : Fin n ↪ F, IsSmoothDomain domain →
        LineExactAgreementBound domain k A (C rho eta * n ^ 2)

/-- The smooth forms ask for less: a result for every evaluation set gives them. -/
theorem T1UniformSmooth_of_T1Uniform {C : ℝ} (h : T1Uniform.{u} C) : T1UniformSmooth.{u} C :=
  fun n k A h1 h2 h3 h4 F _ _ hchar domain _ ↦ h n k A h1 h2 h3 h4 F hchar domain

theorem T1Smooth_of_T1 {C : ℝ → ℝ → ℝ} {B : ℝ → ℝ → ℕ} (h : T1.{u} C B) : T1Smooth.{u} C B :=
  fun rho eta n k A h1 h2 h3 h4 h5 h6 h7 h8 h9 F _ _ hchar domain _ ↦
    h rho eta n k A h1 h2 h3 h4 h5 h6 h7 h8 h9 F hchar domain

theorem T2Smooth_of_T2 {a₂ : ℝ → ℝ} {C : ℝ → ℝ → ℝ} {B : ℝ → ℝ → ℕ} (h : T2.{u} a₂ C B) :
    T2Smooth.{u} a₂ C B :=
  ⟨h.1, fun rho eta n k A h1 h2 h3 h4 h5 h6 h7 h8 h9 F _ _ hchar domain _ ↦
    h.2 rho eta n k A h1 h2 h3 h4 h5 h6 h7 h8 h9 F hchar domain⟩

/-! ## Rules v7.3, lane 1: the fibre case of Lemma R

The definitions are those of the accepted row M-0910 (ryun1, `Q150_FibreCharging.lean`), on a
smooth domain: the fibres are the pairs `{x, -x}`. -/

/-- `w` agrees on `S` with a polynomial of degree below `k`. -/
def Explained {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) (k : ℕ) (w : Fin n → F)
    (S : Finset (Fin n)) : Prop :=
  ∃ p ∈ degreeLT F k, ∀ i ∈ S, w i = p.eval (domain i)

/-- No set of at least `A` points is explained for `f` and for `g` at once. -/
def CoreFree {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) (k A : ℕ) (f g : Fin n → F) : Prop :=
  ∀ S : Finset (Fin n), A ≤ S.card → ¬ (Explained domain k f S ∧ Explained domain k g S)

/-- An anchor: a set of exactly `A - 1` points on which `f` and `g` are both explained. -/
def IsAnchor {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) (k A : ℕ) (f g : Fin n → F)
    (T : Finset (Fin n)) : Prop :=
  T.card + 1 = A ∧ Explained domain k f T ∧ Explained domain k g T

/-- `z` is the label of the incidence `(T, x)`: `f + z g` is explained on `T` with `x` added. -/
def IsLabel {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) (k : ℕ) (f g : Fin n → F)
    (T : Finset (Fin n)) (x : Fin n) (z : F) : Prop :=
  x ∉ T ∧ Explained domain k (fun i ↦ f i + z * g i) (insert x T)

/-- Fibre type relative to `R`: outside `R`, the complement of `T` is a union of pairs `{x, -x}`. -/
def IsFibreType {F : Type*} [Field F] {n : ℕ} (domain : Fin n ↪ F) (R T : Finset (Fin n)) : Prop :=
  ∀ i j : Fin n, domain j = -domain i → i ∉ R → i ∉ T → j ∉ R ∧ j ∉ T

/-- The fibre case on one field at one `h`, with the bound `B`: on a smooth domain of length
`32 h`, rate 1/2, agreement `20 h`, for a core-free pair with some `f + z_u g` explained off a
common defect set `R` of odd size at most `7 h`, the labels of any family of fibre-type anchors
that avoid `R` number at most `B`. -/
def FibreCaseOn (F : Type*) [Field F] [DecidableEq F] (h B : ℕ) : Prop :=
  ∀ domain : Fin (32 * h) ↪ F, IsSmoothDomain domain →
    ∀ f g : Fin (32 * h) → F, CoreFree domain (16 * h) (20 * h) f g →
      ∀ (R : Finset (Fin (32 * h))) (zu : F), Odd R.card → R.card ≤ 7 * h →
        Explained domain (16 * h) (fun i ↦ f i + zu * g i) (Finset.univ \ R) →
        ∀ 𝒜 : Finset (Finset (Fin (32 * h))),
          (∀ T ∈ 𝒜, IsAnchor domain (16 * h) (20 * h) f g T ∧ Disjoint T R ∧
            IsFibreType domain R T) →
          ∀ Z : Finset F, (∀ z ∈ Z, ∃ T ∈ 𝒜, ∃ x, IsLabel domain (16 * h) f g T x z) →
            Z.card ≤ B

/-- The fibre case over M31, at every `h`: at most `C * n` labels. The field with
`(2 ^ 31 - 1) ^ 2` elements is the quadratic extension of M31, which holds the circle domain. A
result supplies `C`, a numeral of at most `2 ^ 20` (over one finite field any count is at most the
field's size, so the constant is capped); `C = 16` is `T3Goal`'s constant. -/
def FibreM31 (C : ℕ) : Prop :=
  C ≤ 2 ^ 20 ∧
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ h : ℕ, 0 < h → FibreCaseOn F h (C * (32 * h))

/-- The instance `n = 32` of the fibre case over M31, with `T3Goal`'s constant: at most 512 labels. -/
def FibreM31At32 : Prop :=
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 → FibreCaseOn F 1 512

/-- The instance `n = 64` of the fibre case over M31, with `T3Goal`'s constant: at most 1,024 labels. -/
def FibreM31At64 : Prop :=
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 → FibreCaseOn F 2 1024

/-- The two instances follow from the fibre case with the constant 16. -/
theorem FibreM31At32_of_FibreM31 (h : FibreM31.{u} 16) : FibreM31At32.{u} :=
  fun F _ _ hF ↦ h.2 F hF 1 Nat.one_pos

theorem FibreM31At64_of_FibreM31 (h : FibreM31.{u} 16) : FibreM31At64.{u} :=
  fun F _ _ hF ↦ h.2 F hF 2 (by norm_num)

/-! ## Rules v7.3, lane 2: list bounds on the native circle code over M31

The native circle code of length `n = 2 k`, as polynomials on the roots of unity of order `n` in
the field with `(2 ^ 31 - 1) ^ 2` elements: degree at most `k` with `P_0 + P_k = 0`. -/

/-- A polynomial of the native circle code of length `2 k`. -/
def IsNativeCircle {F : Type*} [Field F] (k : ℕ) (P : F[X]) : Prop :=
  P.natDegree ≤ k ∧ P.coeff 0 + P.coeff k = 0

/-- At most `B` polynomials of the native circle code of length `2 k` agree with `w` on at least
`A` points of `D`. -/
def NativeListBound {F : Type*} [Field F] [DecidableEq F] (D : Finset F) (k A : ℕ) (w : F[X])
    (B : ℝ) : Prop :=
  ∀ L : Finset F[X],
    (∀ P ∈ L, IsNativeCircle k P ∧ A ≤ (D.filter fun x ↦ P.eval x = w.eval x).card) →
      (L.card : ℝ) ≤ B

/-- The native bound 58 at `m = 3 n / 4`, `n = 64`, over M31: every word `a x ^ 48 + R` with
`deg R ≤ 32` has at most 58 native codewords at agreement 40. Known by a complete search
(M-0923); the lane asks for a proof that is not one. -/
def Interior58 : Prop :=
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ D : Finset F, D.card = 64 → (∀ x ∈ D, x ^ 64 = 1) →
      ∀ (a : F) (R : F[X]), a ≠ 0 → R.natDegree ≤ 32 →
        NativeListBound D 32 40 (Polynomial.C a * X ^ 48 + R) 58

/-- At most three high monomials, at every dyadic `n = 2 ^ r` from 16 to `2 ^ 31`, at agreement
`5 n / 8`: at most `K * n` native codewords. A result supplies `K`, a numeral of at most `2 ^ 20`
(a count of agreement sets gives `2 ^ n` for free). -/
def InteriorThree (K : ℕ) : Prop :=
  K ≤ 2 ^ 20 ∧
  ∀ (F : Type u) [Field F] [DecidableEq F], Nat.card F = (2 ^ 31 - 1) ^ 2 →
    ∀ r : ℕ, 4 ≤ r → r ≤ 31 → ∀ D : Finset F, D.card = 2 ^ r → (∀ x ∈ D, x ^ 2 ^ r = 1) →
      ∀ (m : Fin 3 → ℕ) (a : Fin 3 → F) (R : F[X]),
        (∀ i, 2 ^ (r - 1) < m i ∧ m i < 2 ^ r) → R.natDegree ≤ 2 ^ (r - 1) →
        NativeListBound D (2 ^ (r - 1)) (5 * 2 ^ (r - 3))
          (∑ i, Polynomial.C (a i) * X ^ m i + R) (K * 2 ^ r)

/-! ## Baselines: what ArkLib proves today, in the same shape -/

/-- `LineExactAgreementBound` does not depend on the decidable-equality instance. -/
theorem lineExactAgreementBound_dec {F ι : Type*} [Field F] [Fintype ι] (d₁ d₂ : DecidableEq F)
    {domain : ι ↪ F} {k A : ℕ} {B : ℝ} (h : @LineExactAgreementBound F ι _ d₁ _ domain k A B) :
    @LineExactAgreementBound F ι _ d₂ _ domain k A B := by
  convert h

/-- T1's uniform statement with `1325775 * n ^ 2` in place of `C * n` holds today. -/
theorem baseline_T1Uniform_quadratic :
    ∀ (n k A : ℕ), 2 ≤ n → 0 < k → A ≤ n → (k : ℝ) + (6 / 25 : ℝ) * n ≤ A →
      ∀ (F : Type u) [Field F] [DecidableEq F], (ringChar F = 0 ∨ k - 1 < ringChar F) →
        ∀ domain : Fin n ↪ F, LineExactAgreementBound domain k A (1325775 * (n : ℝ) ^ 2) := by
  intro n k A hn hk hAn hgap F _ _ hchar domain
  exact lineExactAgreementBound_of_exactCorrelatedPair domain _
    (fun f g ↦ exists_uniformFirstOrder_lineMca n k A domain f g hn hk hAn hgap hchar)

/-- ArkLib's general quadratic bound, `C_E(ρ) n² / η⁵` at slack `η` above `firstOrderRateThreshold`:
T1's shape, with one more factor of `n` and a fifth power of `η`, wherever the threshold equals the
curve (`firstOrderCurve_eq_threshold`, `ρ ≥ 11 - 3√13`); below that rate it lies at most 0.0014
above the curve. -/
theorem baseline_T1_quadratic :
    ∀ (rho eta : ℝ) (n k A : ℕ), 0 < rho → rho < 1 → 0 < eta →
      firstOrderRateThreshold rho + eta < 1 →
      0 < n → 2 ≤ k → (k : ℝ) ≤ rho * n →
      (firstOrderRateThreshold rho + eta) * n ≤ A → A ≤ n →
      ∀ (F : Type u) [Field F] [DecidableEq F],
        (ringChar F = 0 ∨ max (k - 1)
          (automaticDerivativeCap rho (firstOrderRateThreshold rho + eta)) < ringChar F) →
        ∀ domain : Fin n ↪ F, LineExactAgreementBound domain k A
          (automaticExceptionBoundConstant rho * n ^ 2 / eta ^ 5) := by
  intro rho eta n k A hrho hrhoOne heta haOne hn hk hkRate hA hAn F _ decF hchar domain
  -- ArkLib states this theorem with classical decidable equality; every instance agrees.
  refine lineExactAgreementBound_dec (fun a b ↦ Classical.propDecidable (a = b)) decF ?_
  let _ : DecidableEq F := fun a b ↦ Classical.propDecidable (a = b)
  exact lineExactAgreementBound_of_exactCorrelatedPair domain _
    (automaticFirstOrder_rate_bounds rho eta n k A hrho hrhoOne heta haOne hn hk hkRate hA hAn
      domain hchar).2

end MCAChallenge
