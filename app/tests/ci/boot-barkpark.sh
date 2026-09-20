#!/usr/bin/env bash
# Boot a local Barkpark for the parity rows, from a checkout, on a CI runner (plan #4).
#
#   app/tests/ci/boot-barkpark.sh <barkpark checkout dir>
#
# Expects Postgres on localhost:5432 (postgres/postgres — what api/config/dev.exs reads), Elixir + OTP
# and Go on PATH. Builds the `bp` CLI from the checkout, points it at the server with the demo seed's
# dev token (the live rows run through `bp`, as they do on a developer's machine), runs the migrations
# and the demo seed, starts Phoenix on :4000 in the background and waits for /status.json.
# Both repos' workflows call this one script, so the boot sequence has one home.
set -euo pipefail
dir="${1:?barkpark checkout dir}"
port="${PORT:-4000}"
export PORT="$port"
export BARKPARK_SEED_PROFILE="${BARKPARK_SEED_PROFILE:-demo}"
export MIX_ENV=dev

echo "::group::bp CLI"
( cd "$dir" && go build -o "${BP_BIN_DIR:-/usr/local/bin}/bp" ./cmd/barkpark )
mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/barkpark"
cat > "${XDG_CONFIG_HOME:-$HOME/.config}/barkpark/config.json" <<EOF
{ "server": "http://localhost:${port}", "token": "barkpark-dev-token", "workspace": "default", "project": "default", "dataset": "production",
  "known_servers": [ { "name": "local", "server": "http://localhost:${port}", "token": "barkpark-dev-token", "workspace": "default", "project": "default", "dataset": "production", "tier": "admin" } ] }
EOF
bp version || true
echo "::endgroup::"

echo "::group::Barkpark: deps, database, seed"
cd "$dir/api"
mix local.hex --force >/dev/null
mix local.rebar --force >/dev/null
mix deps.get
mix compile
mix ecto.setup
echo "::endgroup::"

echo "::group::Phoenix on :${port}"
log="${BARKPARK_LOG:-/tmp/barkpark-phx.log}"
nohup mix phx.server > "$log" 2>&1 &
echo $! > /tmp/barkpark-phx.pid
for i in $(seq 1 120); do
  if curl -fsS "http://localhost:${port}/status.json" >/dev/null 2>&1; then
    echo "Phoenix answered after ${i}s"
    curl -fsS "http://localhost:${port}/status.json" | head -c 300; echo
    echo "::endgroup::"
    bp whoami -o json | head -c 300 || true; echo
    exit 0
  fi
  sleep 1
done
echo "::error::Phoenix did not answer on :${port} within 120s"
tail -n 80 "$log"
exit 1
