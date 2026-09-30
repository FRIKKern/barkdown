import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Plan #19: "@" opens the wikilink autocomplete like "[[" and the pick lands a wikilink on the server.
// Live against the bp-connected server; not part of npm test.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-mention';
const TARGET = 'barkdown-mention-target';
publishFixture({ slug: TARGET, title: 'Mentionable target paper', description: 'The paper the Barkdown "@" row links to: it only needs to exist and be searchable by its title. Rewritten on every run of tests/editor-mention.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Mentionable target paper' }, para('Nothing to see; this paper is what an @-mention points at.')] });
publishFixture({ slug: SLUG, title: 'Mentions by at-sign', description: 'Scratch paper for the Barkdown "@" row: typing @ and part of a title opens the wikilink popup, Enter picks, and the server holds a wikilink inline to the target paper. Rewritten on every run of tests/editor-mention.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Mentions by at-sign' }, para('Link the target after this sentence:'), para('An address like me@example.com must stay plain text:')] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-mention-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = []; page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await connectPaperFixture(page);
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await openFixturePaper(page, SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
await page.waitForTimeout(500);

const results = [];
const row = async (name, fn) => { try { const r = await fn(); results.push({ name, pass: !!r.pass, ...r }); } catch (e) { results.push({ name, pass: false, error: e.message.slice(0, 240) }); } };
const pane = '.bw-paper-pane:not([hidden])';
const pm = page.locator(`${pane} bp-paper-canvas .ProseMirror`);

const paragraph = (i) => { const d = getPaper(SLUG); return d.blocks.filter(b => b.type === 'paragraph')[i]; };
const waitParagraph = async (i, pred) => { for (let k = 0; k < 20; k++) { const p = paragraph(i); if (p && pred(p)) return p; await page.waitForTimeout(1000); } return paragraph(i); };
// The caret at the end of the paragraph holding `text`: found by text and set programmatically (a click on the
// CI runner does not always move the caret while a selection or a popup is live).
const caretEnd = async (text) => { await pm.locator(`p:has-text("${text}")`).first().click().catch(() => {}); await page.evaluate(t => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const ed = c._editor; let end = null; ed.state.doc.descendants((node, pos) => { if (end == null && node.type.name === 'paragraph' && node.textContent.includes(t)) end = pos + node.nodeSize - 1; }); if (end != null) ed.commands.setTextSelection(end); ed.commands.focus(); }, text); await page.waitForTimeout(100); };

await row('"@Mention" opens the wikilink popup with the target paper listed', async () => {
  await caretEnd('Link the target');
  await page.keyboard.type(' @Mentionable');
  // The popup opens at once and fills when the search answers; wait for the target's title to be listed.
  const shown = await page.waitForFunction(() => { const el = document.querySelector('body .bp-wikilink-menu'); return el && el.getBoundingClientRect().height > 0 && /Mentionable target paper/.test(el.textContent) ? el.textContent : null; }, null, { timeout: 10000 }).then(h => h.jsonValue()).catch(() => null);
  return { pass: !!shown && /Mentionable target paper/.test(shown), popup: (shown || '').slice(0, 120) };
});
await row('Enter picks it: the server holds a wikilink inline to the target, the "@Mentionable" text is gone', async () => {
  // The active row must be the target before Enter (a slower search on CI can re-render the list after
  // the title first appears): step ArrowDown until the highlighted row names it, bounded.
  for (let k = 0; k < 8; k++) {
    const active = await page.evaluate(() => document.querySelector('body .bp-wikilink-menu .is-active')?.textContent || '');
    if (/Mentionable target paper/.test(active)) break;
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150);
  }
  await page.keyboard.press('Enter');
  const p = await waitParagraph(0, x => (x.content || []).some(n => n.type === 'wikilink'));
  const link = (p.content || []).find(n => n.type === 'wikilink');
  const plain = (p.content || []).filter(n => n.type === 'text').map(n => n.value).join('');
  return { pass: !!link && JSON.stringify(link).includes(TARGET) && !/@Mentionable/.test(plain), link, plain };
});
await row('an address stays plain text: "@" inside a word never opens the popup', async () => {
  await caretEnd('An address like');
  await page.keyboard.type(' bob@example.org');
  await page.waitForTimeout(400);
  const open = await page.evaluate(() => { const el = document.querySelector('body .bp-wikilink-menu'); return !!(el && el.getBoundingClientRect().height > 0); });
  const p = await waitParagraph(1, x => (x.content || []).some(n => n.type === 'text' && /bob@example\.org/.test(n.value)));
  return { pass: !open && (p.content || []).every(n => n.type !== 'wikilink'), open, content: p.content };
});
await row('reload: the wikilink comes back from the server as shown', async () => {
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'chat' })).catch(() => {}); await page.waitForTimeout(400);
  await openFixturePaper(page, SLUG);
  await page.waitForSelector(`${pane} bp-paper-canvas .ProseMirror`, { timeout: 60000 }); await page.waitForTimeout(500);
  const canvas = await page.evaluate(() => { const c = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas'); const p = c._editor.getJSON().content.filter(n => n.type === 'paragraph')[0]; return (p.content || []).map(n => n.marks?.map(m => m.type).join('+') || n.type); });
  return { pass: canvas.some(t => /wikilink/.test(t)), canvas };
});

await page.screenshot({ path: 'test-results/37-mention.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
