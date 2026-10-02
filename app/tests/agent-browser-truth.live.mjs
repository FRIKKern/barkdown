// The real-agent proof for the agents' browser (C089 slice B): Claude Code and Codex, on the person's
// own logins, each run inside Barkdown and are asked to open a local page in their browser and report
// one fact from it. The proof is the run log: a browser tool was used, the fact came back, and nothing
// reached for another browser. Explicitly spends the selected providers' quota, like providers.live.mjs.
//   node tests/agent-browser-truth.live.mjs [claude] [codex]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const providers = process.argv.slice(2).filter(a => !a.startsWith('--')); if (!providers.length) providers.push('claude', 'codex');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C089/live', new Date().toISOString().replace(/[:.]/g, '-') + '-agent-browser-truth');
fs.mkdirSync(out, { recursive: true });
const BROWSER_TOOLS = new Set(['tabs_context', 'tabs_create', 'tabs_close', 'navigate', 'read_page', 'find', 'get_page_text', 'form_input', 'computer', 'javascript', 'read_console_messages', 'read_network_requests']);
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', runs: [], screenshots: [],
  limits: ['Real providers on the person\'s logins; one prompt each against a local page. What a model does varies run to run; this records one run per provider, not a rate.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();

const FACT = 'Oleander-7421';
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/facts') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); return res.end(`<title>Badger facts</title><h1>The badger register</h1><p>Today's badger is called <strong id="name">${FACT}</strong>. It prefers quiet afternoons.</p>`); }
  res.statusCode = 404; res.end('no');
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const site = `http://localhost:${server.address().port}`;

async function runWith(provider) {
  const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `bd-truth-${provider}-`)));
  const registry = createProfileRegistry(path.join(userData, 'profile-data'));
  const profile = registry.createProfile({ name: `Truth ${provider}` });
  createStore(registry.storeFor(profile.id).storeDir).writeJson('settings.json', { theme: 'dark', provider, barkpark: { enabled: false } });
  createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
  registry.selectProfile(profile.id);
  const entry = { provider, status: 'running', startedAt: new Date().toISOString(), tools: [], text: '', findings: [] }; report.runs.push(entry); persist();
  let app;
  try {
    // The person's own login shell finds the tool (C088); the restricted PATH here is what a Finder launch gives.
    app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } });
    const stderr = fs.createWriteStream(path.join(out, `${provider}-main-stderr.log`)); app.process().stderr?.on('data', chunk => stderr.write(chunk));
    const page = await app.firstWindow({ timeout: 120000 }); page.setDefaultTimeout(60000);
    await page.waitForFunction(() => window.__barkdown?.state.loaded);
    await page.setViewportSize({ width: 1300, height: 900 });
    const prompt = `Open ${site}/facts in your browser and tell me what today's badger is called. Use your browser tools only; answer in one sentence.`;
    await page.locator('#bw-prompt').fill(prompt);
    const started = Date.now();
    await page.locator('#bw-prompt').press('Enter');
    // The reply streams until the run ends; tools and text accumulate on it.
    await page.waitForFunction(() => { const s = window.__barkdown.state; const chat = s.chats[s.current]; const reply = [...chat.messages].reverse().find(m => m.role === 'assistant'); return reply && reply.streaming === false; }, null, { timeout: 300000 });
    const reply = await page.evaluate(() => { const s = window.__barkdown.state; const chat = s.chats[s.current]; const r = [...chat.messages].reverse().find(m => m.role === 'assistant'); return { text: r.text || '', error: r.error || null, tools: (r.tools || []).map(t => ({ tool: t.tool, input: t.input, ok: t.ok, preview: String(t.preview || '').slice(0, 160) })), notes: r.notes || [] }; });
    entry.seconds = Math.round((Date.now() - started) / 1000); entry.text = reply.text; entry.error = reply.error; entry.notes = reply.notes; entry.tools = reply.tools;
    await page.screenshot({ path: path.join(out, `${provider}-after-run.png`) }); report.screenshots.push(`${provider}-after-run.png`); persist();
    const used = reply.tools.map(t => String(t.tool).replace(/^browser\./, ''));
    const browserUsed = used.filter(n => BROWSER_TOOLS.has(n)), others = used.filter(n => !BROWSER_TOOLS.has(n));
    const launchedOther = reply.tools.some(t => /Bash|shell|command/i.test(String(t.tool)) && /open\s+-a|playwright|chrom|safari|firefox/i.test(JSON.stringify(t.input || {})));
    if (others.length) entry.findings.push(`other tools used: ${[...new Set(others)].join(', ')}`);
    if (reply.error) entry.findings.push(`run error: ${reply.error}`);
    assert.ok(!launchedOther, 'the run tried to launch another browser: ' + JSON.stringify(reply.tools));
    assert.ok(browserUsed.length > 0, `no browser tool was used; tools: ${used.join(', ') || 'none'}; text: ${reply.text.slice(0, 200)}; error: ${reply.error}`);
    assert.match(reply.text, new RegExp(FACT), `the fact did not come back: ${reply.text.slice(0, 300)}`);
    entry.status = 'passed'; entry.browserTools = browserUsed; persist();
    console.log(`ok  ${provider}: ${browserUsed.join(' → ')} in ${entry.seconds}s; "${reply.text.trim().slice(0, 120)}"`);
  } catch (error) {
    entry.status = 'failed'; entry.error = String(error?.message || error); persist(); console.error(`${provider}: ${entry.error}`); process.exitCode = 1;
  } finally {
    await Promise.race([app?.close().catch(() => {}), new Promise(r => setTimeout(r, 20000))]);
    fs.rmSync(userData, { recursive: true, force: true });
  }
}
for (const provider of providers) await runWith(provider);
report.status = report.runs.every(r => r.status === 'passed') ? 'passed' : 'failed'; persist();
server.close();
console.log(JSON.stringify({ out, runs: report.runs.map(r => ({ provider: r.provider, status: r.status, seconds: r.seconds, tools: r.tools.map(t => t.tool), findings: r.findings })) }, null, 2));
process.exit(process.exitCode || 0);
