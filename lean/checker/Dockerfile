# The Lean receipt checker for starks.provably.fast (docs/LEAN_CHECK.md, first version): the pinned
# toolchain, the pinned package built with Mathlib's cache, and the toolchain's own leanchecker
# (the former lean4checker, built into Lean since v4.28.0).
# Built once per contract on pvfast-eval-02 (research/proven/lean/checker/build.sh); a job runs
# check.py in a fresh container with no network.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git build-essential python3 \
 && apt-get clean && find /var/lib/apt/lists -type f -delete
RUN install -d -o 10001 -g 10001 /opt/lean
USER 10001:10001
ENV HOME=/opt/lean ELAN_HOME=/opt/lean/elan PATH=/opt/lean/elan/bin:$PATH
RUN curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y --no-modify-path --default-toolchain none
COPY --chown=10001:10001 pkg /opt/lean/pkg
WORKDIR /opt/lean/pkg
# The toolchain the package pins, then every dependency's oleans from Mathlib's cache, then the
# challenge module (what a solution imports) built from source where the cache has nothing.
RUN elan toolchain install "$(cat lean-toolchain)" && lake exe cache get && lake build MCAChallenge
RUN lake env which leanchecker
COPY --chown=10001:10001 check.py /opt/lean/check.py
ENV PYTHONDONTWRITEBYTECODE=1
ENTRYPOINT ["python3", "-I", "/opt/lean/check.py"]
