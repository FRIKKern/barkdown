// The user's own Claude Code and Codex (C088 S2): which file is the tool, and is it really the tool.
// The path from Settings wins; otherwise the tool is looked up on the login-shell PATH. Whatever is
// found is run once with --version, within a bounded time, and only a file that answers like the
// tool is reported as one. Results are kept per file and modification time, so a check costs one
// process per install, not one per chat.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { resolveProviderCli } = require('./provider-cli');
const PROVIDERS = ['claude', 'codex'];
const LOOKS_LIKE = { claude: /claude/i, codex: /codex/i };
const VERSION = /\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?/;
// The tool versions the pinned SDKs were built with (scripts/provider-versions.mjs).
const TESTED = require('./provider-versions.json');
const parts = v => String(v || '').split(/[-+]/)[0].split('.').map(n => Number(n) || 0);
function compareVersions(a, b) { const x = parts(a), y = parts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1; } return 0; }
// How an installed version sits against the tested one: the same or a newer minor is silent; older
// than tested, or a different major, gets a warning that names the tested version.
function fitOf(provider, version) {
  const tested = TESTED[provider]?.cli; if (!tested || !version) return { fit: 'unknown', tested };
  if (parts(version)[0] !== parts(tested)[0]) return { fit: 'major', tested, advice: `${TESTED[provider].name} ${version} is a different major version than the ${tested} Barkdown was tested with; chats may fail until one of them changes.` };
  const order = compareVersions(version, tested);
  if (order < 0) return { fit: 'older', tested, advice: `${TESTED[provider].name} ${version} is older than the ${tested} Barkdown was tested with. Update it with its own installer.` };
  return { fit: order === 0 ? 'tested' : 'newer', tested };
}
function runVersion(file, { timeoutMs, env, spawnImpl = spawn }) {
  return new Promise(resolve => {
    let child, out = '', done = false;
    const finish = result => { if (done) return; done = true; clearTimeout(timer); resolve(result); };
    const timer = setTimeout(() => { try { child?.kill('SIGKILL'); } catch {} finish({ code: null, output: out, timedOut: true }); }, timeoutMs);
    try { child = spawnImpl(file, ['--version'], { env: { ...env, ELECTRON_RUN_AS_NODE: undefined }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch (error) { return finish({ code: null, output: '', error: error.message }); }
    const take = chunk => { if (out.length < 2048) out += chunk; };
    child.stdout.on('data', take); child.stderr.on('data', take);
    child.on('error', error => finish({ code: null, output: out, error: error.message }));
    child.on('close', code => finish({ code, output: out }));
  });
}
const firstLine = text => String(text || '').split(/\r?\n/).map(l => l.trim()).find(Boolean) || '';
function createProviderTools({ settings = () => ({}), env = async () => process.env, home = require('node:os').homedir(), timeoutMs = 10000, spawnImpl = spawn, now = () => Date.now() } = {}) {
  const cache = new Map();
  const overrideFor = provider => { const value = settings()?.providerBinary?.[provider]; return typeof value === 'string' && value.trim() ? value.trim() : ''; };
  function fileStamp(file) { try { const s = fs.statSync(file); return s.isFile() ? `${file}:${s.mtimeMs}:${s.size}` : null; } catch { return null; } }
  async function inspect(provider, { fresh = false } = {}) {
    if (!PROVIDERS.includes(provider)) throw new Error('Unsupported provider');
    const override = overrideFor(provider), environment = await env();
    const result = { provider, path: null, source: null, version: null, ok: false, problem: null, checkedAt: new Date(now()).toISOString() };
    if (override) {
      if (!path.isAbsolute(override)) return { ...result, source: 'settings', problem: 'The binary path must be absolute.' };
      if (!fileStamp(override)) return { ...result, source: 'settings', path: override, problem: 'No file at this path.' };
      result.path = override; result.source = 'settings';
    } else {
      const found = resolveProviderCli(provider, { env: environment, home });
      if (!found) return { ...result, problem: `${TESTED[provider].name} was not found on the PATH. Install it, or set its path here.`, install: TESTED[provider].install, login: TESTED[provider].login };
      result.path = found; result.source = 'path';
    }
    const stamp = fileStamp(result.path);
    if (!fresh && cache.has(stamp)) return { ...cache.get(stamp), checkedAt: result.checkedAt };
    const ran = await runVersion(result.path, { timeoutMs, env: environment, spawnImpl });
    const line = firstLine(ran.output);
    if (ran.timedOut) result.problem = `--version did not finish within ${Math.round(timeoutMs / 1000)} seconds.`;
    else if (ran.error) result.problem = `Could not run it: ${ran.error}`;
    else if (ran.code !== 0) result.problem = `--version exited ${ran.code}${line ? `: ${line}` : ''}`;
    // The real tools name themselves ("2.1.37 (Claude Code)", "codex-cli 0.155.0"); a version alone is any program.
    else if (!LOOKS_LIKE[provider].test(ran.output)) result.problem = `Not ${provider === 'claude' ? 'Claude Code' : 'Codex'}: --version answered “${line.slice(0, 120)}”`;
    else { result.ok = true; result.version = (VERSION.exec(ran.output) || [null])[0]; result.answer = line.slice(0, 160); Object.assign(result, fitOf(provider, result.version)); }
    cache.set(stamp, { ...result });
    return result;
  }
  async function all({ fresh = false } = {}) { const out = {}; for (const provider of PROVIDERS) out[provider] = await inspect(provider, { fresh }); return out; }
  return Object.freeze({ inspect, all, PROVIDERS });
}
module.exports = { createProviderTools, fitOf, compareVersions, TESTED };
