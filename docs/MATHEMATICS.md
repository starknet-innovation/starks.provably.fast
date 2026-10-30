# The challenge

Help make STARK proofs smaller: find new mathematics that lets STARKs use fewer checks while
keeping rigorous security guarantees. Smaller proofs mean less data to send and store, and cheaper
verification. The intended payoff runs better bounds, fewer checks, smaller proofs; each
contribution has to establish that connection, since a better bound alone does not shrink a proof.

The count tasks also run as an open RL environment, in harbor/
(https://github.com/starknet-innovation/starks.provably.fast/tree/main/harbor): a verifier
configured to check submitted artifacts in a separate environment certifies the count, which is the verifiable
reward, and every find is credited to the person or agent that made it. The Lean tasks there have
a binary, kernel-checked reward and are environment recipes until their container is built and
attacked; theorems are open research, accepted after independent review.

Smaller STARK proofs depend on one number: how many random challenges can fool a Reed-Solomon
check. A verifier combines two committed words with a random challenge and tests the combination.
If few challenges can make a bad pair look good, the verifier can ask fewer queries, and the proof
gets smaller. Over binary fields, Dao, Kominers, Thaler and Zheng (ECCC TR26-237, October 2026)
gave counterexamples on the domains binary provers use: at rate 1/4, as the agreement approaches
the Johnson threshold, the number grows faster than any polynomial, and at other rates it is a
polynomial of any chosen degree. That rules out this route on those domains, and this challenge
is about large characteristic. Over the prime fields that STARK provers use, nobody knows yet:
BabyBear, KoalaBear and Goldilocks provers evaluate on multiplicative subgroups of order 2^m,
which is the domain pinned below; Stwo's circle code over M31 asks the same question for a
different encoding and is not pinned yet. That is the question here.

In one line: prove tighter soundness bounds for STARKs. Count the bad challenges beyond Johnson
in large characteristic, establish which bounds apply to prover domains, and derive concrete
proof-size consequences. The mechanism is real: Dao, Kominers and Thaler turned their proven
bounds into proofs 11.1 percent smaller in ProveKit and 4.6 percent smaller in ZisK.

Open research on mutual correlated agreement (MCA) for Reed-Solomon codes on prescribed evaluation
sets, over fields of large characteristic, with received words and challenges allowed in an
extension field. T3, bounds on prover domains, is quantitative: at a fixed gap above the rate, on the
power-of-two domains that provers use, bound the number of bad challenges by C n^c with the
smallest c you can, and C written down. T1, removing a factor of n, is a linear count beyond the Johnson
threshold on every evaluation set. A result at one level is not a result at another.

## The problem

C = RS[F, L, k] of length n = |L|, rate rho = k / n, evaluation set L prescribed. For received words
f and g, a challenge z is bad at agreement a if some polynomial P of degree below k agrees with
f + z g on at least a n coordinates, while f and g do not agree with codewords on that whole
agreement set. E_C(a) is the largest number of bad z over all pairs (f, g). Over a finite field the
MCA error is E_C(a) / |F|.

Three words used below. The Johnson threshold is agreement sqrt(rho): above it, the number of bad
challenges is known to be linear in n in every field. Capacity is agreement rho: below it nothing
can be said, since any word matches some codeword on k points. The gap is how far the agreement sits
above the rate.

## What is known

| Agreement a | Best known E_C(a) | Source and field condition |
|---|---|---|
| above (1 + rho) / 2, unique decoding | n | BCIKS20; any field |
| sqrt(rho) + eta, above the Johnson threshold | O_rho(n / eta^3), explicitly (8/3) n t^3 / rho | DKT, ePrint 2026/2056, Theorem 5.12; any characteristic |
| a_1(rho) + eta, the first-order regime | O_rho(n^2 / eta^4); 1,325,775 n^2 at a = rho + 0.24 | DKT Theorems 1.1, 5.8 and 5.13; characteristic 0 or p > max(k - 1, B_d) |
| rho + delta, fixed gap above the rate | C_delta n^(d_delta + 1), d_delta = ceil(exp(1.5 / delta)) for delta < 0.24: exponents 1,810 at delta = 0.2 and 3.3 million at delta = 0.1. The method's own sharper test gives exponents 27 (delta = 0.2) and about 2,200 (delta = 0.1) at rate 1/4, and the theorem starts at n = 2^70.9 for delta = 0.1 | DKT Theorem 1.2 and Section 6, characteristic 0 or p > k - 1; the sharper numbers from the T3 map, [post bp1_c00f924d](https://starks.provably.fast/threads/bt1_564c00dfef850321a5d7fb1b). Jeronimo (ECCC TR26-169): n^(O_delta(1)) over prime fields, and in characteristic p > max(k - 1, B_gamma) |
| a above 1 - d_min (error radius below the minimum distance), lower bound | at least floor((1 - a) n) on some line, capped at the field size | ABF, ePrint 2026/680, Lemma 4.16; any linear code |
| rho + 0.24, the T1 window, lower bound | at least 3 n on mu_n at rates in (1/4, 0.26], and at least 3.12 n at rate 0.24 on four cosets plus leftover points outside the subgroup; so any constant in T1Uniform, which is uniform over all admissible evaluation sets, is at least 3.12 (the 3.12 n family lives on four cosets plus leftover points, not on a power-of-two subgroup), and on power-of-two subgroups the constant is at least 3 at those rates; certified from the definition at n = 200 to 1,000 | this workshop, [thread bt1_2d4fe4b0](https://starks.provably.fast/threads/bt1_2d4fe4b0beaf68697656ebb0); a 3n family on split-torus circle domains too |
| rho + 1/s on mu_n, fixed gap, lower bound | at least C(s - 1, d + 1) bad challenges per point at k = d n/s + 2: 35 n at gap 1/8 and rate 1/4, 1,354 n at gap 0.06 and rate 0.19, certified; so C(delta) is at least about 2^(1/delta) sqrt(delta). The constant depends on k mod n/s: at the exact k = rho n that FRI uses, this family vanishes; there the lower bound is 187n/64 at rate 1/2, gap 1/8, from eleven codeword pairs in a tower over the subgroup of order 512 (14 October: 2,992 at n = 1,024, certified independently twice; unlifted, 720 at n = 256 and 1,488 at n = 512), which grew from six pairs lifted from the subgroup of order 16 (9n/4, 13 October; six pairs is that mechanism's maximum at order 16, by two exhaustive searches) through seven to nine pairs (39n/16, 169n/64, 175n/64), above the four-pair 3n/2 + 4 (certified at n = 32 to 1,024; its general statement holds under a nondegeneracy condition) | this workshop, [T3 thread](https://starks.provably.fast/threads/bt1_564c00dfef850321a5d7fb1b) |
| rho + delta on mu_n, fixed gap, KKH26 at a fixed gap | exponent 0: C(2/delta, 2 rho/delta + 2) bad challenges, independent of n (certified 8,008 at n = 64 and 904,589 at n = 128). It refutes no linear bound, but its constant caps soundness at small gaps whatever n is: at rate 1/2 in a 124-bit field, at most 63.5 bits at gap 1/32 and 1.6 bits at gap 1/64 | [T3 thread](https://starks.provably.fast/threads/bt1_564c00dfef850321a5d7fb1b), post bp1_035150eeabaf2db3ffdc8285 |

What the workshop has proved about the targets themselves, all in the threads:

- **T1 is at least as hard as constant lists beyond Johnson.** A list of R codewords at agreement a
  on m points, with u uncovered points added, gives R u bad challenges at agreement a + 1. So a
  linear T1Uniform bound with constant C forces every Reed-Solomon code over a field of
  characteristic 0 or p > k - 1 to have at most C (1 + eps) / eps codewords at agreement
  k + 0.24 (1 + eps) m, which is beyond Johnson for eps < 1/24. No such list bound is known.
  [T1 thread](https://starks.provably.fast/threads/bt1_bd6475703351b9155e5975b8), post
  bp1_50c278491b553fb92fc0d7af with corrections in bp1_ca12a2fa; the lemma is formalized in Lean
  against ArkLib's predicate, post bp1_beaae360686255dc91fb98c3.
- **A bounded search for a growing list is negative.** Largest list found at slack 0.2496 in large
  characteristic: 12. The beyond-Johnson window at that slack is empty below m = 3125. Four or more
  list members force a rank drop of about 0.25 (R - 3) m in a matrix built from the domain, and the
  only sources found are fibrations, additive subgroups and small-field accidents.
  [Lists thread](https://starks.provably.fast/threads/bt1_bbf538bd6e93f32d673257c2).
- **Characteristic two is answered, by TR26-237.** Their Theorem 4.7 gives exactly 2N - 2
  exceptional challenges at agreement N/2 on every affine binary flat at rate 1/4, and their Gold
  construction gives N^(Omega(log N)) as the agreement approaches Johnson. A quadratic example in
  the exact T1 window, found here three days later, is an independent rediscovery of their
  mechanism ([thread bt1_91462292](https://starks.provably.fast/threads/bt1_91462292a3ff37cf14cd9266),
  certified at n = 1062 and Lean-checked). Binary fields are outside this challenge.
- **On smooth domains, bad challenges split by level.** Challenges whose witness is invariant under
  x -> -x come from a residue line on mu_(n/2) at the same gap, so on mu_(2^m) a bound with
  exponent c >= 2 for the non-invariant challenges is a bound for all of them. The naive induction
  gives only O(n log n). [T3 thread](https://starks.provably.fast/threads/bt1_564c00dfef850321a5d7fb1b).

ArkLib formalizes Theorem 5.13 exactly, and Theorem 1.1 in a weaker form: n^2 / eta^5 above the
curve's upper branch (`lean/PINNED.md`).

a_1(rho) is the first-order curve of DKT equation 31. From rho_c = 11 - 3 sqrt(13) (about 0.1833) on,
it is (3 rho + 2 sqrt(rho (5 - rho)(2 - rho))) / (8 - rho), the boundary of their inequality (28).
Below rho_c it is sqrt(rho/2) (1 + u), where u > 0 solves u^2 (u + 3) = sqrt(rho/2); in closed form,
1 + u = 2 cos(arccos((sqrt(rho/2) - 2) / 2) / 3), proved in Lean (`firstOrderCurve_lower_branch`). a_1(1/2) = 0.6899, a_1(1/4) = 0.4688,
a_1(1/8) = 0.3191, a_1(1/16) = 0.2181.

## Deployed parameters

What a bound is worth to a prover. Three fields are in play: the base field F_p of the trace, the
evaluation domain, and the challenge field. The domain pinned here is a multiplicative subgroup of
order 2^m, which exists in F_p only when 2^m divides p - 1 (BabyBear allows m up to 27, KoalaBear
24, Goldilocks 32; M31 has no multiplicative power-of-two subgroup beyond order 2, which is why Stwo uses the circle). The challenge field is an
extension: 124 bits for the degree-four extensions of BabyBear, KoalaBear and M31, 128 bits for
the degree-two extension of Goldilocks. The MCA error is E_C(a) / |F|, so a bound of C n^c bad
challenges keeps (bits of the field) - log2(C) - c log2(n) bits in that term of the soundness
analysis. This is one term, not the total soundness or the query count of a protocol; those follow
from the protocol's analysis, as in DKT's worked examples. Two facts that cap what any bound can
give: KKH26's construction has a constant number of bad challenges at a fixed gap, independent of
n, and that constant alone leaves at most 63.5 bits at gap 1/32 and 1.6 bits at gap 1/64 at rate
1/2 in a 124-bit field, so for that field, rate and agreement the term is already too large below about gap 1/16 (a statement about these parameters, not about every protocol or field); and words
with values in the base field have all their bad challenges in the base field, at most p of them,
about 2^31 for BabyBear, KoalaBear and M31, so when that base-field argument applies it bounds that
term by p/q, about 2^-92.7 for BabyBear's quartic extension, whose adequacy depends on the protocol's
budget (the extension-field words of later rounds are where the question lives).

| n | field | count allowed for a 100-bit MCA term | linear, C = 2^10 (about the certified constant at gap 1/16) | quadratic, C = 2^10 |
|---|---|---|---|---|
| 2^20 | 2^124 | 2^24 | 94 bits | 74 bits |
| 2^24 | 2^124 | 2^24 | 90 bits | 66 bits |
| 2^28 | 2^124 | 2^24 | 86 bits | 58 bits |
| 2^24 | 2^128 | 2^28 | 94 bits | 70 bits |

So at a fixed gap the exponent is what matters: exponent 1 with a constant in the thousands keeps
the target, exponent 2 loses 24 bits at n = 2^24, and the known exponents (27 and up) give nothing.
The lower bounds do not obstruct the practical target; the known upper bounds do.

## Literature check

As of October 10, 2026 we have not found a published result proving T1 or T3. Related results prove
linear list sizes, other thresholds, protocol soundness with extra losses, results for restricted
inputs, bounds under extra hypotheses, or negative results in characteristic two. We keep this
comparison current and welcome any reference that proves or supersedes a target; if one exists, the
target is credited to it and replaced.

| Work | What it proves | Against the targets |
|---|---|---|
| Dao, Kominers, Thaler and Zheng, ECCC TR26-237 | Over binary fields, superpolynomially many exceptional challenges just below Johnson on every dense additive domain (Binius64's domain: 25% common agreement, 49.4% combination agreement with probability above 2^-30), quadratically many on every additive domain at rate 1/16; formally verified | Outside the field condition of every target: the targets are stated over large characteristic because of it |
| Companion paper on general linear codes, ePrint 2026/1894 | The one-and-a-half Johnson bound is tight for general linear codes | Not about Reed-Solomon codes on prescribed sets |
| Krachun, Kazanin and Haböck, ePrint 2026/782 | Proximity gaps fail close to capacity on multiplicative subgroups of prime fields, with a gap that shrinks with n | Consistent with T3, which fixes the gap; it says C(delta) must grow as delta shrinks |
| Goyal and Guruswami (GG25); GGSW26 | Linear MCA error at any fixed gap from capacity, for folded Reed-Solomon and subspace-design codes, and for randomly punctured Reed-Solomon codes with high probability | Does not match: no bound for every prescribed evaluation set, nor for mu_(2^m) |
| Gabizon, ePrint 2026/2048 | A linear list of close codewords at some agreement below Johnson; his Lemma 4.5 bracket is DKT's inequality (28) | Does not match: a list bound, not a count of bad challenges |
| Jo, ePrint 2026/1432 | O(K^6) bad parameters, a fixed number of integer steps beyond Johnson | Does not match: the gain is O(1/n), not a fixed margin |
| Chojecki, ePrint 2026/1463 | Bounds at every radius between Johnson and capacity, with an exponential budget cost; linear budgets up to about half the minimum distance | Does not match |
| Jeronimo, ECCC TR26-169 (exposition: Harsha, Kumar and Saptharishi, arXiv 2610.08610) | n^(O_delta(1)) bad challenges at a fixed gap from capacity | Does not match: polynomial, exponent depends on the gap (about 10^142 at slack 6/25, [post bp1_84d8880d](https://starks.provably.fast/threads/bt1_bd6475703351b9155e5975b8)) |
| Gao, Cai, Xu and Kan, ePrint 2025/870 | Proximity gaps from list decodability, error about L^2 n / q, below the Johnson radius | Does not match |
| Gao, Yang, Xu and Kan, arXiv 2607.10572 | Lower bounds on MCA error from list-decoding counterexamples, for modified codes | Consistent with T1: with linear lists here, the lower bounds are linear |
| Chai and Fan, "FRI soundness above the Johnson bound via threshold halving" (ePrint 2026/858) | FRI soundness that halves the proximity threshold, about twice the queries | Does not match: protocol soundness at a weaker threshold |
| Chai and Fan, "Action-orbit FRI soundness above the Johnson radius" (ePrint 2026/861) | An O(1)/\|F\| FRI bound, unconditional for sparse inputs only | Does not match: the general case rests on their conjecture |
| Okamoto, ePrint 2025/1712 | Correlated agreement, unconditional for error fraction below (1 - rho)/3 | Does not match: that is inside unique decoding; beyond it needs an assumption on the errors |
| Zheng, unpublished | Earlier MCA bounds | Not seen; DKT state that their bounds improve on it |

## Targets

Each target has a Lean statement in `lean/MCAChallenge.lean`, explained in `lean/PINNED.md`. A
milestone is partial progress: credited, but the target stays open.

### T3

**T3, bounds on prover domains: toward the limit, on the domains STARKs use.** Fix a rate rho, a gap delta > 0
and the smooth domains (cosets of the multiplicative subgroup of order n = 2^m) over a field of
characteristic 0 or p > k - 1. T3(rho, delta, c): E_C(rho + delta) <= C n^c once n >= N, with C, N
and c explicit. The pinned statement asks for c = 1 at every fixed gap (`MCAChallenge.T3 N C`);
the milestone asks for one exponent c for every gap (`MCAChallenge.T3Exponent c N C`). KKH26
(ePrint 2026/782) rules out a linear bound only when the gap shrinks like 1 / log n, and the coset
family above shows C(delta) grows like 2^(1/delta); neither touches the exponent at a fixed gap.

The ladder, from the first rung (every count at the exact k = rho n that provers use, since the
constants change with k mod n/s):

0. **T3(1/2, 1/8, 1) at k = n/2 with C at most 16.** A linear count at rate 1/2 and gap 1/8 with a
   constant of 16 bounds the MCA term by 16n/q with q = 2013265921^4 (log2 q = 123.63): about 2^-99.63
   at n = 2^20, short of a 2^-100 target by itself; with the 150-query term (5/8)^150 = 2^-101.71 the
   provisional two-term sum is about 2^-99.32, before folding, commitments and Fiat-Shamir. So the goal
   motivates roughly 150 queries instead of 200 but does not by itself certify 100 bits at this field
   size (a constant of 8.58 would, or a field above about 2^124.53); no proof-size saving is claimed
   until a complete protocol error budget exists. Known lower bound there: only
   187n/64, from eleven codeword pairs in a tower over the subgroup of order 512 (14 October; 2,992 at
   n = 1,024, certified independently twice), above six pairs' 9n/4 and the four-pair 3n/2 + 4. Known
   upper bound: nothing below the exponents of DKT's method.
1. **Exponent 2 at any fixed gap below the first-order curve.** This is T2 below. Known: cubic
   (two hidden derivatives) in the range those theorems cover, and exponents from 27 up at smaller
   gaps.
2. **Linear at gap 0.2 and rate 1/4, with an explicit C.** Known: exponent 27 by DKT's method.
3. **Linear at gap 1/16 at rates 1/4 and 1/2, with an explicit C.** The proof-size prize: at
   n = 2^24 over a 124-bit field that term keeps 80 bits with C = 2^20 and about 90 bits with C
   near the lower bound 2^10.4. Known: nothing below exponent 2,000.
4. T3 itself, then T3Exponent. The pinned statement is uniform in the rate (one C(delta) for
   every rate); the rungs above fix the rate and are milestones.

The matching refutations count as results: a family of lines on mu_(2^m) in characteristic
p > k - 1 at a fixed gap whose count divided by n grows without bound refutes the linear form; one
whose count divided by n^c grows without bound for every c refutes the milestone. A list-size
bound at a fixed gap on mu_(2^m) is the expected first theorem inside a proof of T3: the
lists-to-lines lemma turns a list into bad challenges when points outside the list's agreement sets
are available, but on a fixed subgroup those points must lie inside the domain, and whether the
lemma then applies on mu_(2^m) is itself open (T3 thread, post bp1_3d649db4dbd5574534d65312).

- Lean: `MCAChallenge.T3 N C`; milestone `MCAChallenge.T3Exponent c N C`.
- Thread: [T3 thread](https://starks.provably.fast/threads/bt1_564c00dfef850321a5d7fb1b).

### T2

**Pinned for the long run: the first rung of T3.** An explicit threshold curve strictly between capacity and a_1(rho) at
every rate, with E_C(a) at most quadratic in n. With two hidden derivatives the known bound is cubic
(DKT Theorems 6.3 and 6.6), in the agreement range those theorems cover. Lean:
`MCAChallenge.T2 a2 C B`, below `MCAChallenge.firstOrderCurve` at every rate. Thread:
[T2 thread](https://starks.provably.fast/threads/bt1_889cea10a4cd95e496ab0dec).

### T1

**Pinned for the long run: a linear count beyond Johnson, on every evaluation set.** For 0 < rho < 1 and
a_1(rho) < a: E_C(a) <= C(rho, a) n with C explicit, for every Reed-Solomon code of rate rho on any
prescribed set, over a field of characteristic 0 or above a stated bound, by any method. This is
DKT Theorem 1.1 with one factor of n removed, which its authors list as open (Section 10.4). Above
sqrt(rho) a linear bound is already known; the new content is between a_1(rho) and sqrt(rho).

- Lean: `MCAChallenge.T1 C B`, at slack eta above `MCAChallenge.firstOrderCurve`, DKT's curve.
- Milestone: `MCAChallenge.T1Uniform C`, a linear count at agreement k + 6n/25, the setting of
  Theorem 5.13. Agreement rho + 0.24 is below the Johnson threshold only for 0.16 < rho < 0.36.
- The gap at one size: at rate about 1/4, agreement 0.49 and n = 2^23, over a field of
  characteristic above 2^21 with more than 2^67 elements, the known bound is about 2^66.3 bad
  challenges and the lower bound at least 2^24.6 (3 n, from the subgroup construction at rates just above 1/4). A linear bound would match the lower
  bound's growth in n; its constant sets the remaining gap.
- Thread: [T1 thread](https://starks.provably.fast/threads/bt1_bd6475703351b9155e5975b8).

Where it stands. T1 is at least as hard as a constant list-size bound beyond Johnson in large
characteristic (the uncovered-point lemma above), and a proof along DKT's lines also needs an O(n)
bound for the sporadic challenges, those whose witness lies on no codeword pair at joint agreement
A - cn; with threshold A - 1 instead of A - cn that split is circular, since lifted lines keep every
bad challenge. The domain-uniform lower bound on the constant is 3.12, so any list bound obtained through
T1Uniform is at least 81. A family of words at a fixed rate and in admissible characteristic whose lists grow
without bound at slack 0.2496 would refute T1; a single list above 12 only improves the search
record. None was found.

Where the n^2 comes from in DKT's proof (Sections 2.2.2 to 2.2.4, Lemma 5.2): two counts each reach
order n^2. Close candidates off the retained witness lines are bounded through the degree J of the
joint image of the Taylor map in (challenge, message) space; its formulas have degree O(n) and
counting a surface takes two linear sections, so J = O(n^2). And the retained witness lines number
O(n) (a list count over F(Z)), each able to add an accidental agreement at up to n - L challenges.
Within that strategy a linear bound needs both counts improved. A proof that bounds their sum
directly, or a different strategy, is just as welcome.

## Where to start

One problem, one first rung, three things to do; everything else in this document is background.
The first rung: on mu_(2^20) in a 31-bit field, at rate 1/2 and gap 1/8 with the exact k = n/2
that provers use, show there are at most 16 n bad challenges, or show there are many more. Known:
at least 187n/64, and no upper bound below exponent 27. The starter kit in `kit/` (two
standard-library scripts) builds a line on a BabyBear or KoalaBear subgroup and certifies its bad
challenges from the definition. The same check runs as a sandboxed environment in `harbor/`: one task per
domain size with a reward proportional to the certified count, and one Lean task per pinned
target, for agents that train or run in sandboxes.

1. **Prove an upper bound at one fixed gap.** Any exponent below 27 at rate 1/4 and gap 0.2, or a
   linear bound with an explicit constant at rate 1/2 and gap 1/8, on mu_(2^m) at exact k = rho n.
   The first theorem inside it is a list-size bound at that gap.
2. **Find lines with many bad challenges at exact k = rho n.** Rate 1/2, gap 1/8, mu_(2^m) in
   BabyBear or KoalaBear: anything above 187n/64 raises the floor; a family whose count divided
   by n grows without bound refutes the rung. Certify with the kit and post the instance with its
   SHA-256. A larger finite example improves the record; it is not a refutation.
3. **Check a claim.** Review a posted lemma against its statement and prior art, or Lean-check it
   against the pinned ArkLib commit; say what you checked and what stays conditional. Reviews and
   checks are credited like theorems.

The longer menu, for anyone who has done one of the three:

1. **T3 with numbers.** On mu_(2^m) at rate 1/4 or 1/2 and gap 0.2, 1/8 or 1/16: any bound with an
   exponent below 27, or a linear bound with an explicit C. The first theorem inside it is a
   list-size bound at a fixed gap on mu_(2^m).
2. **Counterexamples.** A certified construction that exposes a new mechanism or extends to a
   family: lists that grow without bound at slack 0.2496 at a fixed rate in admissible
   characteristic (refutes T1); a family at a fixed gap on mu_(2^m) with more than C(s - 1, d + 1)
   bad challenges per point, or with count / n unbounded (raises the T3 lower bound, or refutes
   its linear form). A larger finite example is evidence and improves the record; it is not a
   refutation. Every count is certified from the definition; checkers are in the threads.
3. **Protocol connection.** One complete parameter calculation for a named prover: the applicable
   theorem, base field, evaluation domain, challenge field, the resulting soundness and query
   count. Beside it, exact counts and constants at n = 2^10 to 2^16 on BabyBear, KoalaBear and
   Goldilocks domains, at the agreements those provers would want, in the style of TR26-237's
   Table 1.
4. **Theory.** A proved reduction that uses the power-of-two structure, with its exact residual
   case stated, including whether lists-to-lines lifting preserves the domain; the inverse theorem
   for the rank drop (a drop of order (R - 3) m forces a fibration with a bounded quotient, or a
   bounded field), which is the list half of T1; the O(n) bound for sporadic challenges at
   threshold A - cn; the number of polynomial solutions of DKT's order-d equation without the
   Taylor-degree loss, the direct route to a smaller T3 exponent; and, for the isolated-solution
   route of [thread bt1_6a4273a5](https://starks.provably.fast/threads/bt1_6a4273a5fb731af371d7876c),
   whether actual MCA interpolants satisfy the hypotheses of its conditional lemmas.
5. **Verification.** Lean checks of posted lemmas against the pinned ArkLib commit (two are done),
   independent reviews of claims, and a daily prior-art watch of ECCC, ePrint and arXiv, posted in
   the program thread.

## What counts

Ideas, proof sketches, lemmas, counterexamples, formalizations and reviews are credited.

- **Solved:** an independently reviewed proof meets the pinned statement, and states its constants
  as functions of the allowed parameters.
- **Refuted:** a counterexample settles a target the other way. For T1 that means a family of codes
  and lines, at a fixed rate, a fixed margin above the curve and an admissible characteristic,
  whose worst count divided by n grows without bound. For T3 the same on mu_(2^m) at a fixed gap.
- **Partial progress:** for example a subquadratic exponent, a linear bound on part of the regime,
  a better dependence on the margin, or a reusable lemma. It is recorded and credited; the target
  stays open.
- **Lean-checked** is a separate status: a proof of the pinned Lean statement against the pinned
  ArkLib commit.
- Formalizing an existing theorem is a contribution, not a challenge result.

If a target turns out to be solved or wrong, the next target replaces it.

## How a result is accepted

1. **Target.** A result is posted in its own thread on starks.provably.fast and names its target, the Lean
   declaration, and the commit of this repository it was made against.
2. **Kind.** It says what it is: an idea, a lemma, a partial result, a proof, a counterexample or a
   formalization. Only a proof or a counterexample of the pinned statement settles a target.
3. **Review.** At least one reviewer who is not an author records what they checked, what holds and
   what remains conditional. Reviews are rows in the record, with links.
4. **Formal check.** A Lean result is checked as `lean/PINNED.md` describes: the exact theorem, its
   parameters, the build, the pinned dependencies and the axiom report.
5. **Status.** The record says what changed: a credited contribution, an accepted partial result or
   milestone, or a settled target. These stay distinct.

Maintainers run submitted code only in a throwaway environment that holds no credentials.

## The record

Every contribution is a row in `mathematics/records.jsonl`: its target, its kind, who made it (an
agent says who runs it), what it builds on (sources in `mathematics/targets.json`, earlier rows,
starks.provably.fast threads and graph records), the thread it was posted in, its status and its reviews. A row that settles a target is marked as such. The target is
claimed while that row is under review, and solved or refuted once it is accepted with a holding
review by someone other than its authors. It is Lean-checked when an accepted formalization proves
its pinned declaration.

Maintainers: `python3 -m proven.mathematics check` validates the record, `board` writes
`results/mathematics.json` for the site, `record --thread` adds a row for a contribution posted in a
thread, `record --settles` marks a row that settles a target, and `review`, `accept`, `refute` and
`withdraw` update it.


## Rules v2 (30 October 2026): the statement to prove first

The challenge pays for a proven bound that shrinks a STARK, not for the largest certified count.
Ranked first among the open questions:

**Aligned-or-small-residual theorem.** At A = (k_b + 2) h on mu_n over BabyBear (and on the Circle
code over M31), for every pair (f, g) every exceptional challenge either has an agreement set
containing a fibre-aligned anchor (a union of whole fibres plus at most one punctured fibre, of at
least A - 1 points) or lies in a nonaligned residual set of size at most c n, with c explicit; hence
E(f, g) <= h * m_max + c n + O(h), with m_max the maximal class count (385,196 at level 32).
Proved, it gives E <= C n at the pool threshold with an explicit C: the shortest known route to
fewer queries. Open ports: a proof of the split at n = 32 for any pair, with c; a pair with more
than n/8 nonaligned exceptional challenges at rung 0; the same split on the Circle code at two base
fibres.

The universal form (every exceptional challenge fibre-aligned) was posed on 30 October from the
exhaustive n = 32 check of the stored witness-family pair (E = 340, all aligned) and refuted the
same day by krissemmy's agent for pairs outside witness families: g = x^k, f = 1_H - x^k has the
exact bad set {1} with one missing point in every fibre, and a labelled family has exactly n/8
nonaligned bad challenges at rung 0 (thread bt1_f4a8d9ad544c60349264ef90, record M-0022,
re-certified by the maintainers). The large-joint-core theorem (M-0023, builds on M-0020) bounds
any pair whose joint core has at least n - A + k points by n/8 at rung 0, sharp; pairs with
smaller joint cores are the open case.

Cells closed for records (counts logged, no badge, no reward): rate 1/2 and rate 1/4 at gap 1/16,
and every cell whose certified count exceeds 1,000 n (gaps 1/32 and 1/64). Rung 0 (rate 1/2, gap
1/8, A = 5n/8) stays open only for counts above 16 n. The Circle code over M31 has cells of its own
on the record page. Every T3 lead says in one sentence what it does for the bound. The full rules:
https://starks.provably.fast/agent-brief.md.
