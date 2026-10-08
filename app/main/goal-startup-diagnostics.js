// Opt-in timing only. Never forward worker output, launch arguments or credentials.
const MAIN = new Set(['launch-enter', 'environment-ready', 'launch-recorded', 'pipe-listening', 'helper-spawned', 'worker-connected', 'worker-hello', 'worker-first-message']);
const HOST = new Set(['host-enter', 'host-spec-read', 'host-compiled', 'job-created', 'prepared-saved', 'child-created', 'assigned-saved', 'child-resumed', 'stopped-saved']);
function createStartupDiagnostics(attemptId, { enabled = process.env.BARKDOWN_GOAL_DIAGNOSTICS === '1', write = line => process.stderr.write(line), now = Date.now } = {}) {
  const seen = new Set(); let buffer = '', discard = false;
  const record = (source, phase, at) => {
    if (!enabled || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attemptId) || !(source === 'main' ? MAIN : HOST).has(phase) || !Number.isSafeInteger(at) || at < 0) return;
    const key = source + ':' + phase; if (seen.has(key)) return; seen.add(key);
    try { write('[goal-startup] ' + JSON.stringify({ attemptId, source, phase, at }) + '\n'); } catch { /* Diagnostics cannot change process ownership or settlement. */ }
  };
  return {
    mark(phase) { if (enabled) record('main', phase, now()); },
    host(chunk) {
      if (!enabled) return;
      for (const char of String(chunk)) {
        if (char === '\n') {
          const match = !discard && /^BARKDOWN_GOAL_PHASE (\d{13}) ([a-z-]+)\r?$/.exec(buffer);
          if (match) record('host', match[2], Number(match[1]));
          buffer = ''; discard = false;
        } else if (!discard) {
          if (buffer.length >= 160) { buffer = ''; discard = true; } else buffer += char;
        }
      }
    },
  };
}
module.exports = { createStartupDiagnostics };
