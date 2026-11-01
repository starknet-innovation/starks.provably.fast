#!/bin/bash
# Build the Lean checker image on this host:  ./build.sh TAG   (from research/proven/lean/checker)
# The package directory (..) is copied in as pkg/; the build downloads Mathlib's cache and builds
# the challenge module, which takes a while the first time.
set -euo pipefail
tag=${1:?usage: ./build.sh TAG}
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
mkdir -p "$work/pkg"
for f in lakefile.toml lake-manifest.json lean-toolchain MCAChallenge.lean PINNED.md; do cp "$here/../$f" "$work/pkg/"; done
cp -R "$here/../challenges" "$work/pkg/challenges"
printf '\n[[lean_lib]]\nname = "Solution"\n' >> "$work/pkg/lakefile.toml"
cp "$here/check.py" "$work/check.py"
cp "$here/Dockerfile" "$work/Dockerfile"
docker build -t "lean-checker:$tag" "$work"
echo "lean-checker:$tag"
