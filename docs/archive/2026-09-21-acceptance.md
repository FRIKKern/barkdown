> Historical snapshot, archived 2026-09-21. Descriptions and commands below record earlier work; they are not current instructions. Use [the current plan](../PLAN.md) and [handoff](../NEXT-AGENT.md).

# Acceptance and delivery

The [PRD](../PRD.md) contains 24 requirements: 19 P0 requirements for the connected alpha and 5 P1 requirements for subsequent work. This document makes the delivery order and verification boundaries explicit. It is a product acceptance plan, not a claim that the requirements are already implemented.

## Ordered milestones

| Milestone | Deliverable | Exit evidence |
|---|---|---|
| 0: integration proof | Audited T3 shell and one real Paper using existing Barkpark editing | Pinned sources, supported authentication, read/edit/save/reopen, stable IDs, stale-revision rejection, no lossy round trip |
| 1: durable workspace | App-wide navigation, per-agent context, typed tabs, pins, project editor, draft recovery | Two different agent folders and a no-folder chat; restart restoration; exact paths; save conflicts; missing roots |
| 2: content discovery | Existing scoped search, media reuse, references, backlinks, related results | Permitted/forbidden queries, pagination, exact source opening, asset reuse/upload recovery, relationship provenance |
| 3: agent operation loop | One real provider, attributed proposals, application receipts and recovery | Start/stream/stop, background ownership, manual focus, duplicate events, stale ops, uncertain completion, supported undo |
| 4: connected alpha | Usability, accessibility, resilience, packaging and diagnostics | Complete end-to-end user journeys; environment/provider matrix; measured failures and latency; install/restart/reconnect |

## Requirement coverage map

| Requirement | Concept coverage | Production proof still required |
|---|---|---|
| BD-01 scoped connection | Not connected | Capability discovery; real auth and read-only enforcement |
| BD-02 workspace shell | Current shell and responsive checks | Native window behavior and accessibility |
| BD-03 workspace/path state | Tabs, recents, direct documents, nested paths | Durable restoration and unavailable targets |
| BD-04 persistent pins | In-memory navigation snapshots | Restart persistence, authorization, distinct routes |
| BD-05 Paper editing | Simplified main editor plus richer interaction study | Shared editor fidelity, supported blocks, real save/reopen |
| BD-06 search | Plan only | Scoped document/media results, filters, pagination and reference insertion |
| BD-07 relationships | Example linked documents and illustrative graph | Actual refs/backlinks/related provenance and scope |
| BD-08 media | Interaction reference only | Real asset reuse/upload, alt/caption, failure recovery |
| BD-09 agent session | Timed scripted walkthrough | Provider adapter, streaming, stop, reconnect, source targets |
| BD-10 visible changes | Simulated proposal/Keep/Discard | Authoritative operations and resulting revision |
| BD-11 conflict/recovery | Draft preservation checks only | Concurrent writes, stale revisions, uncertain receipts, idempotency |
| BD-12 history/undo | Illustrative change reversal only | Authorized real history, receipt expiry/conflicts, draft restore |
| BD-13 accessibility | Focusable controls, narrow reflow examples | Keyboard flows, assistive technologies, IME, 200% zoom |
| BD-14 structured views (P1) | Plan only | Schema-driven views grounded in pilot needs |
| BD-15 graph suggestions (P1) | Illustrated distinction | Evidence, explicit accept/write, dismissal semantics |
| BD-16 collaboration (P1) | Plan only | Audited comments/shared editing capabilities; no assumed CRDT |
| BD-17 broader agents (P1) | Plan only | Batch operation receipts/recovery and additional adapters |
| BD-18 broader platforms (P1) | Responsive browser concept only | OS installers, updates, shortcuts and native behavior |
| BD-19 typed tabs | Document/web/review/chat/project fixtures | Real hosts, lifecycle, origin/repository identity |
| BD-20 follow activity | Origin capture, focus pause, closed tabs, exact file events | Real events, target-key deduplication, ordering/reconnect |
| BD-21 side chats | Independent messages/drafts/context | Durable conversation and run identity, attached context |
| BD-22 agent context | Composer-local folder, app-wide sidebar | Multiple projects/environments, no-folder chat, root validation |
| BD-23 project editor | Editable fixture buffers, tree, expand/return | Host reads/writes, base-hash conflicts, recovery on close/restart |
| BD-24 folder chat | Folder creation/inheritance and exact target restoration | Authorized context capture and immutable run binding |

## Decision-critical scenarios

1. **App versus agent context.** Open chats whose agents use different checkouts. Sidebar documents and recents remain available. Start a file operation in A, select B, then verify A's actual tool runs in A. Opening a file in B must not rebind A or B. A direct document view does not gain a local folder implicitly.
2. **Focus and drafts.** During a run, type in a document or side-chat composer, select another tab, and close the target tab. Background events must preserve the draft, mark updates without stealing focus, and respect closure. Clicking the event opens its exact target.
3. **Pins and restart.** Pin two different paths to the same document. Make a newer edit. Restart and restore each pin. Paths and reading anchors restore; content remains current. Revoke access and repeat: show unavailable state, with no fallback to a different document or scope.
4. **Paper fidelity.** Round-trip all supported fixture block kinds through mount/edit/apply/reopen. Include stable references, block IDs, nested lists, media, and preserved unsupported payloads. Test composition/IME, paste, selection across blocks, attached menus, native undo, and focus at responsive pane boundaries.
5. **Mutation recovery.** Concurrently update a target revision. Drop connection before and after a server commit. Replay events. Retain drafts, reconcile by authoritative identity, and avoid duplicate changes. Stop a run after one acknowledged operation; that operation remains applied.
6. **File safety and save state.** Edit a buffer while the host changes the file. Save must report conflict, retaining both the local draft and a path to reconcile. Test path traversal, symlink escape, missing checkout, inaccessible host and permission failure at the server boundary.
7. **Search and graph access.** Mix allowed and forbidden results, stale pagination, inaccessible media, cross-project references, and ranked suggestions. No unauthorized source contents or automatic stored relationship may leak through previews.

## Completion report for each milestone

Record the exact source and runtime versions, commands and environments tested, the observed outcome of each relevant scenario, screenshots of real behavior, known limitations, and the next milestone. No performance, collaboration, security, or production-success claim should be inferred from these fixture tests.
