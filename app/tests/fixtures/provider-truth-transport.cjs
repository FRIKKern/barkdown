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
      if (scenario === 'error' || scenario === 'nonzero') options.send({ type: 'error', message: scenario === 'nonzero' ? 'Codex Exec exited with code 1' : 'provider rejected request' });
      else if (scenario !== 'empty') options.send({ type: 'done', cancelled: false });
      if (scenario !== 'incomplete') resolveFinish({ status: scenario === 'error' || scenario === 'nonzero' ? 'failed' : 'completed', cancelled: false });
    });
    return { runId: 'controlled-run' };
  },
  waitForRunFinish() { return completion; },
  cancel() { fs.appendFileSync(process.env.PROVIDER_TRUTH_TRACE, 'cancel\n'); return true; },
  respondApproval() { throw Error('Unexpected approval'); },
  async verifyTermination() { return scenario !== 'incomplete'; },
};
Module._load = function(name, parent, ...rest) {
  if (name.endsWith('/main/agent.js')) return agent;
  if (name.endsWith('/main/goal-worker-agent.js')) return { createOwnedWorkerAgent: () => agent };
  return original.call(this, name, parent, ...rest);
};
