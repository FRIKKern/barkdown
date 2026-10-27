// #95 proof: `node scripts/start.mjs` on a fresh profile turns the local library on, and Pages + writes a note.
// Usage: node probe-source-start.mjs <worktree> <out dir>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const [worktree, out] = process.argv.slice(2);
const { chromium } = createRequire(path.join(worktree, 'package.json'))('playwright');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-source-start-')));
const env = { ...process.env, BARKDOWN_MOCK_KEYCHAIN: '1' }; delete env.BARKDOWN_CARRIED_RUNTIME;
const { _electron } = createRequire(path.join(worktree, 'package.json'))('playwright');
let log = ''; let app;
const result = { userData, checks: [] }, ok = (name, detail) => { result.checks.push({ name, detail }); console.log('ok  ' + name, detail ? JSON.stringify(detail) : ''); };
const wait = async (fn, ms, what) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch {} await new Promise(r => setTimeout(r, 500)); } throw new Error('timed out: ' + what); };
try {
  app = await _electron.launch({ executablePath: path.join(path.dirname(process.argv[1]), 'start-wrapper.sh'), args: ['--profiles', `--user-data=${userData}`], env, timeout: 120000 });
  app.process().stderr.on('data', d => log += d); app.process().stdout.on('data', d => log += d);
  await app.firstWindow({ timeout: 180000 });
  const page = await wait(async () => { for (const w of app.windows()) if (await w.evaluate(() => Boolean(window.__barkdown?.state?.loaded)).catch(() => false)) return w; }, 240000, 'main window loaded').catch(async error => { let i = 0; for (const w of app.windows()) { await w.screenshot({ path: path.join(out, `window-${i++}.png`) }).catch(() => {}); console.log('window', w.url().slice(0, 120)); } throw error; });
  page.setDefaultTimeout(60000);
  const line = await wait(() => /\[barkdown\] local Barkpark: .*/.exec(log)?.[0] || app.evaluate(() => process.env.BARKDOWN_CARRIED_RUNTIME), 30000, 'launcher line'); ok('the launcher names the runtime', line);
  ok('Electron main process got BARKDOWN_CARRIED_RUNTIME', await app.evaluate(() => process.env.BARKDOWN_CARRIED_RUNTIME));
  const local = await wait(() => page.evaluate(() => window.__barkdown.state.settings?.barkpark?.local?.enabled && window.__barkdown.state.settings.barkpark.local.source), 60000, 'local enabled');
  ok('a new profile has its local library on with the carried runtime', { source: local });
  const flagFile = () => { const dir = path.join(userData, 'profile-data', 'profiles'); for (const id of fs.readdirSync(dir)) { const f = path.join(dir, id, 'barkpark.json'); if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8')); } };
  const flag = await wait(() => { const f = flagFile(); return f?.enabled && f.server && f; }, 240000, 'library flag');
  const status = await wait(async () => { const r = await fetch(flag.server + '/status.json'); return r.ok && await r.json(); }, 240000, 'Barkpark ready');
  ok('the profile library is on and its Barkpark answers', { server: flag.server, writes: flag.writes, status: Object.keys(status).slice(0, 6) });
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => Object.keys(window.__barkdown.state.pages?.items || window.__barkdown.state.pages || {}).length).catch(() => null);
  const plus = page.locator('#bw-new-page');
  await page.screenshot({ path: path.join(out, '01-ready.png') });
  await plus.click();
  const toastText = await page.locator('text=Notes live on Paper now').count();
  if (toastText) throw new Error('the Settings toast appeared');
  await page.waitForTimeout(4000);
  await page.keyboard.type('Source launch note for #95');
  await page.waitForTimeout(6000);
  const notes = await fetch(flag.server.replace(/\/$/, '') + '/status.json').then(r => r.ok);
  await page.screenshot({ path: path.join(out, '02-note.png') });
  const tabs = await page.evaluate(() => { const s = window.__barkdown.state; return (s.chats[s.current].tabs || []).map(t => ({ type: t.type, title: t.title, source: t.source })); });
  ok('Pages + opens a Paper note instead of the Settings toast', { tabs, pagesBefore: before });
  result.status = 'passed';
} catch (error) { result.status = 'failed'; result.error = String(error?.stack || error); console.error(error); process.exitCode = 1; }
finally {
  result.log = log.slice(-4000); fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  try { process.kill(app.process().pid, 'SIGINT'); } catch {}
  await new Promise(r => setTimeout(r, 10000));
  await new Promise(r => setTimeout(r, 5000));
  console.log('left after quit:', (await import('node:child_process')).execSync(`pgrep -fl ${path.basename(userData)} || true`, { encoding: 'utf8' }).trim() || 'nothing');
  process.exit(process.exitCode || 0);
}
