#!/usr/bin/env bash
# Builds the image shared by every Lean task, for both the agent and the separate verifier:
#   - the pinned package of starks.provably.fast (Lean v4.34.0, ArkLib at the pinned commit with its
#     own Mathlib), built up to MCAChallenge
#   - Comparator, lean4export and landrun, used only by the verifier's grade.py
#   - every challenge template, at /opt/proven-math/challenges/<Target>.lean
#   - /workspace, a Lake project where the agent writes Submission.lean
# Adapted from FineEnvs/openai-math (Apache-2.0); every revision is pinned. Written, not yet built:
# the tree is about 13 GB, more than a 10 GB sandbox disk, so trim or size the sandbox accordingly.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

LEAN_TOOLCHAIN=$(cat /opt/build/lean-toolchain)
COMPARATOR_REV=d03acab154d269c06e60e4de7e4cc85deebff94b   # "bump toolchain to v4.34.0"
LANDRUN_REV=811cfff51ceaf3d9843708aa6d22e9b84ccac8b4
GO_VERSION=1.24.7

wipe() { for d in "$@"; do [ -e "$d" ] && find "$d" -depth -delete; done; return 0; }

apt-get update -qq
apt-get install -y -qq --no-install-recommends git curl ca-certificates build-essential xz-utils \
  zstd python3 procps iproute2 iptables tmux >/dev/null
wipe /var/lib/apt/lists
git config --system --add safe.directory '*'

export ELAN_HOME=/opt/elan PATH=/opt/elan/bin:$PATH
curl -sSfL https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh \
  | sh -s -- -y --default-toolchain "$LEAN_TOOLCHAIN" --no-modify-path

# --- Verifier tools ---
curl -sSfL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" | tar -C /tmp -xz
GOBIN=/usr/local/bin GOPATH=/tmp/gopath GOCACHE=/tmp/gocache \
  /tmp/go/bin/go install "github.com/zouuup/landrun/cmd/landrun@${LANDRUN_REV}"
wipe /tmp/go /tmp/gopath /tmp/gocache

git clone -q https://github.com/leanprover/comparator.git /tmp/comparator
(
  cd /tmp/comparator
  git checkout -q "$COMPARATOR_REV"
  # Pass LEAN_NUM_THREADS into Comparator's landrun sandbox, so Lake's parallelism fits the memory.
  sed -i 's/envPass := #\["PATH", "HOME", "LEAN_ABORT_ON_PANIC"\]/envPass := #["PATH", "HOME", "LEAN_ABORT_ON_PANIC", "LEAN_NUM_THREADS"]/; s/envPass := #\["PATH", "HOME", "LEAN_PATH", "LEAN_ABORT_ON_PANIC"\]/envPass := #["PATH", "HOME", "LEAN_PATH", "LEAN_ABORT_ON_PANIC", "LEAN_NUM_THREADS"]/' Main.lean
  test "$(grep -c '"LEAN_NUM_THREADS"' Main.lean)" -eq 2
  echo "$LEAN_TOOLCHAIN" > lean-toolchain
  lake build lean4export comparator
  install -m 0755 .lake/build/bin/comparator /usr/local/bin/comparator
  install -m 0755 .lake/packages/lean4export/.lake/build/bin/lean4export /usr/local/bin/lean4export
)
wipe /tmp/comparator

# --- The pinned package, built up to MCAChallenge ---
mkdir -p /opt/lean-env
cd /opt/lean-env
cp /opt/build/lakefile.toml /opt/build/lake-manifest.json /opt/build/lean-toolchain /opt/build/MCAChallenge.lean .
cat >> lakefile.toml <<'TOML'

[[lean_lib]]
name = "Challenge"

[[lean_lib]]
name = "Submission"
TOML
lake exe cache get
lake build MCAChallenge
# Drop what importing never reads: static libraries, LLVM, the C and .ilean by-products.
find /opt/elan/toolchains/*/lib -name '*.a' -delete
find /opt/elan/toolchains/*/lib \( -name 'libLLVM*' -o -name 'libclang-cpp*' \) -delete
find .lake -path '*/.lake/build/*' \( -name '*.c' -o -name '*.ilean' \) -size +0 -exec truncate -s 0 {} +
wipe /root/.cache/mathlib

# --- Challenge templates and the submission packer ---
mkdir -p /opt/proven-math/challenges
cp /opt/build/challenges/*.lean /opt/proven-math/challenges/
install -m 0755 /opt/build/pack_submission.py /opt/proven-math/pack_submission.py

# --- Agent workspace and the verifier's unprivileged user ---
mkdir -p /workspace/.lake
cp /opt/lean-env/lakefile.toml /opt/lean-env/lake-manifest.json /opt/lean-env/lean-toolchain /opt/lean-env/MCAChallenge.lean /workspace/
ln -s /opt/lean-env/.lake/packages /workspace/.lake/packages
cp -R /opt/lean-env/.lake/build /workspace/.lake/build
useradd --uid 2000 --create-home --shell /usr/sbin/nologin grader
mkdir -p /var/lib/proven-grade && chmod 0711 /var/lib/proven-grade

# Smoke test: a second build must compile nothing but Submission.
cd /workspace
printf 'import MCAChallenge\n\nexample : (2 : ℕ) + 2 = 4 := by norm_num\n' > Submission.lean
lake build Submission 2>&1 | grep -E 'Built|error' | grep -v 'Built Submission' | head -20 || true
echo '-- second build' >> Submission.lean
lake build Submission 2>&1 | tee /tmp/smoke.log
if grep 'Built' /tmp/smoke.log | grep -qv 'Built Submission'; then
  echo "the prebuilt package is incomplete: a second build still compiled dependencies" >&2; exit 1
fi
find /workspace/Submission.lean /tmp/smoke.log -delete
find /workspace/.lake/build -name 'Submission*' -delete
chmod -R a+rX /opt/elan /opt/lean-env /opt/proven-math
wipe /opt/build /root/.cache
df -h / | tail -1
du -sh /opt/elan /opt/lean-env
