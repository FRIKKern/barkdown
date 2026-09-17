# Source map and evidence

The code here is the concept and handoff tooling. Production integrations are referenced, not vendored. See [source-references.json](../evidence/source-references.json) for verified file existence, Git blob IDs, manifests, and the exact observation time.

## Baselines

| Source | Revision | Meaning |
|---|---|---|
| Barkpark reviewed checkout | `88280ee4306baa911a3cfd0c33b04f44ee71d427` | Basis for the editor, graph, search, and revision analysis. |
| Barkpark main observed during handoff | `68406495e0e6e4fd391babf970b3089a6f8bcd60` | Newer than the reviewed checkout. Not fully re-audited here; review changes before integrating. |
| T3 reference candidate | `4749035bda13b4b6260499caedbc0d69a2f60e6f` | Architecture/manifest reference, not imported runtime code or a final baseline choice. |

No statement here means a moving branch is still at the observed commit. `scripts/refresh-source-evidence.cjs` can refresh read-only observations using an authenticated GitHub CLI; it does not import code or select a baseline.

## Barkpark integration anchors

All paths in this table refer to the reviewed Barkpark commit above. Use [that immutable tree](https://github.com/FRIKKern/barkpark/tree/88280ee4306baa911a3cfd0c33b04f44ee71d427), then compare with the selected implementation baseline.

| Path | Why the next agent needs it |
|---|---|
| `api/CLAUDE.md`, Bulldocs section | Ownership of Papers/PortableDoc, revision-aware focus, overlap review, existing undo receipts. |
| `api/assets/paper-editor/EMBED-CONTRACT.md` | The actual web-component embedding contract. Read before implementing a host adapter. |
| `api/assets/paper-editor/package.json` | Existing Tiptap 2 dependency family, build output, and source test suite. |
| `api/assets/paper-editor/src/index.js` | Registers `bp-paper-editor` and imports the canvas. Per-block editing and conversion boundaries. |
| `api/assets/paper-editor/src/canvas/index.js` | Registers `bp-paper-canvas`; continuous editing, flush, `bp-canvas-ops`, server acknowledgement/reconciliation. |
| `api/assets/paper-editor/src/canvas/run-convert.js` | Existing `runToTiptap`, `runToOps`, reconciliation, and overlap logic. Reuse rather than invent another diff. |
| `api/assets/paper-editor/src/format-bubble.js` | Current formatting behavior to improve while preserving selection and focus. |
| `api/assets/paper-editor/src/contract.js` | DOM-free embed constants; contract version `1.0.0` at the reviewed commit. |
| `docs/api-v1.md`, `docs/auth.md`, `docs/contracts/tenancy.md` | Supported API shapes, authentication, and content scope. Local folder identity is not content scope. |
| `docs/contracts/document-graph-and-history.md` | Backlinks, related results, tags, counts, revision listing/lookup and draft restore. |
| `docs/cards/search-media.md`, `docs/search/INTELLIGENCE.md` | Query pipeline/retriever boundaries, current search delivery, analytics and ranking constraints. |
| `api/lib/barkpark/search/query_pipeline.ex` | Internal `search` entry point; not a desktop endpoint contract. |
| `docs/contracts/media-http-envelope.md` | Asset URL and list/pagination response semantics. |
| `js/packages/core/package.json`, `js/packages/core/src/client.ts` | Existing JS client; audit its coverage before building new HTTP wrappers. |

## T3 integration anchors

The [pinned architecture](https://github.com/pingdotgg/t3code/blob/4749035bda13b4b6260499caedbc0d69a2f60e6f/docs/internals/overview.md) separates execution from clients: the owning environment handles providers and project operations, while shared client state has its own package. Barkdown should preserve that boundary and route its work tabs through originating chat/run identity.

Inspect these verified paths at [the pinned tree](https://github.com/pingdotgg/t3code/tree/4749035bda13b4b6260499caedbc0d69a2f60e6f):

- `package.json`: candidate toolchain is Node `^24.13.1`, `pnpm@11.10.0`. Audit current scripts before running them.
- `apps/desktop/package.json`, `apps/desktop/src/app/`: desktop host and startup responsibilities.
- `apps/server/package.json`: execution/server packaging.
- `apps/web/package.json`: renderer/client application.
- `packages/client-runtime/package.json`: shared connection and domain-state boundary.
- `packages/contracts/package.json`: existing contract package; adapt proposed types to actual runtime schemas.
- `docs/internals/connection-runtime.md`, `docs/internals/environment-auth.md`: connection and authorization details.
- `LICENSE`: preserve the upstream notice on import. See [third-party notes](../THIRD-PARTY.md).

## Editing reference

The user supplied [Tiptap's Notion-like editor](https://tiptap.dev/docs/ui-components/templates/notion-like-editor) as an interaction reference. Use it to evaluate editing comfort and menu behavior. Barkpark's existing editor is the chosen implementation foundation; no commercial template source is included.

## Concept provenance

The authoritative workspace and editor-study fragments were transferred from the design session. The workspace sample root was normalized from a machine-specific Windows folder to `/projects/barkpark` for portable examples; test expectations were updated to match. Text line endings are normalized to LF for reproducible cross-platform builds. No fixture became a real filesystem read.

`evidence/origin.json` records input/output hashes for this transfer. `evidence/artifact-manifest.json` records current sources and generated preview hashes. One-time migration scripts from the session were not transferred because rerunning them would duplicate edits or fail against already-updated sources.
