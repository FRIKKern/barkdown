// The environment a desktop application does not have. Started from Finder, the Dock or a
// launcher, Barkdown inherits launchd's (or the session's) minimal PATH: Homebrew, npm, volta
// and ~/.local/bin are missing, so the user's Claude Code and Codex look absent. This asks the
// user's login shell what PATH it has, merges that with what was inherited, and falls back to
// launchctl on macOS and the registry on Windows. The result is for finding and running the
// user's own tools; it is never applied to the packaged runtime, which keeps a system-only PATH.
// Each shell is given a bounded time; a shell that hangs on its rc files is skipped, not waited for.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const ADOPTED = ['LANG', 'LC_ALL', 'LC_CTYPE', 'SSH_AUTH_SOCK', 'HOMEBREW_PREFIX', 'HOMEBREW_CELLAR', 'HOMEBREW_REPOSITORY', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME'];
const SENTINEL = '__BARKDOWN_SHELL_ENV__';
const pathKeyOf = env => Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
const splitPath = (value, delimiter) => String(value || '').split(delimiter).map(entry => entry.trim()).filter(Boolean);
// Shell entries lead, inherited entries that the shell did not name follow, known tool folders last.
function mergePath(shellEntries, inheritedEntries, knownEntries, delimiter) {
  const seen = new Set(), out = [];
  for (const entry of [...shellEntries, ...inheritedEntries, ...knownEntries]) { if (!entry || seen.has(entry)) continue; seen.add(entry); out.push(entry); }
  return out.join(delimiter);
}
function runCapture(file, args, { timeoutMs, env, spawnImpl = spawn }) {
  return new Promise(resolve => {
    const started = Date.now(); let child, out = '', err = '', done = false;
    const finish = result => { if (done) return; done = true; clearTimeout(timer); resolve({ ...result, ms: Date.now() - started }); };
    const timer = setTimeout(() => { try { child?.kill('SIGKILL'); } catch {} finish({ ok: false, error: `timed out after ${timeoutMs} ms` }); }, timeoutMs);
    try { child = spawnImpl(file, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }); }
    catch (error) { return finish({ ok: false, error: error.message }); }
    child.on('error', error => finish({ ok: false, error: error.message }));
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', code => finish(code === 0 ? { ok: true, stdout: out } : { ok: false, error: `exit ${code}: ${err.trim().slice(0, 200)}` }));
  });
}
// A login shell is told to print its environment after a sentinel line, so banners from rc files
// are ignored. `printenv` is an external command every shell can run, fish and nushell included.
function parsePrintenv(stdout) {
  const text = String(stdout); const at = text.lastIndexOf(SENTINEL);
  if (at < 0) return null;
  const values = {};
  for (const line of text.slice(at + SENTINEL.length).split(/\r?\n/)) { const eq = line.indexOf('='); if (eq > 0) values[line.slice(0, eq)] = line.slice(eq + 1); }
  return values;
}
// `reg query` output: "    Path    REG_EXPAND_SZ    C:\...;%SystemRoot%\..." — the value may hold %VARS%.
function parseRegistryPath(stdout, env) {
  const match = /^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im.exec(String(stdout));
  if (!match) return [];
  const expanded = match[1].trim().replace(/%([^%]+)%/g, (whole, name) => { const key = Object.keys(env).find(k => k.toLowerCase() === name.toLowerCase()); return key ? env[key] : whole; });
  return splitPath(expanded, ';');
}
function createShellEnvironment({ platform = process.platform, env = process.env, home = os.homedir(), user = os.userInfo().username, timeoutMs = 3000, spawnImpl = spawn, launchctl = ['launchctl', 'getenv', 'PATH'], reg = 'reg.exe', exists = file => { try { return fs.statSync(file).isFile() || fs.statSync(file).isDirectory(); } catch { return false; } }, log = () => {} } = {}) {
  const delimiter = platform === 'win32' ? ';' : ':';
  const pathKey = pathKeyOf(env);
  let hydrated = null, pending = null;
  const knownDirs = () => (platform === 'win32'
    ? [path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm'), path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'WinGet', 'Links'), path.join(home, '.local', 'bin')]
    : [path.join(home, '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', path.join(home, '.npm-global', 'bin'), path.join(home, '.volta', 'bin'), path.join(home, '.bun', 'bin'), path.join(home, '.cargo', 'bin')]).filter(exists);
  function candidates() {
    const list = [];
    if (env.SHELL) list.push(env.SHELL);
    if (platform === 'darwin') list.push({ lookup: ['dscl', ['.', '-read', `/Users/${user}`, 'UserShell']], parse: out => /UserShell:\s*(\S+)/.exec(out)?.[1] });
    if (platform === 'linux') list.push({ lookup: ['getent', ['passwd', user]], parse: out => String(out).trim().split(':')[6] });
    list.push(platform === 'darwin' ? '/bin/zsh' : '/bin/bash', '/bin/sh');
    return list;
  }
  async function probeShell(shell) {
    const result = await runCapture(shell, ['-ilc', `echo ${SENTINEL}; printenv`], { timeoutMs, env, spawnImpl });
    if (!result.ok) return { shell, ok: false, ms: result.ms, error: result.error };
    const values = parsePrintenv(result.stdout);
    if (!values || !values.PATH) return { shell, ok: false, ms: result.ms, error: 'no PATH in the shell output' };
    return { shell, ok: true, ms: result.ms, values };
  }
  async function hydratePosix() {
    const probed = [], tried = new Set();
    for (const candidate of candidates()) {
      let shell = candidate;
      if (typeof candidate === 'object') {
        const found = await runCapture(candidate.lookup[0], candidate.lookup[1], { timeoutMs, env, spawnImpl });
        shell = found.ok ? candidate.parse(found.stdout) : null;
        if (!shell) continue;
      }
      if (tried.has(shell) || !path.isAbsolute(shell) || !exists(shell)) continue;
      tried.add(shell);
      // What is kept about a probe is the shell, whether it answered and how long it took: never its environment.
      const outcome = await probeShell(shell); probed.push({ shell: outcome.shell, ok: outcome.ok, ms: outcome.ms, ...(outcome.error ? { error: outcome.error } : {}) });
      log(`[shell-env] ${shell}: ${outcome.ok ? 'ok' : outcome.error} (${outcome.ms} ms)`);
      if (outcome.ok) return { source: `login-shell:${shell}`, values: outcome.values, probed };
    }
    if (platform === 'darwin') {
      const got = await runCapture(launchctl[0], launchctl.slice(1), { timeoutMs, env, spawnImpl });
      if (got.ok && String(got.stdout).trim()) { log('[shell-env] launchctl PATH used'); return { source: 'launchctl', values: { PATH: String(got.stdout).trim() }, probed }; }
    }
    return { source: 'inherited', values: {}, probed };
  }
  async function hydrateWindows() {
    const entries = [];
    for (const [hive, key] of [['machine', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'], ['user', 'HKCU\\Environment']]) {
      const got = await runCapture(reg, ['query', key, '/v', 'Path'], { timeoutMs, env, spawnImpl });
      if (got.ok) entries.push(...parseRegistryPath(got.stdout, env)); else log(`[shell-env] registry ${hive} PATH: ${got.error}`);
    }
    return { source: entries.length ? 'registry' : 'inherited', values: entries.length ? { PATH: entries.join(';') } : {}, probed: [] };
  }
  // Resolve once; later calls get the same answer. Nothing here throws: the inherited environment is the floor.
  function hydrate() {
    return pending ||= (async () => {
      let found;
      try { found = await (platform === 'win32' ? hydrateWindows() : hydratePosix()); }
      catch (error) { log(`[shell-env] hydration failed: ${error.message}`); found = { source: 'inherited', values: {}, probed: [] }; }
      // What the shell contributed is kept, not a frozen copy of the whole environment: `current()`
      // lays it over the live environment each time, so a variable set after launch still reaches a run.
      found.shellPath = splitPath(found.values.PATH, delimiter);
      const merged = compose(found);
      hydrated = Object.freeze({ get env() { return compose(found); }, probedFound: found, source: found.source, probed: found.probed, pathEntries: splitPath(merged[pathKey], delimiter).length });
      return hydrated;
    })();
  }
  function compose(found) {
    const merged = { ...env };
    merged[pathKey] = mergePath(found?.shellPath || [], splitPath(env[pathKey], delimiter), knownDirs(), delimiter);
    if (found) for (const name of ADOPTED) if (merged[name] === undefined && found.values[name] !== undefined) merged[name] = found.values[name];
    return Object.freeze(merged);
  }
  // The best environment known right now: the shell's contribution over the live environment, or the
  // live environment plus the known folders before the probe has answered.
  function current() { return compose(hydrated ? hydrated.probedFound : null); }
  return Object.freeze({ hydrate, current, status: () => hydrated ? { source: hydrated.source, pathEntries: hydrated.pathEntries, probed: hydrated.probed } : { source: 'pending' } });
}
let installed = null, enabled = true;
// The environment to find and run the user's tools in: the installed instance's, else this process's own.
function providerEnv() { return installed ? installed.current() : process.env; }
// The same, after the probe has finished (bounded by its timeouts); the first caller pays the wait.
async function providerEnvReady() { if (installed && enabled) await installed.hydrate(); return providerEnv(); }
function install(instance, { hydrate = true } = {}) { installed = instance; enabled = hydrate; if (hydrate) instance.hydrate().catch(() => {}); return instance; }
module.exports = { createShellEnvironment, providerEnv, providerEnvReady, install, mergePath, parsePrintenv, parseRegistryPath };
