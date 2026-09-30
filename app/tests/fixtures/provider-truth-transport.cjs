// Offline runner fixture only. No SDK, process host, network or credentials.
const Module = require('module');
const fs = require('fs');
const original = Module._load;
const scenario = process.env.PROVIDER_TRUTH_SCENARIO;
let resolveFinish;
const completion = new Promise(resolve => { resolveFinish = resolve; });
const agent = {
  start(options) {
    fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, 'dispatch\n');
    queueMicrotask(async () => {
      const effects = ['success', 'delayed-finish', 'late-error', 'error-note', 'tool-error', 'cleanup-failed', 'unverified', 'approval', 'wrong-content', 'no-receipt', 'wrong-revision', 'no-read', 'no-effect', 'extra-document', 'malformed-extra', 'unexpected-tool', 'folder-change', 'wrong-target', 'sentinel-change'];
      if (effects.includes(scenario)) {
        const scope = options.scope;
        // The target is named in the prompt: a Paper (bp:) under the isolated runtime, else the legacy fixture.
        const targetId = /Read document (\S+)\./.exec(options.prompt)[1];
        const paperSlug = targetId.startsWith('bp:') ? targetId.slice(3) : null;
        const http = async (method, route, body) => { const r = await fetch(scope.connection.server + route, { method, headers: { authorization: 'Bearer ' + scope.connection.token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const data = await r.json().catch(() => null); if (!r.ok) throw new Error(method + ' ' + route + ' ' + r.status); return data && data.result && typeof data.result === 'object' ? data.result : data; };
        const doc = paperSlug ? await http('GET', `/v1/data/doc/production/paper/${paperSlug}?perspective=raw`).then(r => { const p = r.document || r; return { id: targetId, rev: p.rev, blocks: p.blocks }; }) : scope.documents.list()[0];
        if (scenario === 'extra-document') scope.documents.create({ title: 'Unexpected second fixture', markdown: 'worker-created extra content' });
        if (scenario === 'malformed-extra') fs.writeFileSync(scope.store.filePath('documents/extra.json'), 'invalid');
        const marker = JSON.parse(/exactly ("[^"]+")/.exec(options.prompt)[1]);
        const emitTool = (tool, id) => {
          options.send({ type: 'tool_start', tool, toolUseId: id, input: { id: doc.id, ...(tool === 'edit_document' ? { mode: 'append', markdown: marker } : {}) } });
          options.send({ type: 'tool_result', tool, toolUseId: id, ok: true });
        };
        if (scenario !== 'no-read') emitTool('read_document', 'read-before');
        if (scenario !== 'no-effect') await scope.edits.apply({ id: doc.id, baseRev: doc.rev, mode: 'append', markdown: scenario === 'wrong-content' ? 'WRONG' : marker, summary: 'Controlled edit' }, paperSlug ? scope.connection : undefined);
        emitTool('edit_document', 'edit');
        emitTool('read_document', 'read-after');
        if (scenario === 'no-receipt') for (const name of scope.store.list('agent-edits', '.json')) scope.store.remove('agent-edits/' + require('path').basename(name));
        if (scenario === 'wrong-revision') {
          if (paperSlug) { const current = await http('GET', `/v1/data/doc/production/paper/${paperSlug}?perspective=raw`); const p = current.document || current; await http('POST', `/v1/plugins/bulldocs/papers/${paperSlug}/ops`, { ifRev: p.rev, ops: [{ op: 'append-block', block: { id: 'later', type: 'paragraph', content: [{ type: 'text', value: 'A later revision.' }] } }] }); }
          else { const current = scope.documents.get(doc.id); scope.documents.save({ id: doc.id, baseRev: current.rev, content: current.content }); }
        }
        if (scenario === 'unexpected-tool') { options.send({ type: 'tool_start', tool: 'Bash', toolUseId: 'unexpected-command', input: { command: 'fixture-only, never executed' } }); options.send({ type: 'tool_result', tool: 'Bash', toolUseId: 'unexpected-command', ok: true }); }
        if (scenario === 'wrong-target') options.send({ type: 'tool_start', tool: 'read_document', toolUseId: 'other-document', input: { id: 'not-the-fixture' } });
        if (scenario === 'sentinel-change') fs.writeFileSync(require('path').join(scope.context.folder, 'fixture-sentinel.txt'), 'changed');
        if (scenario === 'folder-change') fs.writeFileSync(require('path').join(scope.context.folder, 'unexpected.txt'), 'unexpected');
        if (scenario === 'approval') options.send({ type: 'approval', runId: 'controlled-run', approvalId: 'unexpected', request: { kind: 'command', command: 'not authorized' } });
      }
      if (scenario === 'error' || scenario === 'nonzero') options.send({ type: 'error', message: scenario === 'nonzero' ? 'Codex Exec exited with code 1' : 'provider rejected request' });
      else if (scenario !== 'empty') options.send({ type: 'done', cancelled: false });
      if (scenario === 'late-error') options.send({ type: 'error', message: 'cleanup transport failed after done' });
      if (scenario === 'error-note') options.send({ type: 'error_note', message: 'Claude Code stopped: error_max_turns' });
      if (scenario === 'tool-error') options.send({ type: 'tool_result', ok: false, toolUseId: 'failed-tool' });
      const finish = () => {
        fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, 'finished\n');
        resolveFinish({ status: scenario === 'cleanup-failed' ? 'cleanup-failed' : ['error', 'nonzero', 'late-error'].includes(scenario) ? 'failed' : 'completed', cancelled: false });
      };
      if (scenario === 'delayed-finish') setTimeout(finish, 60);
      else if (scenario !== 'incomplete' && scenario !== 'cancelled-cleanup') finish();
    });
    return { runId: 'controlled-run' };
  },
  waitForRunFinish() { return completion; },
  cancel() { fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, 'cancel\n'); if (scenario === 'cancelled-cleanup') resolveFinish({ status: 'cancelled', cancelled: true }); return true; },
  respondApproval(runId, id, approved) { fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, `approval:${approved}\n`); },
  async verifyTermination() { fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, 'verify\n'); return scenario !== 'incomplete' && scenario !== 'unverified'; },
};
Module._load = function(name, parent, ...rest) {
  if (name.endsWith('/main/agent.js')) return agent;
  if (name.endsWith('/main/goal-worker-agent.js')) return { createOwnedWorkerAgent: () => agent };
  return original.call(this, name, parent, ...rest);
};
