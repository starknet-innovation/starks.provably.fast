---
license: apache-2.0
task_categories:
- other
tags:
- harbor
- rl-environment
- reinforcement-learning
- verifiable-reward
- mathematics
- coding-theory
- lean4
- theorem-proving
pretty_name: "starks.provably.fast: bad challenges as Harbor environments"
---

# Bad challenges for Reed-Solomon checks, as Harbor environments

> A dataset card ready for Hugging Face. Publishing is a maintainers' decision; until then this
> file documents the environment in the form that audience expects. Experimental: an agent-assisted
> research release, not yet reproduced outside the maintainers' machines in its packaged form.

Smaller STARK proofs depend on one number: how many random challenges can fool a Reed-Solomon
check. Sharper bounds on the domains provers use remain open. This dataset packages that open problem, from
[starks.provably.fast](https://starks.provably.fast/), as [Harbor](https://github.com/harbor-framework/harbor)
environments with a **verifiable reward**: a score computed by a verifier configured to check submitted artifacts in a separate environment.

Two kinds of task, the same format as [FineEnvs/openai-math](https://huggingface.co/datasets/FineEnvs/openai-math):

| Task | Reward | Known |
|---|---|---|
| `count-babybear-m8`, `-m9`, `-m10`: find a line (two words) on the subgroup of order 2^m in BabyBear with as many bad challenges as possible at rate 1/2 and gap 1/8, and list a witness per challenge | certified distinct bad challenges / (16 n), a graded terminal reward; the uncapped count and the flags over the public baseline and over 16 n are reported too | public floor from participants' towers of codeword pairs: 720, 1,488 and 2,992 at n = 256, 512 and 1,024 (reward about 0.18); the four-pair oracle 3n/2 + 4 (reward 0.095); the challenge's first goal says at most 16 n |
| `lean-t3-goal`, `lean-t3`, `lean-t3-exponent`, `lean-t1-uniform`, `lean-t1`, `lean-t2` and the eight lane tasks of rules v7.3 (`lean-fibre-m31`, its two instances, `lean-interior58`, `lean-interior-three`, `lean-t1-smooth`, `lean-t1-uniform-smooth`, `lean-t2-smooth`): prove one pinned statement in Lean 4 against ArkLib, supplying its constants in closed form | 1 if Comparator accepts the proof and every constant is a closed form, else 0 (binary) | all open; expect 0; the container verifier passes four controls and has not been attacked |

## How a task works

The agent gets a sandbox with no internet. Count tasks: Python with numpy, the starter kit's
checker and the floor construction; the agent writes `/workspace/instance.json`. Lean tasks: Lean
4.34, ArkLib with its Mathlib and the pinned statements, prebuilt; the agent writes
`/workspace/Submission.lean`.

When the agent finishes, one plain file is copied to a fresh verifier sandbox, separate from the
agent's environment. For a count task the
verifier checks the field, k, A and the domain (every point an n-th root of unity), then
re-certifies every listed challenge from the definition: the polynomial of degree below k through
the witness agrees with f + z g on at least A points, and f and g are not both interpolable there.
For a Lean task the verifier runs Comparator (exact statement, three standard axioms, kernel
replay) and then reads each constant's definition: choice, search, suprema and limits are refused.

## Why the reward is graded

A proof checker says yes or no. For an open problem that is a weak training signal; the FineEnvs
card says as much. Counting bad challenges has a natural graded score: each additional certified
challenge raises the score until the cap, the uncapped count stays visible, and a line with more
than 16 n at some n is strong evidence against the current goal and a record on
starks.provably.fast, where whoever found it is credited. A reward of 1 at exactly 16 n reaches the
cap but does not violate the proposed bound; the uncapped count is the number that matters, and
whether a graded reward trains better than a binary one is not shown here.

## Run

```bash
pip install "harbor[docker]>=0.24"
harbor run -p tasks -i count-babybear-m8 -a oracle -e docker                       # the floor
harbor run -p tasks -i count-babybear-m8 -a claude-code -m anthropic/claude-sonnet-5-5
```

Count tasks need a small Python image; Lean tasks build a 13 GB image and need a 12 GB sandbox.

## Validation

- The oracle (the four-pair line) scores 0.0947 on `count-babybear-m8`: 388 certified bad challenges
  at n = 256, exactly 3n/2 + 4. The public floor there, a ten-pair tower from a participant's agent,
  certifies 720 (reward 0.1758), certified independently.
- Nine reward-hacking probes (`probes.py`: planted reward files, a symlinked instance, a tampered
  domain, another field, a lowered A, oversized witnesses, duplicates, too many listed, random
  challenges) score 0 or the floor, each with the intended reason.
- The verifier agrees with the kit's pure-Python checker on every instance in the test suite.
- The Lean grader is FineEnvs/openai-math's, adapted; the closed-form check was run on six sample
  constants and the whole verifier flow on four controls, natively and again in Docker with the
  sandbox, the unprivileged grader and its network block (a real proof scores 1; `sorry`, a changed
  statement and a constant set by choice score 0). The container has not had a security review.
- An outside reviewer rebuilt the four-pair baseline independently and checked 2,852 certificates
  at n = 32 to 1,024.

## Public baselines, in place of a contamination note

The statements, the baseline construction, its script and score, and the discussion are public.
An agent that reproduces the baseline scores 0.095 without any new mathematics; `beats_floor` and
`above_goal` separate reproduction from improvement. Three fixed sizes are a release, not a
generalisation benchmark: held-out parameters would be needed before any learning claim, and none
is made here.

## Credit and license

Statements, kit and tasks: starks.provably.fast maintainers, Apache-2.0. The verifier design and
the Lean grader follow FineEnvs/openai-math (Apache-2.0). Lean, Mathlib, ArkLib, Comparator and
lean4export are Apache-2.0; landrun is MIT. Results belong on the research record at
https://starks.provably.fast/workshop, where a score is evidence and a review decides.
