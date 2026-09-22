# C026 — Rejected-send draft preservation

Baseece4626, codex/send-preservation-12h, separate from frozen C025. Original adapter reproduction in evidence/C026-send/before.json: missing attachment validates before durable reservation; cleared draft/images plus ignored optimistic messages leaves no persisted human input, dispatch0.

Plan: leave submitted draft/references in composer and durable view until start acknowledges acceptance. Shared per-chat pending guard prevents duplicate main/side submissions. Capture draft revision and exact submitted values; clear only an unchanged draft after acceptance, preserve newer typing/attachments/history changes. Failure leaves original or newer draft with visible existing error, no automatic retry. Successful durable transcript remains main-owned. Do not infer no-dispatch from an unknown error or replay an attempt.

First tests: actual shared composer plus actual profile persistence in JSDOM, missing image rejection/reload, delayed successful/failed start with newer typing, duplicate submits and main/side shared ownership. Actual Electron later after implementation checkpoint and named UI grant. Dependencies and tests pending.

## Implementation checkpoint

Baseline failing actual-composer/persistence testVg9Kvo reproduced empty durable draft/images/messages with dispatch0. New shared per-chat pending intent and draft revision guard passes atDPXknR: missing image retains exact draft and reference after service reload. Five delayed controlled-ack cases pass through real main/side composer handlers and repository saves: unchanged success clears, newer text stays on success/rejection, editing away/back stays, attachment removal stays, duplicate submits dispatch once. Provider transport acceptance in these five cases is a controlled promise, not a native run claim.

Root/app npm ci and Chromium pass (root0 vulnerabilities/app2 existing high); app build and live-fixture syntax pass. Product changes limited to shared composer and conversation modules; no profile/provider/IPC changes. Draft remains durably saved until acknowledged start, and errors retain existing visible transcript error. Successful unchanged clearing uses existing debounced workspace persistence; no new claim about power loss between acknowledgement and that save. No automatic replay.

Actual Electron fixture prepared: selected B missing image with identical A name, explicit failed send/restart preserving prompt/reference/no HTTP request, restore only B image then one actual managed owned API run with controlled HTTP, verify B image bytes and newer draft on completed restart. No Electron launched yet; C025 and C026 each await named slots/evidence.
