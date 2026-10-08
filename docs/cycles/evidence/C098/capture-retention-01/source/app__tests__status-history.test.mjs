import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { archiveStatusManifest } from './helpers/status-history.mjs';

test('archives each status manifest under its own capturedAt without overwriting history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-status-history-'));
  const first = { capturedAt: '2026-09-22T02:15:37.408Z', barkdownCommit: 'old' };
  const current = { capturedAt: '2026-09-22T22:32:05.405Z', barkdownCommit: 'new' };
  const firstPath = archiveStatusManifest(root, first);
  const currentPath = archiveStatusManifest(root, current);
  assert.match(firstPath, /2026-09-22T02-15-37-408Z\.json$/);
  assert.match(currentPath, /2026-09-22T22-32-05-405Z\.json$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(firstPath)), first);
  assert.deepEqual(JSON.parse(fs.readFileSync(currentPath)), current);
  assert.equal(archiveStatusManifest(root, current), currentPath, 'identical retry is idempotent');
  assert.throws(() => archiveStatusManifest(root, { ...current, barkdownCommit: 'collision' }), /collision/);
});
