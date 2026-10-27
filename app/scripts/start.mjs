// `npm start` and `npm run dev` from source (#95): find or fetch the packaged Barkpark at app/BARKPARK_REF,
// then start Electron with BARKDOWN_CARRIED_RUNTIME naming it, so a new profile's local library is on the
// way it is in the installed application. A runtime that cannot be had is reported and the app still
// starts; Settings › Barkpark then says why. BARKDOWN_CARRIED_RUNTIME set by the caller is left alone.
// `node scripts/start.mjs --check` (npm run doctor) does the same lookup, reports and starts nothing.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { appRoot, ensureRuntime, pinOf } from './source-runtime.mjs';

const check = process.argv.includes('--check'), passThrough = process.argv.slice(2).filter(arg => arg !== '--check');
const say = line => console.error(`[barkdown] ${line}`);

async function runtime() {
  if (process.env.BARKDOWN_CARRIED_RUNTIME) return { ok: true, folder: process.env.BARKDOWN_CARRIED_RUNTIME, line: `local Barkpark: BARKDOWN_CARRIED_RUNTIME=${process.env.BARKDOWN_CARRIED_RUNTIME} (set by you)` };
  const pin = pinOf();
  try {
    const { folder, source } = await ensureRuntime({ pin, log: say });
    return { ok: true, folder, line: `local Barkpark: ${pin.slice(0, 9)} ${source === 'downloaded' ? 'downloaded to' : 'at'} ${folder}` };
  } catch (error) { return { ok: false, line: `local Barkpark: not available, ${error.message}` }; }
}

const found = await runtime();
if (check) {
  const rows = [];
  const [major, minor] = process.versions.node.split('.').map(Number);
  rows.push([major > 22 || (major === 22 && minor >= 13), `node ${process.versions.node} (22.13.1 or later)`]);
  let electron = null; try { electron = createRequire(import.meta.url)('electron'); } catch {}
  rows.push([Boolean(electron), electron ? `electron at ${electron}` : 'electron is not installed: cd app && npx install-electron --no']);
  rows.push([found.ok, found.line]);
  for (const [ok, line] of rows) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${line}`);
  const failed = rows.some(([ok]) => !ok);
  console.log(failed ? '\nNot ready. Fix the FAIL lines, then run npm run doctor again.' : '\nReady. npm run desktop starts Barkdown with its local library on for a new profile.');
  process.exit(failed ? 1 : 0);
}

say(found.line);
const electron = createRequire(import.meta.url)('electron');
const child = spawn(electron, ['.', ...passThrough], { cwd: appRoot, stdio: 'inherit', env: found.ok ? { ...process.env, BARKDOWN_CARRIED_RUNTIME: found.folder } : process.env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
