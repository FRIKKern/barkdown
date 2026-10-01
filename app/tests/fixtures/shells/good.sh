#!/bin/sh
# A login shell that answers -ilc with a PATH of its own.
[ "$1" = "-ilc" ] || { echo "unsupported" >&2; exit 2; }
echo "Welcome banner from an rc file"
PATH="$BD_FIXTURE_PATH" SSH_AUTH_SOCK=/tmp/fixture-agent.sock exec /bin/sh -c "$2"
