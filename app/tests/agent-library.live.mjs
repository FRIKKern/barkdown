// The real-agent proof for the agent-context issues (#67 to #73, C092): Claude Code, on the person's own
// login, runs inside Barkdown on a profile whose stored Barkpark block is empty and off (the shape that left
// the owner's profile without a library). The proof is the run log: the library is there by default, a
// "paper" is created in it with create_document, no claude.ai connector is in the run, and the input tokens
// of each run are recorded. Spends the provider's quota, like agent-browser-truth.live.mjs; not in the chain.
//   node tests/agent-library.live.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.BARKDOWN_CARRIED_RUNTIME || path.resolve(appRoot, '../runtime/barkpark-9f1874235-darwin-arm64');
const out = path.resolve(appRoot, '../docs/cycles/evidence/C092/live', new Date().toISOString().replace(/[:.]/g, '-') + '-agent-library');
fs.mkdirSync(out, { recursive: true });
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], runs: [],
  limits: ['One real provider run per prompt on the person\'s login; what a model does varies run to run. The profile is a fresh one in the stored-empty-off shape, not the owner\'s own.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const check = (name, detail) => { report.checks.push({ name, ...(detail ? { detail } : {}) }); persist(); console.log('ok  ' + name); };
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-agent-library-')));
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Library home' });
const storeDir = registry.storeFor(profile.id).storeDir;
// Exactly what saving any setting used to leave behind: a Barkpark block that is off and empty, never decided.
createStore(storeDir).writeJson('settings.json', { theme: 'dark', provider: 'claude', barkpark: { enabled: false, local: { enabled: false } } });
registry.selectProfile(profile.id);
let app;
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_CARRIED_RUNTIME: runtime, BARKDOWN_MOCK_KEYCHAIN: '1' } });
  const page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1300, height: 900 });
  const flag = () => { try { return JSON.parse(fs.readFileSync(path.join(storeDir, 'barkpark.json'), 'utf8')); } catch { return null; } };
  for (let i = 0; i < 240 && !(flag()?.enabled && flag()?.server); i++) await new Promise(r => setTimeout(r, 500));
  assert.ok(flag()?.enabled && flag()?.server, 'the local library is up without anyone enabling it: ' + JSON.stringify(flag()));
  check('a profile stored as empty and off gets its local library by default', { server: flag().server });
  const ask = async prompt => {
    await page.locator('#bw-prompt').fill(prompt); const started = Date.now(); await page.locator('#bw-prompt').press('Enter');
    await page.waitForFunction(text => { const s = window.__barkdown.state, chat = s.chats[s.current]; const mine = chat.messages.filter(m => m.role === 'user').at(-1); const reply = chat.messages.at(-1); return mine?.text?.includes(text.slice(0, 30)) && reply.role === 'assistant' && reply.streaming === false; }, prompt, { timeout: 300000 });
    const reply = await page.evaluate(() => { const s = window.__barkdown.state, chat = s.chats[s.current], r = chat.messages.at(-1); return { text: r.text || '', error: r.error || null, usage: r.usage || null, tools: (r.tools || []).map(t => ({ tool: t.tool, ok: t.ok })), approvals: (r.approvals || []).length }; });
    const run = { prompt, seconds: Math.round((Date.now() - started) / 1000), ...reply }; report.runs.push(run); persist(); return run;
  };
  const made = await ask('Create a paper titled "Library home test" with one sentence about badgers, then reply with the id of the document you created.');
  assert.equal(made.error, null, 'the run finished: ' + made.error);
  const names = made.tools.map(t => t.tool);
  assert.ok(names.some(n => /create_document/.test(n)), 'create_document was used: ' + names.join(', '));
  assert.ok(!names.some(n => /claude_ai|Claude_Docs|Gmail/i.test(n)), 'no claude.ai connector tool was used: ' + names.join(', '));
  assert.match(made.text, /bp:/, 'the reply names a library id: ' + made.text.slice(0, 200));
  assert.equal(made.approvals, 0, 'no approval card was shown (approvals are off by default)');
  check('"create a paper" makes a document in the Barkdown library with create_document', { tools: names, reply: made.text.trim().slice(0, 160), inputTokens: made.usage?.tokens?.input, turns: made.usage?.turns });
  // The new paper is a draft in the library; create_document opens it beside the chat, and that tab is the proof here.
  const tabs = await page.evaluate(() => { const s = window.__barkdown.state; return (s.chats[s.current].tabs || []).map(t => ({ type: t.type, title: t.title, id: t.docId || t.id })); });
  assert.ok(tabs.some(t => /Library home test/i.test(t.title || '')), 'the paper is open beside the chat: ' + JSON.stringify(tabs));
  check('the paper is open beside the chat as a library document', { tabs });
  await page.screenshot({ path: path.join(out, '01-paper-created.png') });
  const seen = await ask('List every tool or deferred tool you can see whose name starts with mcp__claude_ai. If there are none, reply with exactly NONE.');
  assert.match(seen.text.trim(), /^NONE\.?$/i, 'no claude.ai connector is in the run: ' + seen.text.slice(0, 300));
  check('no claude.ai connector tool is present in a Barkdown run', { reply: seen.text.trim(), inputTokens: seen.usage?.tokens?.input, turns: seen.usage?.turns });
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ out, checks: report.checks.map(c => c.name) }, null, 2));
} catch (error) {
  report.status = 'failed'; report.error = String(error?.stack || error); persist(); console.error(error); process.exitCode = 1;
} finally {
  await Promise.race([app?.close().catch(() => {}), new Promise(r => setTimeout(r, 30000))]);
  fs.rmSync(userData, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}
