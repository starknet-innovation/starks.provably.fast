#!/usr/bin/env bash
# There is no oracle: the target is open. This submits the challenge unchanged (every proof is
# sorry), a negative control that must score 0.
set -euo pipefail
cp /opt/proven-math/challenges/FibreM31At32.lean /workspace/Submission.lean
echo "placed the unchanged challenge FibreM31At32 (negative control)"
