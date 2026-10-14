
section "33. the pending Barkdown aggregate keeps the four-context floor and its leaves together"

# These names were added after the frozen suite heads. Use the actual workflow
# tree with an isolated observed-name feed, never a permissive production spec.
RC33="$TMP/rc33-barkdown"
mkdir -p "$RC33/fixtures"
jq '[.protection.required_status_checks.checks[].context] +
    ["Barkdown parity gate", "Barkdown parity rows", "Parity dispatch and dependency checks"]
    | unique | map({name: ., conclusion: "success", status: "completed",
                   started_at: "2026-10-14T00:00:00Z", app: {id: 15368}})
    | {check_runs: .}' "$SPEC" > "$RC33/fixtures/checkruns-acctA.json"
cp "$RC33/fixtures/checkruns-acctA.json" "$RC33/fixtures/checkruns-acctB.json"
cp "$RC33/fixtures/checkruns-acctA.json" "$RC33/fixtures/checkruns-acctMain.json"
printf '%s\n' acctMain > "$RC33/fixtures/main-shas.txt"

if emit_spec "$RC33/held.json" bash "$GEN" --workflows "$REPO_ROOT/.github/workflows" \
    --fixture-dir "$RC33/fixtures" --sha acctA --sha acctB --no-merge --out "$RC33/held.json"; then
  if jq -e --slurpfile base "$SPEC" '
      ([.protection.required_status_checks.checks[].context] | sort) ==
      ([$base[0].protection.required_status_checks.checks[].context] | sort)
      and ([.exclusions[] | select(.context == "Barkdown parity gate" and
        (.reason | startswith("S7 EXCLUDED BY DECISION:")))] | length) == 1
      and ([.exclusions[] | select((.context == "Barkdown parity rows" or
        .context == "Parity dispatch and dependency checks") and
        (.reason | startswith("S6 LEAF OF AN EXCLUDED AGGREGATOR:")))] | length) == 2
    ' "$RC33/held.json" >/dev/null; then
    ok "Barkdown's actual optional aggregate is held explicitly and both real leaves are S6; the four-context floor is unchanged"
  else
    bad "Barkdown aggregate/leaf classification or the existing required floor changed: $(jq -c '.protection.required_status_checks.checks' "$RC33/held.json")"
  fi
else
  fail_emit "Barkdown's exact observed-name accounting fixture could not emit: $(why_emit 'missing held.json')"
fi

# Remove only the named pending-promotion decision. A healthy future window
# must then promote the aggregate; this proves the hold is not decorative.
sed '/^  "Barkdown parity gate"$/d' "$GEN" > "$RC33/unheld.sh"
if [ "$(grep -c '^  "Barkdown parity gate"$' "$GEN" || true)" -eq 1 ] &&
   ! grep -q '^  "Barkdown parity gate"$' "$RC33/unheld.sh"; then
  if emit_spec "$RC33/unheld.json" bash "$RC33/unheld.sh" \
      --workflows "$REPO_ROOT/.github/workflows" --fixture-dir "$RC33/fixtures" \
      --sha acctA --sha acctB --no-merge --out "$RC33/unheld.json"; then
    if jq -e '[.protection.required_status_checks.checks[].context] |
        index("Barkdown parity gate") != null' "$RC33/unheld.json" >/dev/null; then
      ok "removing only the pending Barkdown decision promotes its aggregate on the identical healthy fixture; the hold is mutation-proven"
    else
      bad "removing the Barkdown decision did not demonstrate automatic promotion"
    fi
  else
    fail_emit "the disarmed Barkdown fixture could not emit: $(why_emit 'missing unheld.json')"
  fi
else
  bad "the named Barkdown decision mutation did not apply exactly once"
fi

