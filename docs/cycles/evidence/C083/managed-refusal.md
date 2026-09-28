# Managed-mode refusal record (C083 slice 6)

Per-group record required by [D-managed-writers](../../../DESIGN-DECISIONS.md#d-managed-writers--door-or-refuse-per-audited-cluster-2026-09-28). Implemented upstream in [PR20435](https://github.com/FRIKKern/barkpark/pull/20435) by `BarkparkWeb.Plugs.RefuseWhileHeld`: every mutating request on the pipelines below takes a zero-width admission; a held instance answers 503 `storage_unavailable` with `reason: write_admission_<state>` before any controller runs. Reads pass. A passthrough unless write admission is enabled.

| Audited cluster | Route groups | Pipeline carrying the refusal | Proof |
|---|---|---|---|
| Tenancy and workspace admin | `/api/workspaces` create, delete, archive, restore, import; `/api/playground` | `:require_admin`, `:require_platform_operator` (via `:require_admin`), `:managed_refusal` on the token-only `/api` scope | plug suite |
| Auth, SSO, SCIM, access | `/scim/v2`, `/v1/auth/oidc`, `/v1/access` claim and mint, scoped `/v1/members` and `/v1/tokens` | `:scim`, `:sso_browser`, `:access_principal`, `:managed_refusal`, `:scoped_admin` | plug suite |
| Operator surfaces | `/v1/secrets`, `/v1/plugins/settings`, `/v1/schemas`, `/v1/webhooks`, `/v1/shares`, `/v1/status/incidents`, and their `/w/:ws/p/:proj` twins | `:require_admin`, `:flat_admin_api`, `:scoped_admin` | `write_admission_refusal_test.exs`: held POST `/v1/schemas/test` and `/v1/webhooks/test` → 503, nothing stored; GET passes; reopen admits |
| Studio Chat and fleets | `/v1/cycles/...` fleet verbs, Studio chat API | `:cycle_fleet_capability`, `:studio_chat_capability` | plug suite (capability pipelines refuse before the controller) |
| Boot-time and one-shot writers | `:seed` and `:one_shot` boots; `SchemaBootstrap` | `Application.refuse_managed_offline_boot!/2`; coordinator ordered after `SchemaBootstrap`, before Oban | `application_managed_boot_test.exs` |

Accepted as bookkeeping, unchanged: idempotency claims, preview-token JTIs, session and token last-used stamps, search analytics, audit rows.

**Residual, owned by C083:** LiveView events on already-mounted admin surfaces (plugin admin, ops, workspace pages, Studio chat views) are not on a plug pipeline. A hold that begins after mount refuses their writes only where those writes reach a door. Closing it means an `on_mount` hook plus a per-event check on those live sessions, or accepting the gap for a dedicated instance that does not open those surfaces during a switch.
