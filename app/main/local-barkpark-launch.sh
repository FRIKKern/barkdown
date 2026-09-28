#!/bin/sh
# POSIX twin of local-barkpark-launch.ps1: run the private Barkpark build from the
# selected source checkout. The driver spawns this detached, so the BEAM and every
# child it starts share one process group the driver can stop as a whole.
set -eu
PATH="$BARKDOWN_TOOL_PATH:$PATH"
export PATH
cd "$BARKDOWN_API_DIR"
exec "$BARKDOWN_MIX_PATH" run --no-start --no-compile --no-deps-check --no-halt "$BARKDOWN_BOOT_SCRIPT"
