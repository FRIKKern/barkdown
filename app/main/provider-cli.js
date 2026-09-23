// Fixed authentication commands only; no shell or renderer-supplied arguments.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function resolveProviderCli(provider, { platform = process.platform, arch = process.arch, env = process.env, home = os.homedir(), resolve = require.resolve } = {}) {
  if (!['claude', 'codex'].includes(provider)) throw new Error('Unsupported sign-in provider');
  const exists = file => { try { return fs.statSync(file).isFile(); } catch { return false; } };
  if (provider === 'codex') {
    try {
      const triples = { win32: { x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' }, darwin: { x64: 'x86_64-apple-darwin', arm64: 'aarch64-apple-darwin' }, linux: { x64: 'x86_64-unknown-linux-musl', arm64: 'aarch64-unknown-linux-musl' } };
      const triple = triples[platform]?.[arch];
      const root = path.dirname(resolve('@openai/codex-' + platform + '-' + arch + '/package.json'));
      for (const dir of ['bin', 'codex']) {
        const file = path.join(root, 'vendor', triple, dir, platform === 'win32' ? 'codex.exe' : 'codex').replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');
        if (exists(file)) return file;
      }
    } catch { /* Fall back to an installed native executable. */ }
  }
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path');
  const dirs = [...(env[pathKey] || '').split(path.delimiter), path.join(home, '.local', 'bin')];
  for (const dir of dirs) {
    if (!dir || !path.isAbsolute(dir)) continue;
    const file = path.join(dir, provider + (platform === 'win32' ? '.exe' : ''));
    if (exists(file)) return file;
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
