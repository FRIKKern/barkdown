# C016 Paper loading-position investigation

Isolated codex/paper-loading-position-12h from b07fa9f. No UI/runtime launch. Production source audit: normal focusTab, closeTab and openTarget call savePositions, which invokes Paper.savePosition even while initial get/bundle awaits. Its empty scroller has0 and overwrites persisted360. This is user reachable, not solely a live-fixture artifact.

Controlled actual mountPaper deferred-read regression fails0 versus360; all23 existing host cases pass. JSDOM controls transport/canvas, so this is host ownership proof, not actual layout proof. App npm ci passes with2 existing high advisories. Parent authorized bounded fix after this failing checkpoint: preserve pending restoration until layout ready, continue recording genuine human scrolling including zero. Required followup is regression pass plus named real UI evidence; C016 actual dual-runtime sequence remains open.
