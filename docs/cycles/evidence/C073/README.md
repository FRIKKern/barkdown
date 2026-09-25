# C073 integration evidence

The complete Paper stack was integrated with upstream main `c423813d7` in Barkpark `446f29ced`. Follow-up `1aaa857e6` changes only a selector self-test and a repository-paper snapshot. Barkdown's application and shipped Barkpark pin are unchanged; these are connected private-runtime results, not a fallback-bundle upgrade or deployment.

| Proof | Result / source |
|---|---|
| Fresh production compilation | [Passed](prod-compile.log), Elixir 1.18.4 / OTP27.3.4; isolated build and compiler environment |
| Focused server regression | [234 tests, zero failures](exunit.log), disposable UTF-8 PostgreSQL cluster |
| Editor unit suite | [Passed](editor-tests.log); additional [portal theme regression](link-preview.log) passed |
| Real editor/server parity | [20/20 rows](parity.md), Barkdown `d4e3567` / Barkpark `446f29ced`; [runtime log](live-parity.log) |
| Exact deletion/recovery adapter | [Passed](deletion-contract-1790293778168.json): lost response, recreated-original refusal and repeated copy recovery; [log](deletion-adapter-http.log) |
| Adjacent contracts | [Security 139/139](security-shape.log), [workflow ledger 21/21](workflow-ledger-fixed.log), [vendor freshness](vendor-freshness-fixed.log), [design](design-check-fixed.log), [snapshot freshness](repo-paper-freshness-fixed.log) |
| Root verification | [Passed](root-verify.log); concepts/handoff only, separate from the real runtime rows above |
| Current-main contract repairs | [111 tests passed](contract-spec-tests.log): route manifest, error registry, containment inventory, CLI manifest, ingest/create and the real receipt versus OpenAPI. [Receipt census passed](census-fixed.log); its prior run derived the new route pin rather than guessing it. |

## Visual review

![Private runtime in dark mode](../../../images/status/paper-dark.3092fc0a.png)

Five live stills, their five differences and all 37 GIF frames were inspected and [explicitly accepted](status-review.json). [Comparison metrics](visual-comparison.json) retain the old and new image names; [manifest](../../../images/status/history/2026-09-25T00-08-09-647Z.json) binds the capture to Barkdown `d4e3567` and upstream `1aaa857e6`. Light views support theme contrast review. The transcript is a real Claude Code turn on disposable content. [Full editing GIF](../../../images/status/editing.0cfaf231.gif) retains all captured steps; `motion-*.jpg` sheets expose every frame for review.

The first capture timed out on the settings screenshot; [failed log](live-shots.log) and four partial views in `capture-timeout/` are retained as diagnostics. The [complete retry](live-shots-retry.log) stopped its private runtime normally. Neither partial screenshots nor the optional token-skipped hosted parity job count as behavior acceptance.

The existing standard fixture approval and notebook README demo remain applicable because Barkdown app, dependency, pin and capture inputs did not change. Fresh connected Paper evidence does not claim that every migration or narrow-layout journey was repeated.

Supplemental [dark](link-dark.png), [light](link-light.png) and [narrow](link-narrow.png) link-preview captures show the changed portal consuming the paper's theme with readable Open/Edit controls. All three were inspected; [geometry](linkpreview-geometry.json) also confirms viewport containment. This fixture uses the real private server without a provider turn. Its [named review](linkpreview-review.json) records the exact source and artifact hashes.

## Failures and boundaries

- `exunit-setup-failed.log` is the initial disposable SQL_ASCII cluster setup failure; the successful run uses UTF-8. `dev-compile.log` records warnings from the machine's newer Elixir 1.20; production validation uses the declared 1.18.4 toolchain.
- `deletion-http/` and `deletion-http.log` audit generic mutation/restore APIs. They demonstrate unsafe generic deletion/overwrite behavior and are **not** the Barkdown adapter proof. The exact adapter result linked above uses the supported guarded path.
- Initial hosted logs use `446f29ced` and the former PR base. `hosted-path-escape.log` found a real mismatch in the selector's independent test oracle; `1aaa857e6` corrects top-level ancestor matching without changing production selection. `selector-harness.log` records the corrected two-reader assertion.
- `hosted-js.log` reports advisory SDK gzip budget overages of 250/282/276 bytes. HEAD and current main have the same complete `js` tree (`31b306c97d5c129c1921a860f4d8219f7b78776c`); the integration does not increase those sources. No budget was raised. This is attribution evidence, not a claim that the same failure was observed on a main CI run.
- `doc-checks.log` and `required-ack.log` are interrupted local duplicates, not passes. Their equivalent initial Linux CI steps passed. Windows CRLF/Python prerequisites caused earlier local checker failures; raw logs retain them.

The initial full Linux run executed 22,901 tests with nine failures. [Failure excerpts](hosted-failures.txt) identify the missing create manifest/error code, popup inventory and receipt registry; all are addressed in upstream `39d76cd9b`. The [full log is retained compressed](hosted-elixir.log.gz), with [original-byte hashes and provenance](hosted-elixir-provenance.json). These failures prompted the targeted corrections above; fresh hosted checks remain required. No editor runtime code changed after the reviewed live capture.

Hosted readiness and the next action belong to the [current handoff](../../C073-upstream-integration.md). No upstream merge, production deployment or migration activation is included in this evidence.
