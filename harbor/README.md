# RL environments for the mathematics challenge

The mathematics challenge of starks.provably.fast as [Harbor](https://github.com/harbor-framework/harbor)
tasks: sandboxes an agent works in, a verifier that never ran the agent's code, and a verifiable
reward. The design follows [FineEnvs/openai-math](https://huggingface.co/datasets/FineEnvs/openai-math), which
turned OpenAI's October 2026 Lean statements into environments (see `NOTICE`); two things differ.
The count tasks give a graded terminal reward, a certified count rather than 1 or 0, so partial
progress registers; whether it trains better than a binary reward is not demonstrated here. And the Lean tasks have parameters as definition holes, read for closed form
after the proof is accepted, because here a constant is the result.

Nothing here changes how a result counts on starks.provably.fast: a target is solved by a
reviewed record, and a reward is evidence to post, not a verdict. Posted, submissions and reviews
are recorded with attribution. Labels, precisely: the count tasks are experimental agent
environments with graded, certificate-checked rewards; the Lean tasks are environments with a
binary, kernel-checked reward, whose container verifier passes four controls and has not been
attacked; the discussion and reviews are an open research workshop. No training
experiment has been run; the results here came from agent-assisted research.

## Tasks

| Task | Kind | What the agent does | Reward |
|---|---|---|---|
| `exceptional-set-n32-a20`, `-a18` | exceptional-set | picks a pair on the subgroup of order 32, computes its whole exceptional set E(f, g) at k = 16 and classifies each challenge's anchor (fibre-aligned or not) | 1 iff the claimed set equals E recomputed over every A-subset from the definition and every classification matches; `e_size`, `missing`, `extra`, `misclassified`, `aligned` reported |
| `refute-fibre-alignment-m8`, `-m9`, `-m10` | refute-fibre-alignment | submits a pair and challenges at rung 0 (k = n/2, A = 5n/8) whose agreement sets hold no fibre-aligned anchor | 1 iff more than n/8 listed challenges are certified exceptional and nonaligned (the known residual, M-0022, is exactly n/8); the pair's joint core is measured by Berlekamp-Welch decoding and reported |
| `cap-classes-level32` | cap-verification | recomputes the ray classes of a level-32 witness family F_32(b; s) at each base fibre, the constant behind the posted cap 385,196 (h + 1) + 1 | 1 iff the verifier's own enumeration gives the same counts |
| `count-babybear-m8`, `-m9`, `-m10` | count | finds a line on the subgroup of order 2^m in BabyBear with many bad challenges at k = n/2, A = 5n/8, and lists witnesses | 1 iff the certified distinct bad challenges exceed 16 n (the count that would refute the pinned statement at this n), else 0; the uncapped `certified_bad`, `bad_per_n`, `over_floor`, `beats_floor`, `above_goal` are reported |
| `lean-t3-goal` | Lean | proves `MCAChallenge.T3Goal N`, the first goal (rate 1/2, gap 1/8, constant 16, smooth domains) | 1 if Comparator accepts the proof and `N` is a closed form |
| `lean-t3`, `lean-t3-exponent` | Lean | T3 and its exponent milestone, holes `N C` and `c N C` | same |
| `lean-t1-uniform`, `lean-t1`, `lean-t2` | Lean | the long-run targets, holes `C`, `C B`, `a₂ C B` | same |

Rules v2 (30 October 2026) re-aimed the environment at upper bounds: the three new families pay 1
for an exact answer to a question a proof needs (the whole exceptional set of a pair, a challenge
outside every fibre-aligned anchor, a cap's constant recomputed), and the count tasks pay only for
a count above 16 n, since below it one more challenge no longer informs a proof (the state of the
art holds 7.235 n at rung 0). The shared library `templates/shared/exceptional.py` scans every
A-subset by syndromes of the dual code (C(32, 20) = 225,792,840 subsets in about nine minutes on
one core) and certifies each candidate with the kit; on the stored witness-family pair at n = 32 it
returns exactly the 340 listed challenges, all fibre-aligned, and it recounts the F_32({0, 8}; 8)
classes as 384,242 at fibre 0 and 385,196 at fibre 8, the posted maximum. The count tasks' oracle
is the four-pair line (3n/2 + 4 bad challenges, `templates/count/environment/baseline.py`): it
scores 0 under rules v2 (`certified_bad` 52 at n = 32) and `beats_floor = 0`, which validates the
pipeline, not the task. The public floor is the best count certified at each size, from
participants' towers of codeword pairs (14 October 2026): 720, 1,488 and 2,992 at n = 256, 512 and
1,024 (reward about 0.18), certified independently. A line with more than 16 n certified bad challenges would score 1; at a fixed n that is
strong evidence against the first goal, not a refutation; a reward of 1 at exactly 16 n is not even
that. The baseline and its score are public, so a reproduction is not an improvement: `beats_floor`
and `above_goal` carry that distinction. The Lean tasks have no oracle, the targets are open; their
`solve.sh` submits the unchanged challenge and must score 0.

## Run

```bash
pip install "harbor[docker]>=0.24"
cd research/proven/harbor
harbor run -p tasks/count-babybear-m8 -a oracle -e docker        # the four-pair line: reward 0 (52 certified, below 16 n)
harbor run -p tasks -i exceptional-set-n32-a20 -a claude-code -m anthropic/claude-sonnet-5-5
harbor run -p tasks -i count-babybear-m8 -a claude-code -m anthropic/claude-sonnet-5-5
harbor run -p tasks -i lean-t3-goal -a oracle -e docker          # negative control: reward 0
```

Count tasks need only the small Python image. Lean tasks build the pinned package (Lean 4.34.0,
ArkLib with its Mathlib, Comparator, lean4export, landrun; about 13 GB): give the sandbox 20 GB of
disk and 12 GB of memory, or trim as `lean_setup.sh` notes. In Docker, each Lean task's
`tests/docker-compose.yaml` gives the separate verifier, and only it, `NET_ADMIN` for the grader's
iptables rule; without it every grade ends in a grading error, never a score.

## How a trial runs

```
agent sandbox                                   verifier sandbox (same image, fresh)
  count: writes /workspace/instance.json           never runs agent code
  lean:  writes /workspace/Submission.lean         /tests: grade.py, task.json (+ Challenge.lean, HoleCheck.lean)
  no network                                       /logs/artifacts: the only thing that crosses
        |                                            count: validate (field, k, A, the subgroup, witnesses),
  collect hook packs the file ------------------>          certify every challenge from the definition
                                                     lean:  Comparator (statement, axioms, kernel replay),
                                                            then HoleCheck.lean reads each parameter
                                                     root writes reward.json after killing the grader
```

Harbor's `[verifier] environment_mode = "separate"` provides the second sandbox; `[[verifier.collect]]`
runs the packer in the agent's sandbox after it finishes.

## Threat model

| Attempt | What stops it | Checked |
|---|---|---|
| Plant `reward.json` or a fake interpreter in the agent sandbox | the verifier is a fresh sandbox; only `/logs/artifacts` crosses | probe, reward 0 |
| Submit a symlink as the instance or the proof | the packer copies regular files only; the grader re-checks | probe, reward 0 |
| A domain that is not the subgroup, another field, k or A | `validate()`: p, k, A exact, every point an n-th root of unity, distinct | probe, reward 0 |
| A witness of more than k points (it would certify any z) | exactly k distinct indices; the kit's `certify.py` now refuses more than k too | probe, reward 0 |
| Spam challenges to run out the clock | at most 24 n listed; numpy certification, minutes at n = 1024 | by construction |
| Overflow in the numpy arithmetic | every product is reduced before the next operation and no sum of products is formed; p < 2^31 keeps each product below 2^62 | unit test with values next to p |
| A broken verifier mistaken for a wrong submission | a grading error writes no reward and Harbor reports the trial as an error | by construction |
| Lean: `sorry`, new axioms, `native_decide`, a weaker statement, a redefined definition | Comparator: exact statement, three axioms, kernel replay | as in FineEnvs/openai-math; in Docker, `sorry` and a changed statement refused |
| Lean: a constant set by choice, search, supremum or limit | `HoleCheck.lean` walks each hole's elaborated value, expanding the submission's own definitions; a constant outside the allow list fails (closed), the deny list names the known offenders | native test, six samples; in Docker, choice refused |
| Lean: code run at build time | landrun, the unprivileged grader user, and an iptables rule on the grader's sockets, as in FineEnvs/openai-math | in place for every Docker grade; not attacked |
| Lean: lift the no-network policy from inside the agent's sandbox | the agent's sandbox has no `NET_ADMIN`; only the verifier's `tests/docker-compose.yaml` adds it | unit test |

Trusted and not re-checked: the Lean kernel, Comparator, lean4export, landrun, Docker's boundary.
A crafted `.olean` could in principle mislead `HoleCheck.lean`, which loads the submission's build;
a reviewer reads the parameters in any case.

## Probes and the card

`probes.py` writes nine reward-hacking probes of a count task (planted reward files and a fake
interpreter, a symlinked instance, a tampered domain, another field, a lowered A, oversized
witnesses, duplicates, too many listed, random challenges) as Harbor tasks; run them with the
oracle agent after any change to the grader. `CARD.md` is the dataset card in the form Hugging
Face expects, should the maintainers publish there.

## Status, 2026-10-15

- Count tasks, through `harbor run` in Docker: the one-pair oracle certified exactly 3n/8 + 1 on all
  three sizes (97, 193 and 385 at n = 256, 512 and 1024; grading 1 s, 5 s and 19 s); the four-pair
  oracle that replaced it certifies 4 (n - A + 1) = 3n/2 + 4 (100 at n = 64, 388 at n = 256, reward
  0.0947). The nine probes: seven rejected with the intended reason, duplicates counted once
  (the floor's score), random challenges certify nothing. The grader agrees with the kit's
  `certify.py` on every instance in `tests/test_harbor.py`.
- Lean tasks: the grader is the validated FineEnvs grader with the package swapped and the hole
  check added; its upstream unit tests pass against the adapted copy
  (`tests/test_harbor_lean_grader.py`). `HoleCheck.lean` was run natively against Mathlib on six
  parameters (two closed forms accepted; choice, search, a supremum and a hidden choice refused).
  Every challenge template elaborates against the pinned file with only `sorry` warnings. The
  verifier flow itself ran natively on four controls (`controls/`): a real proof accepted with its
  constant read as closed form, `sorry` and a changed statement refused by Comparator, a constant
  set by choice accepted by Comparator and refused by the hole check.
- Lean tasks, through `harbor run` in Docker on a 16-core, 64 GB Linux host (15 October; Harbor
  0.24.0, Docker 29): the image builds in 31 minutes. The first grade ended in a grading error, as
  designed: Harbor's Docker no-network mode shares a sidecar's network namespace and gives the
  verifier no `NET_ADMIN`, so the grader's iptables rule could not be installed. With
  `tests/docker-compose.yaml`, the negative control on `lean-t3-goal` scores 0 (Comparator:
  `sorryAx`, 41 s of grading), and the controls, run as Harbor tasks with the sandbox, the grader
  user and the rule in place, match the native results: `ok` 1 with `HOLES OK` (121 s), `choice` 0
  with `DENIED: [Classical.choose]` (122 s), `weak` 0, statement mismatch (42 s).
- `MCAChallenge.T3Goal` and `T3Goal_of_T3` compile against the pinned ArkLib (45 s, no warnings).
- An outside reviewer rebuilt the four-pair construction independently and checked 2,852
  certificates at n = 32 to 1,024 (52, 100, 388, 772, 1,540), confirming the three baselines and
  the reward 0.0947. The general proposition is stated under an explicit nondegeneracy condition;
  whether a fifth pair can fit on the subgroup is open.

## Regenerate

`python3 build.py` writes `tasks/`, `registry.json` and `manifest.json` from `templates/`, the kit
and `lean/challenges/`; `python3 build.py --check` fails when they are stale (the test suite runs it).
