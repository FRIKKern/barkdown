// Fixed authentication commands only; no shell or renderer-supplied arguments.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// npm/pnpm Windows shims point to the installed package. Read only their fixed
// Codex entry path; never execute a shell wrapper or evaluate its commands.
function codexShimBinary(shim, arch) {
  try {
    const text = fs.readFileSync(shim, 'utf8');
    const entry = /"%(?:~dp0|dp0%)[\\/]([^"\r\n%]*[\\/]@openai[\\/]codex[\\/]bin[\\/]codex\.js)"/i.exec(text)?.[1];
    if (!entry) return null;
    const root = path.dirname(path.dirname(path.resolve(path.dirname(shim), entry.replaceAll('\\', path.sep))));
    const manifest = path.join(root, 'package.json');
    if (JSON.parse(fs.readFileSync(manifest, 'utf8')).name !== '@openai/codex') return null;
    const triple = { x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' }[arch];
    if (!triple) return null;
    const roots = [root];
    try { roots.push(path.dirname(require('node:module').createRequire(manifest).resolve(`@openai/codex-win32-${arch}/package.json`))); } catch {}
    const files = roots.flatMap(dir => [path.join(dir, 'vendor', triple, 'codex', 'codex.exe'), path.join(dir, 'vendor', triple, 'bin', 'codex.exe')]);
    files.push(path.join(root, 'bin', `codex-${triple}.exe`));
    return files.find(file => { try { return fs.statSync(file).isFile(); } catch { return false; } }) || null;
  } catch { return null; }
}
function resolveProviderCli(provider, { platform = process.platform, arch = process.arch, env = process.env, home = os.homedir(), override = '' } = {}) {
  if (!['claude', 'codex'].includes(provider)) throw new Error('Unsupported sign-in provider');
  const exists = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };
  // A path chosen in Settings is the answer, right or wrong; nothing else is searched (C088 S2).
  if (override) return path.isAbsolute(override) && exists(override)
    ? (platform === 'win32' && provider === 'codex' && /\.cmd$/i.test(override) ? codexShimBinary(override, arch) : override) : null;
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path');
  const dirs = [...(env[pathKey] || '').split(path.delimiter), path.join(home, '.local', 'bin')];
  for (const dir of dirs) {
    if (!dir || !path.isAbsolute(dir)) continue;
    const file = path.join(dir, provider + (platform === 'win32' ? '.exe' : ''));
    if (exists(file)) return file;
    if (platform === 'win32' && provider === 'codex') {
      const native = codexShimBinary(path.join(dir, 'codex.cmd'), arch);
      if (native) return native;
    }
  }
  return null;
}
function commandArgs(provider, operation) {
  if (!['claude', 'codex'].includes(provider) || !['login', 'status'].includes(operation)) throw new Error('Unsupported authentication command');
  return provider === 'claude' ? ['auth', operation, ...(operation === 'status' ? ['--json'] : [])] : ['login', ...(operation === 'status' ? ['status'] : [])];
}
function authenticated(provider, code, output) {
  if (code !== 0) return false;
  if (provider === 'codex') return true;
  try { return JSON.parse(output).loggedIn === true; } catch { return false; }
}
function statusState(provider, code, output) {
  if (authenticated(provider, code, output)) return 'signed-in';
  if (provider === 'claude') {
    try { if ([0,1].includes(code) && JSON.parse(output).loggedIn === false) return 'signed-out'; } catch {}
  } else if (code === 1 && /^not logged in\s*$/i.test(output.trim())) return 'signed-out';
  return 'failed';
}
module.exports = { resolveProviderCli, commandArgs, authenticated, statusState };
