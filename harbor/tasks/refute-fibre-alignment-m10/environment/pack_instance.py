#!/usr/bin/env python3
"""Copy the agent's instance to the verifier. Harbor runs this as a [[verifier.collect]] hook in
the agent's sandbox after the agent finishes. It clears /logs/artifacts and copies
/workspace/instance.json there only if it is a regular file of at most 64 MiB; symlinks are never
followed. The verifier re-checks everything in a sandbox that never ran agent code."""
import os, shutil, stat, sys
from pathlib import Path

SRC = Path("/workspace/instance.json")
OUT = Path("/logs/artifacts")
MAX_BYTES = 64 << 20

OUT.mkdir(parents=True, exist_ok=True)
for entry in OUT.iterdir():
    if entry.is_dir() and not entry.is_symlink():
        shutil.rmtree(entry)
    else:
        entry.unlink()
try:
    st = SRC.lstat()
except FileNotFoundError:
    print("no /workspace/instance.json"); sys.exit(0)
if not stat.S_ISREG(st.st_mode) or st.st_size > MAX_BYTES:
    print("instance.json is not a regular file of at most 64 MiB; not packed"); sys.exit(0)
with open(SRC, "rb") as src, open(OUT / "instance.json", "wb") as dst:
    shutil.copyfileobj(src, dst)
print(f"packed {st.st_size} bytes")
