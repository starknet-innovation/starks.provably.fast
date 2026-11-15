# Shared by every Lean task (agent and separate verifier). See lean_setup.sh.
FROM ubuntu:24.04
ENV ELAN_HOME=/opt/elan \
    PATH=/opt/elan/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    LANG=C.UTF-8
COPY lean_setup.sh pack_submission.py lakefile.toml lake-manifest.json lean-toolchain MCAChallenge.lean /opt/build/
COPY challenges /opt/build/challenges
RUN bash /opt/build/lean_setup.sh
WORKDIR /workspace
