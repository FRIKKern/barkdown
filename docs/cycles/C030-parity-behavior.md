# C030 — Make editor gap evidence assert behavior

Starting source f3e67ac on isolated codex/parity-behavior-proof-12h. The old probe catches step failures and prints shapes, with no verified assertion report; C028 correctly keeps its parity row red.

Preserve its thirteen keyboard/paste interactions but assert intended editor structure and server acknowledgement after each one. Native Undo/Redo must restore the prior rich structure. Failed steps remain failures; do not infer correctness from a Saved label or type-count equality. Retain original probe in Git history and retain raw failure screenshots/video. Always close the owned Electron app, retain disposable data for diagnosis, and use the private-runtime wrapper for local execution. CI already owns a disposable configured server; its explicit CI environment remains supported.

No product, schema, upstream source, provider policy or credential changes. Native UI is currently owned by C023, then E010/E011. This lane may prepare offline only until an explicit grant. Root/app dependencies and Chromium installed; root31/app536 packages, app reports two existing high advisories. No audit fix or lockfile change.

Next: implement strict interaction assertions and exact server comparison; commit before native evidence. P1/G2 remain incomplete and this lane does not configure CI credentials.

Offline implementation prepared: thirteen explicit native editor predicates, full actual-server block acknowledgement with changed revision, no swallowed step failures, source-bound screenshots/video/report, owned Electron cleanup and retained disposable data. Initial syntax and app build pass. Independent upstream review corrected the quote selector to inline blockquote and constrained native-history normalization to fresh c-* bpId/null attributes while preserving seeded IDs and every other semantic/reference field. Actual UI remains unrun; strict comparisons may expose genuine mismatches and must not be weakened merely to pass.

Source6f935be is pushed; source syntax/app build pass. Pre-native root verify exits1 on inherited screenshot freshness (UI16a3b6085, capturee38038577), retained in evidence/C030-root-before-native.txt. No visual baseline changed and no native execution claimed. Next: named UI grant after C023/E010/C029/E011, then run the strict fixture against final editor source and retain any assertion failures.

Actual33428 at44fb480 against54579 exited1,0/13 green; [retained failure](../visual/editor-gap-assertions/runs/2026-09-22T05-37-13-229Z/README.md). Runtimezcf95g stopped/postmaster absent. Exact-ID comparison exposed duplicate inherited live identities; E012 investigates upstream. Ordinary quote predicate was wrong for joinBackward; fix separately preserving exact marks/siblings. No native pass/approval. C031 now owns UI.

Ordinary blockquote Backspace assertion corrected to exact native join into previous paragraph, preserving every mark/link/sibling and seeded ID; pullquote conversion remains distinct. Full acknowledged PortableDoc comparison stays byte-structurally strict, including IDs. Console prints only concise failures while complete result.json is retained. Syntax passes; native rerun waits E012 and named UI grant.

Second actual46068 e8ebae7/600fd failed0/13, retained [diagnosis](../visual/editor-gap-assertions/runs/2026-09-22T05-54-55-429Z/README.md). Exact paragraph IDs nowmatch; root fixture Saved regex had cp1252 mojibake, being repaired. Real taskList schema omits identity attributes, E012 followup. Native bullet joins preceding heading; expected exact transformation corrected separately. Privatehc4Z5K stopped/postmaster absent, UI released. No acceptance.

## Third native checkpoint — 06:11 UTC

Source `2af7e03` against upstream `f7fb3a46c`: **10/13 passed**, original [report](../visual/editor-gap-assertions/runs/2026-09-22T06-11-22-218Z/result.json) and raw video retained with 15 verified artifact hashes. Full block IDs and server content now agree. HTML Undo did not change the document; Redo comparison captured its expected bpType before acknowledgement; the bullet Backspace expectation differed from the observed lift. These remain failures, not an approval. No renderer errors. Owned Electron and private runtime stopped; postmaster absent. Full motion review remains pending. Next: record focus/history/key delivery, capture post-ack expected HTML, and assert native list lifting without dropping sibling/mark/identity checks.

## Diagnostic fixture and helper tripwire

The next source captures focus, history depth and delivered key events without refocusing or production changes. Expected HTML is recorded after acknowledgement; native list lifting retains sibling and mark checks. A failing-first regression exposed omitted `app/tests/lib` dependencies in screenshot fingerprints. The selector now includes them; approval-history and pixel tests pass. An incorrect working-directory command failed before commit and inadvertently began private startup (`wWdpO2`); it was interrupted before the fixture, with no owned process remaining. A stale postmaster.pid remains in retained private data: scoped pg_ctl status reports no server and stop reports PID 49080 does not exist. This is interrupted startup, not a successful wrapper cleanup. No capture from that attempt is claimed.

## Native focus/history diagnostic — 06:27 UTC

Source fc01c02, upstream8eb69ff58, privateKjnh2e/session97860:10/13 failed overall. All15 original hashes verified. HTMLUndo received Ctrl+Z with document/editor focus true; history changed23/0 to22/1, while full PM document remained identical. Before the next user action history returned23/0. This rules out a missed key for this attempt and motivates transaction/echo tracing; no cause or fix is claimed. Native bullet now joined the preceding heading, unlike the prior lift; oracle/caret determinism remains unresolved. Renderer errors empty. Wrapper stopped and postmaster absent. Editor granted next diagnostic; no combined approval.

## Native list contract clarification

Upstream canvas/index.js1766 explicitly handles first-item Backspace as a lift, before native ProseMirror joining. Retain the lift oracle; the previous join observation is not grounds to redefine the expected behavior. Next diagnostic captures selection depth, ancestor indices and parent offset immediately after Home/before Backspace. No production modification or new native pass.
