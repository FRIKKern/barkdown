# Captured provider runs

C004 implementation `0086867`. This is a main-process foundation; it does not add profile selection or complete A1.

`agent.start` accepts the existing chat/messages/provider fields plus trusted `profileId`, `storeDir`, `connection` and optional `onFinish`. Main must resolve the UUID and root from a validated registry; renderer-supplied roots are never sufficient. Legacy startup passes its existing root with null profile identity. At dispatch, `providers/run-scope.js` copies and freezes context, provider settings, images/messages, connection/token and relevant environment before an SDK can load asynchronously.

Each scope owns bound store, document, conversation and edit-receipt adapters. Same local IDs in two roots resolve independently. Store helpers reject descendant traversal, alternate-stream names and linked descendant paths. **The caller must supply a trusted root:** ancestor links and replacement of the root itself require resolver hardening in C006. Scope capture does not seed empty stores or create missing roots. Startup retains its existing explicit seeding behavior.

MCP receives the captured connection in private environment, rather than following later `barkpark.json` changes. Parent-side tool activity uses the same bound store; document creation opens the exact acknowledged ID, not a title match. Events append authoritative run/chat/provider/profile IDs after event fields, including null legacy profile ownership.

## Lifecycle contract

- `agent.start({... onFinish})` returns `{runId}`. `onFinish({runId, profileId, chatId, cancelled})` is a trusted main-process callback, invoked and awaited exactly once from provider finalization. It can release an acquired runtime lease. If dispatch throws before registration, the caller still owns its lease and must release it.
- `agent.cancel(runId)` requests abort. It does not acknowledge cleanup or release a lease. Cancellation while an SDK is loading prevents that provider from launching.
- `agent.waitForRunFinish(runId)` resolves after transport finalization and the awaited cleanup callback. Results include owner IDs, provider, `status` and `cancelled`; statuses are `completed`, `cancelled`, `failed`, `finished` (no terminal event) or `cleanup-failed`. Cleanup failures emit an owned error note and still remove the run from the active registry.
- The last 200 completion records are retained in process to cover runs finishing before `start` returns. Unknown/expired IDs reject. This is not a durable run store. The goal scheduler must persist its own acknowledged outcome.

Finalization means the provider driver completed its stream/finally path. It does **not** establish that every SDK descendant OS process has exited. Do not describe an emitted `done` event or a cancellation request as that stronger acknowledgement. Cancel/approve/wait methods are internal, run-ID-based primitives; a future profile IPC service must authorize their owner before calling them.

## Remaining boundaries

The app still boots one legacy workspace. Profile-qualified IPC, navigation/draft generation checks, background transcript persistence, cache/browser partitions, profile switching and registry adoption are follow-on work. Existing external Claude/Codex home-directory logins remain shared device integrations. Explicit profile runs reject ambient `viaCli` mode; legacy CLI mode remains supported without a claim that later external CLI selection is immutable. The API provider retains its existing local-document tool scope.

`app/tests/run-ownership.test.mjs` uses disposable same-ID stores, a real stdio MCP client and scripted provider SDK/API seams. It proves orchestration and owned filesystem behavior, not cloud tenancy, cross-machine portability or live provider compliance. Full desktop regressions and separate live Paper/visual evidence are recorded in the [C004 handoff](cycles/C004-captured-run-ownership.md).
