# Owned profile workspaces

The desktop supports explicit `--profiles` mode. It creates an empty UUID library under `userData/profile-data`; it does not import or modify the legacy `userData/barkdown` library. Start the prototype with `npm --prefix app run start -- --profiles`. Settings → General contains profile creation and switching. Working folders remain individual chat choices.

Profile switching waits for foreground IPC requests, retains captured background provider/runtime leases, stops the old profile's terminal tabs, and reloads the renderer. A pending or dirty Paper save blocks the Settings switch; unsaved project buffers do too. Website cookies and storage use a main-verified UUID partition. Theme, pane widths and window bounds live in app-wide appearance storage.

## Main-owned boundary

`profile-service.js` resolves registry roots, settings, connections, conversation folders, provider sessions and catch-up history. `resolve(profileId,chatId,request)` returns `{scope,chat,settings,release}` for the goal adapter. Ordinary starts reserve a durable attempt before provider launch. Cancellation cannot release its runtime before provider finalization.

Preload captures `{profileId,generation}` for owned IPC. `profile-ipc.js` validates it, drains active request handlers before a switch, and refuses requests after failed activation until restart. Main accepts requests only from its own top-level frame. Snapshot payloads also retain their owner, so reusing an old snapshot after switching away and back fails.

`workspace-repository.js` is the managed transcript writer. Renderer saves merge navigation and drafts without replacing acknowledged messages or dropping worker chats omitted by an older view. Explicit revision-checked commands handle deletion and transcript edits. Folder/provider changes reset native session context; an old run cannot restore a session from the prior folder.

## Goal transcript contract

- `begin(request,resolved)` durably reserves stable user/assistant message IDs and returns `{history,fresh,assistantId,state}`. Duplicate attempts return `fresh:false`, never permission to dispatch twice.
- `event(request,event)` checks owner, exact attempt/run and authoritative sequence, then writes before display. Replay is ignored; gaps and foreign events fail.
- `finish(request,{runId,status,driverFinished})` distinguishes actual driver finalization from `done` events. `interrupted` with `driverFinished:false` retains an unfinished reservation for reconciliation.
- `stageWorkerChats(goal,choices)` creates saved ordinary side chats with parent and goal references. Main and side chats retain the same composer, model, image and folder controls.

Conversation goals are available through Quick open. Each plan has three bounded assignments and saved worker conversations. The profile-local journals share one main-process three-worker admission limit. Work continues while the application and computer are running. Unknown recovered termination remains blocked until trusted reconciliation; this is not a guarantee about arbitrary OS descendants.

Renderer transcript refreshes preserve drafts and yield to stream events, changed folder/provider/session context, new submissions and deletions made while the request was in flight.

## Evidence and limits

[C006 handoff](cycles/C006-profile-workspace-service.md) records exact source, test and capture provenance. The profile UI tests use actual Electron process restart, same-slug notes and real website cookies/storage. Goal integration drives the production API provider loop with a deterministic client seam. The profile Paper test boots a private real Barkpark/PostgreSQL runtime and delays a real HTTP write to prove switch protection.

This opt-in path is not the completed P1 default migration. Existing runtime cold adoption/default cutover, shared-device credential boundaries and the combined A1 gate remain separate work. CLI-backed profile routing is unavailable; use explicit owned connections. The legacy default launch remains available until adoption and rollback are integrated and proven.
