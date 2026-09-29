// Durable selection of the Paper engine for one profile (A2 step 4), and its way
// back (step 5). Runs only under a live preparation (foreground frozen, launches
// closed, captured writer quiescent) and under the upstream hold, so nothing can
// write to either engine between the sealed comparison and the durable intent.
// Storage helper only: no boot policy, no UI, no legacy retirement, no source
// cleanup. Staged Papers are never deleted; the legacy workspace is retained.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createStore } = require('./store');
const { atomicWrite } = require('./atomic-write');
const { createUpstreamAdmission } = require('./upstream-admission');
const { projectOwnedWorkspace } = require('./migration-workspace');
const { canonical, hash, fail, record, read } = require('./migration-journal');

const journalName = 'selection.json';
const phases = new Set(['intent', 'replacing', 'selected', 'rolling-back', 'rolled-back']);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// The replacement text is derived from the canonical form on both sides of a restart.
const pretty = value => JSON.stringify(JSON.parse(canonical(value)), null, 2) + '\n';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);

function createMigrationSelection({ preparation, comparison, admission = createUpstreamAdmission(), project = projectOwnedWorkspace, checkpoint = () => {}, now = () => new Date().toISOString() }) {
  if (typeof preparation?.withPrepared !== 'function') throw new TypeError('A live preparation coordinator is required');
  if (typeof comparison?.compare !== 'function') throw new TypeError('A migration comparison is required');
  const workspaceOf = store => store.filePath('workspace.json');
  function journal(store) {
    const value = read(store, journalName);
    if (!value) return null;
    if (value.version !== 1 || !phases.has(value.phase) || !uuid(value.operationId) || typeof value.profileId !== 'string' || !value.seal || typeof value.reportHash !== 'string' || typeof value.workspaceBefore !== 'string') fail('selection_journal', 'Unreadable selection journal; explicit inspection required');
    return value;
  }
  function bytes(file) { return fs.existsSync(file) ? fs.readFileSync(file) : null; }
  function transition(store, current, next) {
    const file = store.filePath(journalName), expected = current ? Buffer.from(canonical(current) + '\n') : null;
    if (expected && !bytes(file)?.equals(expected)) fail('selection_journal', 'Selection journal changed under the coordinator');
    atomicWrite(file, canonical(next) + '\n', { expectedBytes: expected, assertOwned: () => {} });
    checkpoint('after-' + next.phase, structuredClone(next));
    return next;
  }
  function inspect(profileId, sourceDir) {
    const store = createStore(sourceDir, { create: false });
    try {
      const j = journal(store);
      if (!j) return { status: 'none', authority: 'legacy', actions: [] };
      if (j.profileId !== profileId) fail('selection_owner', 'Selection journal belongs to another profile');
      const current = bytes(workspaceOf(store)), digest = current ? sha(current) : null;
      const legacy = read(store, 'selection/workspace-legacy.json');
      if (j.retained && (!legacy || legacy.operationId !== j.operationId || sha(Buffer.from(legacy.bytes)) !== j.workspaceBefore)) fail('selection_retained', 'The retained legacy workspace is missing or changed; explicit inspection required');
      switch (j.phase) {
        case 'intent': return { status: 'intent', authority: 'legacy', operationId: j.operationId, actions: digest === j.workspaceBefore ? ['resume', 'rollback'] : [], changed: digest !== j.workspaceBefore };
        case 'replacing': return { status: 'replacing', authority: 'legacy', operationId: j.operationId, actions: digest === j.workspaceBefore || digest === j.workspaceAfter ? ['resume', 'rollback'] : [], changed: digest !== j.workspaceBefore && digest !== j.workspaceAfter };
        case 'selected': return { status: 'selected', authority: 'paper', operationId: j.operationId, seal: j.seal, reopenedGeneration: j.reopenedGeneration ?? null, actions: ['rollback'], changed: digest !== j.workspaceAfter };
        case 'rolling-back': return { status: 'rolling-back', authority: 'legacy', operationId: j.operationId, actions: digest === j.workspaceAfter || digest === j.workspaceBefore ? ['rollback'] : [], changed: false };
        default: return { status: 'rolled-back', authority: 'legacy', operationId: j.operationId, actions: [], changed: digest !== j.workspaceBefore, divergence: j.divergence ?? null, retainedPaperWorkspace: j.workspaceRetained ?? null, reconciliationRequired: Boolean(j.divergence) };
      }
    } catch (error) { return { status: 'blocked', authority: 'legacy', error: error.message, code: error.code, actions: [] }; }
  }
  // Every transition of either direction runs under the same two fences.
  async function fenced(options, target, operation, fn, { timeoutMs = 60000 } = {}) {
    if (typeof options?.profileId !== 'string' || typeof options?.sourceDir !== 'string') throw new TypeError('A profile-bound migration request is required');
    return preparation.withPrepared(options.profileId, async scope => {
      const store = createStore(options.sourceDir, { create: false });
      if (store.dir() !== scope.sourceDir) fail('selection_source', 'Source does not belong to the live preparation');
      checkpoint('hold:begin', { operation });
      const begun = await admission.hold(target, operation);
      checkpoint('hold:begun', { operation, phase: begun.phase });
      const held = begun.phase === 'held' ? begun : await admission.awaitHeld(target, begun.capability, { timeoutMs });
      checkpoint('hold:held', { operation });
      let result, failure = null;
      try { result = await fn({ store, scope, held }); } catch (error) { failure = error; }
      let reopened;
      try { reopened = await admission.reopen(target, held.capability); checkpoint('hold:reopened', { operation }); }
      catch (error) { throw Object.assign(new Error('The runtime could not be reopened and stays held for explicit recovery: ' + error.message), { code: error.code || 'upstream_reopen', cause: error, selectionFailure: failure }); }
      if (failure) throw failure;
      const j = journal(store);
      if (j && j.reopenedGeneration == null && j.operationId === result?.operationId) transition(store, j, { ...j, reopenedGeneration: reopened.generation });
      return inspect(options.profileId, options.sourceDir);
    });
  }
  async function select(options, target, settings) {
    return fenced(options, target, `select-${options.profileId}`, async ({ store, scope, held }) => {
      let j = journal(store);
      if (j && j.profileId !== options.profileId) fail('selection_owner', 'Selection journal belongs to another profile');
      if (j?.phase === 'selected') return j;
      if (j && ['rolling-back', 'rolled-back'].includes(j.phase)) fail('selection_rolled_back', 'This selection was rolled back; its retained evidence requires inspection before a new selection');
      if (j && j.preparationId !== scope.preparation.id) fail('selection_preparation', 'The selection intent belongs to another preparation; abort and prepare again, or roll back');
      const workspace = workspaceOf(store), before = bytes(workspace);
      if (!before) fail('selection_workspace', 'The profile has no workspace to replace');
      if (!j) {
        const report = typeof comparison.compareWithin === 'function' ? await comparison.compareWithin(scope, options, target) : await comparison.compare(options, target);
        if (report?.status !== 'compared' || report.authority !== 'legacy') fail('selection_report', 'Selection needs a fresh compared report');
        const projected = await project(options, target);
        if (projected?.status !== 'preview' || projected.issues?.length || !projected.workspace || typeof projected.projectionHash !== 'string') fail('selection_projection', 'Owned navigation projection is blocked: ' + (projected?.issues?.[0]?.reason || 'no projection'));
        if (projected.workspaceHash !== sha(before)) fail('selection_changed', 'The workspace changed between projection and selection');
        await scope.assertCurrent();
        const intent = { version: 1, profileId: options.profileId, operationId: crypto.randomUUID(), phase: 'intent', at: now(),
          preparationId: scope.preparation.id, closureId: scope.preparation.closureId ?? null,
          seal: { operation: `select-${options.profileId}`, generation: held.generation, boot: held.boot },
          reportHash: hash(report), projectionHash: projected.projectionHash, sourceHash: report.identity?.sourceHash ?? options.expectedSourceHash ?? null,
          target: projected.target ?? null, paperOwner: projected.paperOwner ?? null,
          workspaceBefore: sha(before), workspaceAfter: sha(Buffer.from(pretty(projected.workspace))) };
        record(store, `selection/${intent.operationId}/intent.json`, intent);
        record(store, `selection/${intent.operationId}/projected-workspace.json`, { version: 1, operationId: intent.operationId, workspace: projected.workspace });
        j = transition(store, null, intent);
      }
      const projected = read(store, `selection/${j.operationId}/projected-workspace.json`);
      if (!projected || projected.operationId !== j.operationId) fail('selection_journal', 'Projected workspace record is missing');
      const text = pretty(projected.workspace);
      if (sha(Buffer.from(text)) !== j.workspaceAfter) fail('selection_journal', 'Projected workspace record changed');
      const current = bytes(workspace);
      if (j.phase === 'intent') {
        if (sha(current) !== j.workspaceBefore) fail('selection_changed', 'The workspace changed after the selection intent; explicit reconciliation is required');
        record(store, 'selection/workspace-legacy.json', { version: 1, operationId: j.operationId, bytes: current.toString('utf8') });
        await scope.assertCurrent();
        j = transition(store, j, { ...j, phase: 'replacing', retained: true });
      }
      if (j.phase === 'replacing') {
        const again = bytes(workspace), digest = sha(again);
        if (digest === j.workspaceBefore) { await scope.assertCurrent(); atomicWrite(workspace, text, { expectedBytes: again, assertOwned: () => {} }); checkpoint('after-workspace-replaced', { operationId: j.operationId }); }
        else if (digest !== j.workspaceAfter) fail('selection_changed', 'The workspace changed during replacement; explicit reconciliation is required');
        if (sha(bytes(workspace)) !== j.workspaceAfter) fail('selection_changed', 'Replaced workspace does not read back as projected');
        await scope.assertCurrent();
        j = transition(store, j, { ...j, phase: 'selected', selectedAt: now() });
      }
      return j;
    }, settings);
  }
  async function rollback(options, target, settings) {
    return fenced(options, target, `rollback-${options.profileId}`, async ({ store, scope }) => {
      let j = journal(store);
      if (!j) fail('selection_none', 'There is no selection to roll back');
      if (j.profileId !== options.profileId) fail('selection_owner', 'Selection journal belongs to another profile');
      if (j.phase === 'rolled-back') return j;
      const legacy = read(store, 'selection/workspace-legacy.json');
      const workspace = workspaceOf(store), current = bytes(workspace), digest = current ? sha(current) : null;
      if (j.phase === 'intent') {
        if (digest !== j.workspaceBefore) fail('selection_changed', 'The workspace changed after the intent; explicit reconciliation is required');
        return transition(store, j, { ...j, phase: 'rolled-back', rolledBackAt: now() });
      }
      if (!legacy || legacy.operationId !== j.operationId || sha(Buffer.from(legacy.bytes)) !== j.workspaceBefore) fail('selection_retained', 'The retained legacy workspace is missing or changed; explicit inspection required');
      // Ordinary use on Paper rewrites the workspace (tabs, chats, expanded pages). That is
      // navigation, not notes: it is retained beside the legacy copy, never merged back, and
      // the legacy navigation is restored exactly (D-migration-rollback-workspace).
      let workspaceRetained = j.workspaceRetained ?? null;
      if (digest !== j.workspaceAfter && digest !== j.workspaceBefore) {
        record(store, 'selection/workspace-paper.json', { version: 1, operationId: j.operationId, sha: digest, bytes: current.toString('utf8') });
        workspaceRetained = digest;
      }
      if (j.phase !== 'rolling-back' || workspaceRetained !== (j.workspaceRetained ?? null)) { await scope.assertCurrent(); j = transition(store, j, { ...j, phase: 'rolling-back', workspaceRetained }); }
      if (digest !== j.workspaceBefore) { await scope.assertCurrent(); atomicWrite(workspace, legacy.bytes, { expectedBytes: current, assertOwned: () => {} }); checkpoint('after-workspace-restored', { operationId: j.operationId }); }
      if (sha(bytes(workspace)) !== j.workspaceBefore) fail('selection_changed', 'Restored workspace does not read back as retained');
      // Paper edits made after the switch stay on Paper. With the legacy navigation back
      // in place the source matches its pinned backup again, so the comparison can say
      // whether the library diverged; a divergence is recorded for explicit
      // reconciliation, never converted back.
      let divergence = null;
      try { if (typeof comparison.compareWithin === 'function') await comparison.compareWithin(scope, options, target); else await comparison.compare(options, target); }
      catch (error) { if (!String(error?.code || '').startsWith('comparison_')) throw error; divergence = { code: error.code, message: error.message, at: now(), ...(Array.isArray(error.details) ? { details: error.details.slice(0, 200) } : {}) }; }
      await scope.assertCurrent();
      return transition(store, j, { ...j, phase: 'rolled-back', divergence, rolledBackAt: now() });
    }, settings);
  }
  return Object.freeze({ select, rollback, inspect });
}
// The boot-side question, answered from the journal alone: which engine owns this
// profile's notes, and whether a switch is mid-flight. Read by the legacy document
// store before every write and by the profile view.
function selectionStatus(store) {
  try {
    // Registry store handles carry storeDir but no filePath; read through a file store.
    if (typeof store?.filePath !== 'function' && typeof store?.storeDir === 'string') store = createStore(store.storeDir, { create: false });
    const value = read(store, journalName);
    if (!value) return { status: 'none', authority: 'legacy' };
    if (value.version !== 1 || !phases.has(value.phase)) return { status: 'blocked', authority: 'legacy', error: 'Unreadable selection journal' };
    if (value.phase === 'selected') return { status: 'selected', authority: 'paper', operationId: value.operationId };
    if (value.phase === 'rolled-back') return { status: 'rolled-back', authority: 'legacy', operationId: value.operationId };
    return { status: value.phase, authority: 'legacy', operationId: value.operationId };
  } catch (error) { return { status: 'blocked', authority: 'legacy', error: error.message }; }
}
module.exports = { createMigrationSelection, selectionStatus };
