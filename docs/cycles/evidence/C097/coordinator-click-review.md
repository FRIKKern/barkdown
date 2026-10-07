# Initial coordinator click acknowledgement

Desktop [37688437806](https://github.com/FRIKKern/barkdown/actions/runs/37688437806) failed on PR head 30c290d5 at the initial Plan and start click. Raw metadata/log and both original screenshots are retained in hosted-desktop-27*. Exactly one active goal and running plan attempt existed despite the click timeout; no fixture HTTP request had arrived. The helper was created 21:38:02.298 and its child 21:38:34.819 (32.521s). These observations do not identify the cause of either native or input latency. The previous full hosted pass at f190e831 remains valid historical proof; app source was unchanged between those runs. Verify 37688437529 passes.

The harness now gives click acknowledgement and the first real fixture stream one shared 90-second startup budget. It never retries the click. Timings are saved, and journal/request assertions require exactly one goal, plan task, attempt and initial HTTP request before the rest of the journey. Production helper, scheduler, UI and deadlines are unchanged.

## Controlled proof and retained failures

A diagnostic copy of the original journey blocks its actual renderer click listener for 35 seconds. Original harness fails 48.609s at the 30-second input wait, even though its diagnostic journal subsequently contains one goal/attempt. This is a synthetic dispatch stall, not a reproduction of the Windows helper cause.

The first corrected full probe still fails 79.180s: click acknowledgement 35.589s and first stream 36.133s succeed, then the planning-view assertion fails because Goals has closed. That failure is retained unchanged. An instrumented follow-up (coordinator-click-observed.mjs) records one trusted pointerdown/up/click at the intended button, no retry. Its complete eight-turn journey passes 61.335s with click acknowledgement 35.958s, first stream 36.280s and eight stopped receipts. The earlier synthetic-view dismissal remains unexplained; it is not counted as a pass or evidence of fixed production dismissal behavior.

Normal actual Electron coordinator passes 24.541s; crash/restart/review/retry 29.306s, with nine turns/eight stopped receipts and preserved drafts. All 22 commands from the ordinary coordinator through the Desktop tail pass 221.400s aggregate (segmented validation, not a new full-chain run). Terminal 85.963s verifies four owned receipts stopped; desktop-wide PNG/video stays local, seven page screenshots retained. Original history 16.416s.

The negative no-dispatch probe fails as intended in 102.776s total: the click returns in 32ms, the shared 90-second startup deadline expires with zero requests and no goal journal/receipts. Exact failed runner result and diagnostics are retained. The corrected test does not count a resolved click as successful startup.

## Review and limits

Reviewed 50 native images: two no-dispatch form images, two hosted failure, two original probe, two first corrected failure, seven ordinary, ten recovery, seven instrumented success, seven terminal and 11 Original history. Enlarged hosted/first corrected failure, instrumented 390px completion and ordinary recovery verified shutdown. Light fixture images intentionally retain comparison with the original hosted failure; dark Original history covers retained-note readability. No new product appearance is claimed. The regenerated full-size roadmap was inspected without clipped columns. Required standard/private-Paper capture and root verification follow the implementation commit.

Windows Node 22.13.1/npm 11.5.2/Electron 44.5.1; healthy locked dependencies reused. No credentials, real library, actual Mac export or real-provider retry. Estimate unchanged 495/(495+156), about 75%, 30–90%, low confidence for six migration checkpoints. Native latency and synthetic dismissal causes remain unknown.

Final visual review: capture29 from clean39c06b94 passes106.976s/27.568s/7.862s. All44 standard stills/diffs/motion and five Paper stills/37 GIF frames were inspected, with explicit approval in review-coordinator-click.json. Only temporary Settings path changed; no geometry change. Root45 passes45.712s. The retained root notebook demo still applies. Retention24 executed recoverably once.
