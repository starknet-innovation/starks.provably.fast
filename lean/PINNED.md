# Lean statements

The targets T1, T2 and T3 are stated in Lean in [`MCAChallenge.lean`](MCAChallenge.lean), against
[Verified-zkEVM/ArkLib](https://github.com/Verified-zkEVM/ArkLib) at
`35ddcaa83f683011f944f58904be779495a5709a` (Apache-2.0), pinned in [`lakefile.toml`](lakefile.toml).
Contributors prove the statement we pin; they never choose it.

Every quantitative parameter is an argument of the statement: constants, curves, characteristic
bounds and minimum lengths. A Lean result supplies them in closed form, and the proof itself may
reason classically. It compiles against the pinned commit and uses no axioms beyond `propext`,
`Classical.choice` and `Quot.sound`. Lean-checked is a status shown beside a solved target; a target
is solved by an independently reviewed proof, with or without Lean.

| | Lean declaration | What it asks | Already in ArkLib |
|---|---|---|---|
| T1 | `MCAChallenge.T1 C B` | agreement at least (a1(rho) + eta) n, k at most rho n, characteristic 0 or above max(k - 1, B rho eta): at most `C rho eta * n` bad challenges on every line | `ReedSolomon.automaticFirstOrder_rate_bounds`: C_E(rho) n^2 / eta^5 above the curve's upper branch (`baseline_T1_quadratic`) |
| T1 milestone | `MCAChallenge.T1Uniform C` | agreement at least k + 6n/25, characteristic 0 or above k - 1: at most `C * n` | `ReedSolomon.exists_uniformFirstOrder_lineMca`: 1,325,775 n^2 (`baseline_T1Uniform_quadratic`) |
| T2 | `MCAChallenge.T2 a2 C B` | a curve a2 strictly between capacity and a1 at every rate, with at most `C rho eta * n ^ 2` | nothing below a1 with a quadratic count |
| T3 | `MCAChallenge.T3 N C` | smooth domains (cosets of the subgroup of order 2^m), every gap delta above capacity, n at least `N delta`: at most `C delta * n` | `ReedSolomon.exists_capacity_lineAgreement`: C n^(d + 1) on any domain, d depending on delta |
| T3 milestone | `MCAChallenge.T3Exponent c N C` | as T3, with at most `C delta * n ^ c` for one exponent c | as above |
| T3 first goal | `MCAChallenge.T3Goal N` | rate 1/2 with the exact k = n/2, agreement at least 5n/8, smooth domains, n at least N: at most `16 * n`; `T3Goal_of_T3` derives it from any T3 result with C(1/8) at most 16 | nothing below the exponents of DKT's method |
| Lane 3 (rules v7.3) | `MCAChallenge.T1Smooth C B`, `T2Smooth a2 C B` | `T1` and `T2` on smooth domains only, the hypothesis `IsSmoothDomain` that T3 carries | the bounds for every evaluation set, above |
| Lane 3 milestone | `MCAChallenge.T1UniformSmooth C` | `T1Uniform` on smooth domains only | as above |
| Lane 1, the named statement | `MCAChallenge.FibreM31 C` | the fibre case of Lemma R over M31 at every h, common defect set of odd size at most 7h: at most `C * n` labels of fibre-type anchors, C at most 2^20 | nothing; the record has packing counts (M-0910) and caps for larger defect sets (M-0928) |
| Lane 1 instances | `MCAChallenge.FibreM31At32`, `FibreM31At64` | the same at n = 32 (at most 512 labels) and n = 64 (at most 1,024) | nothing |
| Lane 2, the named statement | `MCAChallenge.Interior58` | over M31 at n = 64, at most 58 native codewords agree with `a x^48 + R` on 40 points | nothing; known by a complete search (M-0923) |
| Lane 2, after it | `MCAChallenge.InteriorThree K` | over M31 at every dyadic n from 16 to 2^31, at most `K * n` native codewords at agreement 5n/8 for a word with at most three high monomials, K at most 2^20 | nothing |

a1 is `MCAChallenge.firstOrderCurve`, the first-order curve of Dao, Kominers and Thaler (ePrint
2026/2056, equation 31), with the lower branch in closed form; `firstOrderCurve_lower_branch` proves
that the closed form solves their equation (30). ArkLib's
`ReedSolomon.HiddenDerivative.firstOrderRateThreshold` is the upper-branch formula
(3 rho + 2 sqrt(rho (5 - rho)(2 - rho))) / (8 - rho) at every rate. It equals the curve for rho at
least 11 - 3 sqrt(13) (`firstOrderCurve_eq_threshold`) and lies above it by at most 0.0014 below that
rate. So ArkLib's general baseline covers T1's shape only from that rate on.

The lane statements of rules v7.3 (15 November 2026) were added beside the targets; no earlier
declaration changed. The fibre case uses the definitions of the accepted row M-0910 (ryun1) on a
smooth domain, where the fibres are the pairs `{x, -x}`. The statements over M31 fix the field by its
size, `(2 ^ 31 - 1) ^ 2`: over one finite field every count is bounded by a constant, so the
constants `C` and `K` are capped at `2 ^ 20` inside the statement.

Rules v7.4 (15 November 2026) add no statement. They say which pinned statements earn what: `T1UniformSmooth`,
`T1Smooth`, `T2Smooth`, `T3Exponent`, `T3` and `T3Goal` at full weight with points doubled; `FibreM31` and
`InteriorThree` at full weight; `FibreM31At64` and `Interior58` at a quarter. `FibreM31At32` is proved (row M-0957).
A module that proves no pinned statement is checked with the target `LEMMA`: every declaration is replayed in
the kernel, and no statement is compared.

The targets T1, T2 and T3 use ArkLib's `LineExactAgreementBound`. For every received line f + z g there is one
exceptional set of at most B challenges. Outside it, every polynomial of degree below k that agrees
with the line in at least A places splits as P0 + z P1, where f agrees with P0 and g with P1 on
that whole agreement set.

## Challenge templates

[`challenges/`](challenges/) holds one template per pinned declaration, with the statement's
parameters as definition holes (`def N : ℕ := sorry`) and `theorem solution.{u}` to prove. A result
is a copy of the template with every `sorry` replaced; [`challenges/index.json`](challenges/index.json)
lists the holes comparator checks. The same templates are the Lean tasks of the Harbor environment
in [`../harbor/`](../harbor/), where a sandboxed verifier runs comparator and then reads the holes
for closed form.

## How a Lean result is checked

A Lean result is a file that proves one pinned statement for parameters it defines, for example
`theorem solution : MCAChallenge.T1 C B` with `C` and `B` defined in the same file. Maintainers check
it with Lean FRO's [comparator](https://github.com/leanprover/comparator). The challenge file states
the same theorem with `C` and `B` left as holes, importing `lean/MCAChallenge.lean` at the named
commit, unchanged. Comparator checks that the solution fills the holes with the same names and
types, proves the statement, uses only `propext`, `Classical.choice` and `Quot.sound`, and passes
the kernel on replay; it builds in a sandbox. Comparator cannot tell a closed form from a disguised
answer, so a reviewer reads the parameters. A result that edits `lakefile.toml`,
`lake-manifest.json`, `lean-toolchain` or `MCAChallenge.lean` is not checked.

## Build and check

`lake-manifest.json` pins every dependency.

    cd lean
    lake exe cache get    # Mathlib's prebuilt files
    lake build

To check a proof, import `MCAChallenge` in a file of your own and run `#print axioms` on your
theorem with `lake env lean YourFile.lean`; it must list only `propext`, `Classical.choice` and
`Quot.sound`.

Checked 2026-10-08: `MCAChallenge` compiles against the pinned ArkLib with no warnings, and the
baselines and both `firstOrderCurve` lemmas use only the three standard axioms. The targets are
open. ArkLib's own build prints two `sorry` warnings, in `ArkLib/Data/Fin/Basic.lean` and
`ArkLib/Data/MvPolynomial/Interpolation.lean`; `#print axioms` confirms neither is used here.


Checked 2026-11-15, with the lane statements of rules v7.3: `MCAChallenge` compiles against the pinned
ArkLib with no warnings, and each of the eight new templates typechecks with its `sorry`s in place.
