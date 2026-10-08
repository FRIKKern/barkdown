// Skip ratchet (D-hosts): every platform-only test is counted here, per kind. The pins move only
// with a twin on the other desktop platforms or a recorded, owned gap; a silent new skip fails.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs') && f !== 'host-skips.test.mjs');
const count = pattern => files.reduce((n, f) => n + (fs.readFileSync(path.join(dir, f), 'utf8').match(pattern) || []).length, 0);

test('platform-only skips are pinned per kind and named', () => {
  const pins = {
    // Seven atomic-write sites exercise Windows reader/rename semantics. C098 adds two native
    // sites: carried Windows release recognition and System32/PowerShell batch execution with
    // a verified NTFS short alias. Their POSIX/shared-contract tests remain separate; these OS
    // primitives have no POSIX twin. C098 owns the recorded gap and next macOS regression pass.
    unitSkipsOffWindows: { pattern: /skip:\s*process\.platform\s*!==\s*'win32'/g, expected: 9 },
    // live files that exit early off Windows through helpers/host.mjs: PowerShell terminal tour, recovery review tour, DPAPI durability.
    liveFilesSkippedOffWindows: { pattern: /^skipUnlessWindows\(/gm, expected: 0 },
    // blocks gated inline on win32 (profile-preparation's terminal ownership halves, profile-registry).
    inlineWindowsHalves: { pattern: /^\s*if \(process\.platform === 'win32'\) \{$/gm, expected: 3 },
  };
  for (const [kind, { pattern, expected }] of Object.entries(pins)) {
    const actual = count(pattern);
    assert.equal(actual, expected, `${kind}: ${actual} platform-only sites, pinned at ${expected}. Add the twin on the other platforms or record the gap with an owner in docs/cycles, then move this pin in the same commit.`);
  }
});
