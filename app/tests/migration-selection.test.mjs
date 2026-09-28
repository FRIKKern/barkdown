import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMigrationSelection } = require('../main/migration-selection');
const { createStore } = require('../main/store');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture({ compareError = null, projectionIssue = null, drain = 0, onCheckpoint = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-selection-'));
  const profileId = '11111111-1111-4111-8111-111111111111', sourceDir = path.join(root, 'profile');
  fs.mkdirSync(sourceDir, { recursive: true });
  createStore(sourceDir);
  const legacy = { version: 1, profileId, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: ['note'], children: {}, expanded: {} }, favorites: [{ id: 'fav', target: { kind: 'doc', id: 'note', source: 'local' } }] };
  const legacyText = JSON.stringify(legacy, null, 2) + '\n';
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), legacyText);
  const projectedWorkspace = { ...legacy, favorites: [{ id: 'fav', target: { kind: 'doc', id: 'p-note', source: 'barkpark', paperOwner: 'owner-1' } }] };
  const calls = [], state = { phase: 'open', generation: 5, capability: null, polls: drain, prepared: { id: crypto.randomUUID(), closureId: crypto.randomUUID() }, current: true };
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const preparation = { async withPrepared(id, fn) { assert.equal(id, profileId); calls.push(['withPrepared']); return fn({ sourceDir, preparation: state.prepared, assertCurrent: async () => { if (!state.current) throw fail('preparation_changed', 'Preparation changed'); return true; } }); } };
  const admission = {
    async hold(target, operation) { calls.push(['hold', operation, state.phase]); if (state.capability) return { capability: state.capability, operation, phase: state.phase, generation: state.generation, boot: 'boot' }; state.capability = 'cap-' + operation; state.phase = drain ? 'closing' : 'held'; return { capability: state.capability, operation, phase: state.phase, generation: state.generation, boot: 'boot' }; },
    async awaitHeld(target, capability) { calls.push(['awaitHeld']); state.phase = 'held'; return { capability, phase: 'held', generation: state.generation, boot: 'boot' }; },
    async reopen(target, capability) { calls.push(['reopen', capability]); state.phase = 'open'; state.capability = null; state.generation++; return { phase: 'open', generation: state.generation, boot: 'boot' }; },
    async status() { throw new Error('unused'); },
  };
  const comparison = { async compare() { calls.push(['compare', state.phase]); if (compareError) throw fail(compareError, 'mismatch'); return { version: 1, status: 'compared', identity: { sourceHash: 'src' }, documents: 3, authority: 'legacy', activationAllowed: false }; } };
  const project = async () => { calls.push(['project', state.phase]); const current = fs.readFileSync(path.join(sourceDir, 'workspace.json')); return projectionIssue ? { status: 'blocked', issues: [{ path: '$', reason: projectionIssue }], workspace: null } : { status: 'preview', issues: [], workspace: structuredClone(projectedWorkspace), projectionHash: 'proj', workspaceHash: sha(current), target: { server: 'http://127.0.0.1:1' }, paperOwner: 'owner-1' }; };
  const checkpoint = (phase, value) => { calls.push(['checkpoint', phase]); if (onCheckpoint) onCheckpoint(phase, value); };
  const selection = () => createMigrationSelection({ preparation, comparison, admission, project, checkpoint, now: () => 'T' });
  const options = { profileId, sourceDir, expectedSourceHash: 'src' }, target = { server: 'http://127.0.0.1:1', token: 't' };
  const workspace = () => fs.readFileSync(path.join(sourceDir, 'workspace.json'), 'utf8');
  return { root, profileId, sourceDir, options, target, calls, state, selection, legacyText, projectedText: JSON.stringify(JSON.parse(require('../main/migration-journal').canonical(projectedWorkspace)), null, 2) + '\n', workspace };
}

test('selection replaces the workspace atomically under both fences and records the seal', async () => {
  const f = fixture({ drain: 1 });
  const result = await f.selection().select(f.options, f.target);
  assert.equal(result.status, 'selected'); assert.equal(result.authority, 'paper'); assert.deepEqual(result.actions, ['rollback']);
  assert.deepEqual(result.seal, { operation: 'select-' + f.profileId, generation: 5, boot: 'boot' }); assert.equal(result.reopenedGeneration, 6);
  assert.equal(f.workspace(), f.projectedText);
  const order = f.calls.map(c => c[0] === 'checkpoint' ? 'cp:' + c[1] : c[0]);
  assert.deepEqual(order, ['withPrepared', 'hold', 'awaitHeld', 'compare', 'project', 'cp:after-intent', 'cp:after-replacing', 'cp:after-workspace-replaced', 'cp:after-selected', 'reopen', 'cp:after-selected']);
  assert.equal(f.calls.find(c => c[0] === 'compare')[1], 'held');
  const store = createStore(f.sourceDir, { create: false });
  const journal = store.readJson('selection.json');
  const retained = store.readJson('selection/workspace-legacy.json');
  assert.equal(retained.bytes, f.legacyText); assert.equal(retained.operationId, journal.operationId);
  assert.ok(fs.existsSync(store.filePath(`selection/${journal.operationId}/intent.json`)));
  // Idempotent: selecting again neither compares nor rewrites.
  const again = await f.selection().select(f.options, f.target);
  assert.equal(again.status, 'selected'); assert.equal(again.operationId, result.operationId);
  assert.ok(!f.calls.slice(order.length).some(c => c[0] === 'compare' || c[0] === 'project'));
  assert.equal(f.state.phase, 'open');
});

test('rollback restores the retained legacy workspace and refuses after a later change', async () => {
  const f = fixture();
  await f.selection().select(f.options, f.target);
  const back = await f.selection().rollback(f.options, f.target);
  assert.equal(back.status, 'rolled-back'); assert.equal(back.authority, 'legacy');
  assert.equal(f.workspace(), f.legacyText);
  assert.ok(fs.existsSync(path.join(f.sourceDir, 'selection', 'workspace-legacy.json')), 'the retained copy stays');
  await assert.rejects(f.selection().select(f.options, f.target), { code: 'selection_rolled_back' });
  assert.equal((await f.selection().rollback(f.options, f.target)).status, 'rolled-back');
  const g = fixture();
  await g.selection().select(g.options, g.target);
  fs.writeFileSync(path.join(g.sourceDir, 'workspace.json'), g.projectedText.replace('"fav"', '"fav-2"'));
  assert.equal(g.selection().inspect(g.profileId, g.sourceDir).changed, true);
  await assert.rejects(g.selection().rollback(g.options, g.target), { code: 'selection_changed' });
  assert.equal(g.state.phase, 'open', 'the hold is reopened after a refused rollback');
});

test('an interrupted selection resumes with the same operation, or rolls back from the intent', async () => {
  for (const crashAt of ['after-intent', 'after-replacing', 'after-workspace-replaced']) {
    let armed = true;
    const f = fixture({ onCheckpoint: phase => { if (armed && phase === crashAt) { armed = false; throw Object.assign(new Error('crash at ' + phase), { code: 'crash' }); } } });
    await assert.rejects(f.selection().select(f.options, f.target), { code: 'crash' });
    assert.equal(f.state.phase, 'open', 'the hold is reopened after a crash');
    const seen = f.selection().inspect(f.profileId, f.sourceDir);
    assert.ok(['intent', 'replacing'].includes(seen.status), crashAt + ' → ' + seen.status);
    assert.ok(seen.actions.includes('resume'));
    const before = f.calls.length;
    const result = await f.selection().select(f.options, f.target);
    assert.equal(result.status, 'selected'); assert.equal(result.operationId, seen.operationId); assert.equal(f.workspace(), f.projectedText);
    assert.ok(!f.calls.slice(before).some(c => c[0] === 'compare'), 'resume reuses the recorded intent instead of comparing again');
  }
  const g = fixture({ onCheckpoint: phase => { if (phase === 'after-intent') throw Object.assign(new Error('crash'), { code: 'crash' }); } });
  await assert.rejects(g.selection().select(g.options, g.target), { code: 'crash' });
  const back = await g.selection().rollback(g.options, g.target);
  assert.equal(back.status, 'rolled-back'); assert.equal(g.workspace(), g.legacyText);
});

test('refusals: a failed comparison, a blocked projection, a changed preparation, another preparation', async () => {
  const f = fixture({ compareError: 'comparison_target' });
  await assert.rejects(f.selection().select(f.options, f.target), { code: 'comparison_target' });
  assert.equal(f.state.phase, 'open'); assert.equal(f.workspace(), f.legacyText); assert.equal(f.selection().inspect(f.profileId, f.sourceDir).status, 'none');
  const g = fixture({ projectionIssue: 'Missing local document' });
  await assert.rejects(g.selection().select(g.options, g.target), { code: 'selection_projection' });
  assert.equal(g.selection().inspect(g.profileId, g.sourceDir).status, 'none');
  const h = fixture(); h.state.current = false;
  await assert.rejects(h.selection().select(h.options, h.target), { code: 'preparation_changed' });
  assert.equal(h.workspace(), h.legacyText);
  const k = fixture({ onCheckpoint: phase => { if (phase === 'after-intent') throw Object.assign(new Error('crash'), { code: 'crash' }); } });
  await assert.rejects(k.selection().select(k.options, k.target), { code: 'crash' });
  k.state.prepared = { id: crypto.randomUUID(), closureId: crypto.randomUUID() };
  await assert.rejects(k.selection().select(k.options, k.target), { code: 'selection_preparation' });
});
