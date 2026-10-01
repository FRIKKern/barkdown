// A5 daily-use checks on the carried runtime: 200% zoom, a narrow window, reduced motion, keyboard-only
// navigation and a long note. Each check records what was observed; a finding is a fact, not a verdict,
// so the tour fails only when the harness itself cannot run the check.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const appRoot = fileURLToPath(new URL('..', import.meta.url));
process.chdir(appRoot);
const { createProfileRegistry } = require('../main/profile-registry');
const { createStore } = require('../main/store');
const { releaseOf } = require('../main/local-barkpark-source');
const pin = fs.readFileSync(path.join(appRoot, 'BARKPARK_REF'), 'utf8').trim();
const release = path.resolve(process.env.BARKDOWN_TEST_BP_RELEASE || path.join(appRoot, '..', 'runtime', `barkpark-${pin.slice(0, 9)}-${process.platform}-${process.arch}`));
const packaged = releaseOf(release);
if (!packaged?.upstream) throw new Error('BARKDOWN_TEST_BP_RELEASE must point at a release built by scripts/build-runtime-release.mjs');
const out = path.resolve('../docs/cycles/evidence/C086/live', new Date().toISOString().replace(/[:.]/g, '-') + '-daily-use');
fs.mkdirSync(out, { recursive: true });
const userData = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-daily-')));
const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), upstream: packaged.upstream, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', findings: [], screenshots: [],
  limits: ['One Mac, one run, from source under Electron on the carried runtime. Findings are what one session observed at 1300×900 and 820×860; no latency target is claimed.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const finding = (check, ok, detail) => { report.findings.push({ check, ok, detail }); persist(); };
const registry = createProfileRegistry(path.join(userData, 'profile-data'));
const profile = registry.createProfile({ name: 'Daily desk' }), dir = registry.storeFor(profile.id).storeDir;
createStore(dir).writeJson('settings.json', { theme: 'dark', provider: 'api', barkpark: { enabled: true, viaCli: false, writes: true, dataset: 'production', local: { enabled: true, source: release } } });
createStore(path.join(userData, 'app-settings')).writeJson('appearance.json', { theme: 'dark' });
registry.selectProfile(profile.id);
let app, page;
const shot = async name => { await page.screenshot({ path: path.join(out, name + '.png') }); report.screenshots.push(name + '.png'); persist(); };
const overflow = () => page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, bodyScroll: document.body.scrollWidth }));
const visible = selector => page.evaluate(sel => { const el = document.querySelector(sel); if (!el) return { present: false }; const r = el.getBoundingClientRect(); return { present: true, inView: r.width > 0 && r.height > 0 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1 && r.left >= -1 && r.top >= -1, rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } }; }, selector);
try {
  app = await electron.launch({ executablePath: require('electron'), args: [appRoot, '--profiles', `--user-data=${userData}`], env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin', BARKDOWN_PROVIDER: 'api' } });
  page = await app.firstWindow({ timeout: 300000 }); page.setDefaultTimeout(60000);
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.setViewportSize({ width: 1300, height: 900 });
  for (let i = 0; i < 900; i++) { const s = await page.evaluate(() => window.barkdown.barkpark.localStatus()).catch(() => ({ phase: 'pending' })); if (s.phase === 'ready') break; if (s.phase === 'failed') throw new Error('runtime failed: ' + s.error); await new Promise(r => setTimeout(r, 200)); }
  // 1. Keyboard only: from the page body, Tab reaches the main controls, and a message can be sent with Enter.
  await page.evaluate(() => document.body.focus());
  const reached = [], positions = {};
  for (let i = 0; i < 80; i++) { await page.keyboard.press('Tab'); const id = await page.evaluate(() => { const a = document.activeElement; return a ? (a.id ? '#' + a.id : a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : '')) : null; }); if (id && !reached.includes(id)) { reached.push(id); positions[id] = i + 1; } }
  const wanted = ['#bw-new-page', '#bw-settings', '#bw-prompt', '#bw-send'];
  const got = wanted.filter(w => reached.includes(w));
  finding('keyboard: Tab reaches the main controls within 80 presses', got.length === wanted.length, { reached: got, missing: wanted.filter(w => !got.includes(w)), presses: Object.fromEntries(wanted.map(w => [w, positions[w] || null])), order: reached.slice(0, 80) });
  // Reached by the keyboard, not by script: :focus-visible is what a Tab press earns.
  await page.evaluate(() => document.body.focus());
  for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.activeElement?.id === 'bw-prompt')) break; }
  const focusRing = await page.evaluate(() => { const el = document.activeElement; const s = getComputedStyle(el); const frame = el.closest('#bw-compose') || el.parentElement; const f = getComputedStyle(frame); return { element: '#' + el.id, outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, focusVisible: el.matches(':focus-visible'), frame: { id: '#' + frame.id, borderColor: f.borderColor, boxShadow: f.boxShadow } }; });
  const framed = focusRing.frame.boxShadow !== 'none' || focusRing.frame.borderColor !== (await page.evaluate(() => { document.body.focus(); const f = getComputedStyle(document.querySelector('#bw-compose')); return f.borderColor; }));
  finding('keyboard: the focused composer shows a focus indication (its own outline or its frame)', (focusRing.outlineStyle !== 'none' && focusRing.outlineWidth !== '0px') || framed, { ...focusRing, framed });
  // 2. 200% zoom at the ordinary window: the composer and sidebar stay reachable, nothing scrolls sideways.
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(2); });
  await new Promise(r => setTimeout(r, 600));
  const zoomOverflow = await overflow(), zoomPrompt = await visible('#bw-prompt'), zoomSend = await visible('#bw-send'), zoomNew = await visible('#bw-new-page');
  const zoomToggle = await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find(b => /sidebar/i.test(b.getAttribute('aria-label') || '') || /sidebar/i.test(b.id)); if (!t) return { present: false }; const r = t.getBoundingClientRect(); return { present: true, id: '#' + t.id, label: t.getAttribute('aria-label'), inView: r.width > 0 && r.height > 0 }; });
  await shot('01-zoom-200');
  finding('zoom 200%: no horizontal page scroll', zoomOverflow.scrollWidth <= zoomOverflow.clientWidth + 1, zoomOverflow);
  finding('zoom 200%: composer, send and New page are in view', zoomPrompt.inView && zoomSend.inView && zoomNew.inView, { zoomPrompt, zoomSend, zoomNew, sidebarToggle: zoomToggle, note: zoomNew.inView ? undefined : 'the window is 650 CSS px wide at 200%, so the sidebar collapses as it does in a narrow window; New page needs the sidebar toggle first' });
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1); });
  // 3. Narrow window.
  await page.setViewportSize({ width: 820, height: 860 }); await new Promise(r => setTimeout(r, 600));
  const narrowOverflow = await overflow(), narrowPrompt = await visible('#bw-prompt'), narrowSend = await visible('#bw-send'), narrowPages = await visible('#bw-new-page');
  await shot('02-narrow-820');
  finding('narrow 820px: no horizontal page scroll', narrowOverflow.scrollWidth <= narrowOverflow.clientWidth + 1, narrowOverflow);
  finding('narrow 820px: composer, send and New page are in view', narrowPrompt.inView && narrowSend.inView && narrowPages.inView, { narrowPrompt, narrowSend, narrowPages });
  await page.setViewportSize({ width: 1300, height: 900 });
  // 4. Reduced motion: the stylesheet declares it, and animated elements report no duration when it is on.
  await page.emulateMedia({ reducedMotion: 'reduce' }); await new Promise(r => setTimeout(r, 300));
  const motion = await page.evaluate(() => { const sheets = [...document.styleSheets]; let rules = 0; for (const sheet of sheets) { try { for (const r of sheet.cssRules) if (r.media && /prefers-reduced-motion/.test(r.media.mediaText)) rules++; } catch {} } const ms = v => Math.max(...String(v || '0s').split(',').map(x => x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000)); const animated = [...document.querySelectorAll('*')].filter(el => { const s = getComputedStyle(el); return ms(s.transitionDuration) > 1 || (s.animationName !== 'none' && ms(s.animationDuration) > 1); }).slice(0, 8).map(el => ({ el: el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0], transition: getComputedStyle(el).transitionDuration, animation: getComputedStyle(el).animationDuration })); return { rules, animated }; });
  finding('reduced motion: the stylesheet has a prefers-reduced-motion rule and animated elements report no duration', motion.rules > 0 && motion.animated.length === 0, motion);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // 5. A long note: 400 paragraphs on the carried runtime; open it, go to the end, type, see it saved.
  const made = await page.evaluate(() => window.barkdown.barkpark.createNote(crypto.randomUUID()));
  const t0 = Date.now();
  const blocks = Array.from({ length: 400 }, (_, i) => ({ id: 'p' + i, type: 'paragraph', content: [{ type: 'text', value: `Paragraph ${i + 1}: a long note is read and written like a short one; this line exists so the editor has something to scroll past.` }] }));
  const fresh = await page.evaluate(({ id, paperOwner }) => window.barkdown.barkpark.get(id, undefined, paperOwner), made);
  await page.evaluate(({ id, blocks, rev, binding }) => window.barkdown.barkpark.applyOps(id, blocks.map(block => ({ op: 'append-block', block })), rev, binding), { id: made.id, blocks, rev: fresh.rev, binding: fresh.binding });
  const writeMs = Date.now() - t0;
  const t1 = Date.now();
  await page.evaluate(({ id, paperOwner }) => window.__barkdown.openTarget({ kind: 'doc', id, source: 'barkpark', paperOwner }), made);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').nth(300).waitFor({ timeout: 60000 });
  const openMs = Date.now() - t1;
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').last().click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowRight' : 'End'); await page.keyboard.press('Enter');
  const t2 = Date.now();
  await page.keyboard.type('Typed at the end of a long note.');
  await page.waitForFunction(() => { const pane = document.querySelector('.bw-paper-pane:not([hidden])'); return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges?.(); }, null, { timeout: 60000 });
  const saveMs = Date.now() - t2;
  await shot('03-long-note-end');
  const paragraphs = await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror p').count();
  finding('long note: 400 paragraphs written, opened, typed at the end and saved', paragraphs >= 400, { writeMs, openMs, saveMs, paragraphs });
  report.status = 'passed'; persist();
  console.log(JSON.stringify({ status: report.status, findings: report.findings.map(f => `${f.ok ? 'ok ' : 'OBSERVED'} ${f.check}`) }, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error.stack || error); persist(); console.error(report.error); process.exitCode = 1; }
finally { if (app) await app.close().catch(() => {}); fs.rmSync(userData, { recursive: true, force: true }); }
