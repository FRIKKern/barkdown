import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { createStartupDiagnostics } = createRequire(import.meta.url)('../main/goal-startup-diagnostics');
const id = '11111111-1111-4111-8111-111111111111';

test('startup timing is opt-in and rejects non-owned identity', () => {
  for (const [attempt, enabled] of [[id, false], ['untrusted identity', true]]) {
    const output = [], d = createStartupDiagnostics(attempt, { enabled, write: line => output.push(line) });
    d.mark('launch-enter'); d.host('BARKDOWN_GOAL_PHASE 1791420247101 host-enter\n');
    assert.deepEqual(output, []);
  }
});

test('split host phases survive; arbitrary output, overlong lines and repeats never reach diagnostic records', () => {
  const output = [], d = createStartupDiagnostics(id, { enabled: true, now: () => 1791420247100, write: line => output.push(JSON.parse(line.slice('[goal-startup] '.length))) });
  d.mark('launch-enter'); d.mark('launch-enter'); d.mark('credential=do-not-copy');
  d.host('arbitrary secret\nBARKDOWN_GOAL_');
  d.host('PHASE 1791420247101 host-enter\r\n');
  d.host('BARKDOWN_GOAL_PHASE 1791420247101 host-enter\nBARKDOWN_GOAL_PHASE 1791420247102 token-secret\n');
  d.host('x'.repeat(10000) + 'BARKDOWN_GOAL_PHASE 1791420247103 host-compiled\n');
  d.host('BARKDOWN_GOAL_PHASE 1791420247104 host-compiled\n');
  assert.deepEqual(output.map(x => [x.source, x.phase, x.at]), [['main', 'launch-enter', 1791420247100], ['host', 'host-enter', 1791420247101], ['host', 'host-compiled', 1791420247104]]);
  assert.ok(output.every(x => x.attemptId === id && Object.keys(x).join(',') === 'attemptId,source,phase,at'));
  assert.doesNotMatch(JSON.stringify(output), /secret|credential/);
});

test('diagnostic output failure does not change the launch or settlement path', () => {
  const d = createStartupDiagnostics(id, { enabled: true, write: () => { throw Error('diagnostic sink unavailable'); } });
  assert.doesNotThrow(() => { d.mark('worker-hello'); d.host('BARKDOWN_GOAL_PHASE 1791420247101 stopped-saved\n'); });
});
