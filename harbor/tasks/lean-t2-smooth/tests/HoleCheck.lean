/-
Closed-form check of the parameters a Lean result supplies. Run by grade.py after Comparator has
accepted the proof: `lake env lean /tests/HoleCheck.lean`, in the graded project, with
`config.json` (Comparator's config) in the working directory.

Comparator checks a definition hole's name, type, universes and safety, never its body, so a
result could set a constant by choice. This walks each hole's value: constants declared in the
submission are expanded; every other constant must be on the allow list of closed-form
primitives, and never on the deny list (choice, searches, suprema, limits). A constant outside the
allow list fails the check (closed), and is printed so a maintainer can extend the list for a
legitimate closed form. Exit code 1 if any hole is denied.
-/
import Lean
import Submission

open Lean

/-- Not a closed form: choice, unbounded search, suprema, infima and limits. -/
def denied : List Name :=
  [`Classical.choose, `Classical.choice, `Classical.epsilon, `Classical.indefiniteDescription,
   `Classical.inhabited_of_nonempty, `Classical.ofNonempty, `Exists.choose, `Nonempty.some,
   `Set.Nonempty.some, `Nat.find, `Nat.findGreatest, `SupSet.sSup, `InfSet.sInf, `sSup, `sInf,
   `iSup, `iInf, `ConditionallyCompleteLattice.toSupSet, `ConditionallyCompleteLattice.toInfSet,
   `WellFounded.fix, `WellFounded.min, `Function.invFun, `Function.surjInv, `limUnder, `lim,
   `Filter.limsup, `Filter.liminf, `Filter.Tendsto, `Finset.sup', `Finset.inf', `Set.image,
   `Set.range, `Subtype.val, `Quot.out, `Quotient.out, `Trunc.out]

/-- Root namespaces a closed form draws on. Anything else is refused and printed. -/
def allowedRoots : List Name :=
  [`Nat, `Int, `Rat, `Real, `NNReal, `MCAChallenge, `HAdd, `HSub, `HMul, `HDiv, `HPow, `HMod,
   `Neg, `Inv, `Add, `Sub, `Mul, `Div, `Pow, `Mod, `Zero, `One, `OfNat, `OfScientific, `Max, `Min,
   `LT, `LE, `GT, `GE, `Decidable, `ite, `dite, `instHAdd, `instHSub, `instHMul, `instHDiv,
   `instHPow, `instHMod, `instOfNatNat, `instOfNat, `instOfNatAtLeastTwo, `instNatAtLeastTwo,
   `instPowNat, `NPow, `Monoid,
   `DivInvMonoid, `AddMonoid, `Semiring, `Ring, `Field, `DivisionRing, `CommRing, `NatCast,
   `IntCast, `RatCast, `FloorRing, `FloorSemiring, `LinearOrder, `Function, `id, `Eq, `And, `Or,
   `Not, `True, `False, `instLTNat, `instLENat, `instDecidableEqNat, `instDecidableLtNat,
   `instDecidableLeNat, `instMaxNat, `instMinNat, `instNatCastInt, `instAddNat, `instMulNat,
   `instSubNat, `instDivNat, `instModNat, `instPowNat, `Nat.cast, `NonAssocSemiring,
   `NonUnitalNonAssocSemiring, `AddMonoidWithOne, `AddGroupWithOne, `Distrib, `MonoidWithZero,
   `SemigroupWithZero, `Semigroup, `AddSemigroup, `AddCommMonoid, `AddZeroClass, `MulOneClass,
   `MulZeroClass, `Monoid.npow, `DivInvMonoid.zpow, `Lean, `String]

structure Report where
  denied : Array Name := #[]
  unknown : Array Name := #[]
  seen : Array Name := #[]

partial def walk (env : Environment) (submission : Name → Bool) (visited : NameSet) (todo : List Name)
    (r : Report) : Report :=
  match todo with
  | [] => r
  | c :: rest =>
    if visited.contains c then walk env submission visited rest r else
    let visited := visited.insert c
    if denied.contains c then
      walk env submission visited rest { r with denied := r.denied.push c }
    else if submission c then
      match env.find? c with
      | some (.defnInfo d) =>
        let more := d.value.getUsedConstants.toList ++ d.type.getUsedConstants.toList
        walk env submission visited (more ++ rest) { r with seen := r.seen.push c }
      | some (.thmInfo _) => walk env submission visited rest { r with seen := r.seen.push c }
      | some _ => walk env submission visited rest { r with denied := r.denied.push c }
      | none => walk env submission visited rest { r with denied := r.denied.push c }
    else if allowedRoots.contains c.getRoot || allowedRoots.contains c then
      walk env submission visited rest { r with seen := r.seen.push c }
    else
      walk env submission visited rest { r with unknown := r.unknown.push c, seen := r.seen.push c }

/-- A constant counts as the submission's when its module is `Submission` or `Submission.*`, or
when it was declared in the current file (no module index). -/
def inSubmission (env : Environment) (c : Name) : Bool :=
  match env.getModuleIdxFor? c with
  | none => true
  | some idx =>
    let m := env.header.moduleNames[idx.toNat]!
    m == `Submission || m.getRoot == `Submission

def holesFromConfig : IO (List Name) := do
  let text ← IO.FS.readFile "config.json"
  match Json.parse text with
  | .error e => throw <| IO.userError s!"config.json: {e}"
  | .ok j =>
    match j.getObjVal? "definition_names" with
    | .error e => throw <| IO.userError s!"config.json: {e}"
    | .ok arr =>
      match arr.getArr? with
      | .error e => throw <| IO.userError s!"config.json: {e}"
      | .ok names => pure <| names.toList.filterMap fun n => (n.getStr?.toOption).map String.toName

def checkHole (env : Environment) (h : Name) : IO Bool := do
  match env.find? h with
  | some (.defnInfo d) =>
    let r := walk env (inSubmission env) {} (d.value.getUsedConstants.toList) {}
    IO.println s!"hole {h} : {d.type}"
    IO.println s!"  value: {d.value}"
    IO.println s!"  constants: {r.seen.toList}"
    if !r.unknown.isEmpty then IO.println s!"  DENIED (outside the allow list): {r.unknown.toList}"
    if !r.denied.isEmpty then IO.println s!"  DENIED: {r.denied.toList}"
    pure (r.denied.isEmpty && r.unknown.isEmpty)
  | some _ => IO.println s!"hole {h}: DENIED, not a definition"; pure false
  | none => IO.println s!"hole {h}: DENIED, not found"; pure false

#eval show CoreM Unit from do
  let holes ← holesFromConfig
  let env ← getEnv
  let mut ok := true
  for h in holes do
    ok := (← checkHole env h) && ok
  -- `#eval` reports the output as a message; an error makes `lean` exit with code 1.
  if ok then IO.println "HOLES OK" else throwError "HOLES DENIED"
