// Run after npm install (package.json "postinstall"): Playwright drives Electron without Chromium's focus emulation.
//
// Playwright turns on focus emulation in every page it drives, and under Electron it drives each website tab
// (<webview>) as a page. When such a tab commits a navigation in a new renderer frame, Chromium tears the old
// frame's DevTools session down; turning the emulation off there reaches a frame that is already half detached
// (FrameSelection::FocusedOrActiveStateChanged ← FocusController::FocusHasChanged ← InspectorEmulationAgent::
// setFocusEmulationEnabled ← ::disable ← DevToolsSession::Detach ← Frame::Swap) and the tab's renderer crashes
// with SIGSEGV. On GitHub's Intel Mac it failed profile-ui almost every run; with the emulation skipped it did
// not crash once (docs/RELEASE.md, Intel). Barkdown never enables focus emulation, so people never meet this;
// only the tests did. Every test window is brought to the front instead (BARKDOWN_TEST_FOREGROUND).
//
// The change is one condition in playwright-core. When an upgrade moves that code, this refuses loudly rather
// than leaving the tests to crash again.
const fs = require('fs');
const file = require.resolve('playwright-core/package.json').replace(/package\.json$/, 'lib/coreBundle.js');
const before = 'if (this._isMainFrame() && !skipDefaultOverrides)\n            promises2.push(this._client.send("Emulation.setFocusEmulationEnabled"';
const after = 'if (this._isMainFrame() && !skipDefaultOverrides && this._crPage._browserContext._browser.options.name !== "electron")\n            promises2.push(this._client.send("Emulation.setFocusEmulationEnabled"';
const source = fs.readFileSync(file, 'utf8');
if (source.includes(after)) process.exit(0);
if (!source.includes(before)) {
  console.error(`playwright-electron-focus: ${file} no longer has the focus-emulation line this patch changes; see scripts/playwright-electron-focus.cjs`);
  process.exit(1);
}
fs.writeFileSync(file, source.replace(before, after));
console.log('playwright-electron-focus: Playwright drives Electron without focus emulation');
