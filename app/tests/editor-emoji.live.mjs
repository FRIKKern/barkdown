import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Plan #18: ":" plus two letters opens a GitHub-style emoji picker; the pick lands as plain text on the server.
// Live against the bp-connected server; not part of npm test.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { publishFixture, getPaper, para } from './lib/paper-fixture.mjs';
const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-emoji';
publishFixture({ slug: SLUG, title: 'Emoji shortcodes rehearsal', description: 'Scratch paper for the Barkdown emoji-picker row: a colon and two letters open the picker, Enter inserts the character as plain text the server holds; a time or a URL never opens it. Rewritten on every run of tests/editor-emoji.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Emoji shortcodes rehearsal' }, para('Smile after this:'), para('The meeting is at 12'), para('A link:')] });

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-emoji-'));
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
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
const paragraph = (i) => { const d = getPaper(SLUG); return d.blocks.filter(b => b.type === 'paragraph')[i]; };
const textOf = p => (p?.content || []).map(n => n.type === 'text' ? n.value : '').join('');
const waitParagraph = async (i, pred) => { for (let k = 0; k < 20; k++) { const p = paragraph(i); if (p && pred(p)) return p; await page.waitForTimeout(1000); } return paragraph(i); };
const caretEnd = async (text) => {
  const target = pm.locator('p').filter({ hasText: text }).first();
  await target.click();
  const expected = await target.evaluate(element => {
    const ed = element.closest('bp-paper-canvas')._editor;
    const end = ed.view.posAtDOM(element, element.childNodes.length);
    ed.view.focus(); ed.commands.setTextSelection(end); return end;
  });
  await page.waitForFunction(({ expected, text }) => {
    const ed = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')._editor;
    const s = ed.state.selection;
    return ed.view.hasFocus() && s.empty && s.from === expected &&
      s.$from.parent.type.name === 'paragraph' && s.$from.parent.textContent.includes(text) &&
      s.$from.parentOffset === s.$from.parent.content.size;
  }, { expected, text });
};
const menuText = () => page.evaluate(() => { const el = document.querySelector('body .bp-wikilink-menu[data-kind="emoji"]'); return el && el.getBoundingClientRect().height > 0 ? el.textContent : null; });

await row('":smi" opens the emoji picker with smile listed first', async () => {
  await caretEnd('Smile after this');
  await page.keyboard.type(' :smi');
  const shown = await page.waitForFunction(() => { const el = document.querySelector('body .bp-wikilink-menu[data-kind="emoji"]'); return el && el.getBoundingClientRect().height > 0 && /smile/.test(el.textContent) ? el.textContent : null; }, null, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => null);
  return { pass: !!shown && /😄/.test(shown) && shown.indexOf('smile') < shown.indexOf('smiley'), popup: (shown || '').slice(0, 100) };
});
await row('Enter inserts 😄 as plain text; the ":smi" is gone; the server holds it', async () => {
  await page.keyboard.press('Enter');
  const p = await waitParagraph(0, x => /😄/.test(textOf(x)));
  const t = textOf(p);
  return { pass: /😄/.test(t) && !/:smi/.test(t) && (p.content || []).every(n => n.type === 'text'), text: t };
});
await row('a time ("12:30") and a URL ("http://") never open the picker', async () => {
  await caretEnd('The meeting is at 12');
  await page.keyboard.type(':30'); await page.waitForTimeout(300);
  const afterTime = await menuText();
  await caretEnd('A link');
  await page.keyboard.type(' http://example.org'); await page.waitForTimeout(300);
  const afterUrl = await menuText();
  const p1 = await waitParagraph(1, x => /12:30/.test(textOf(x)));
  const p2 = await waitParagraph(2, x => /http:\/\/example\.org/.test(textOf(x)));
  return { pass: afterTime == null && afterUrl == null && /12:30/.test(textOf(p1)) && /http:\/\/example\.org/.test(textOf(p2)), afterTime, afterUrl, p1: textOf(p1), p2: textOf(p2) };
});
await row('a bare ":" or one letter does not open; Esc closes an open picker and keeps the typed text', async () => {
  await caretEnd('Smile after this');
  await page.keyboard.type(' :h'); await page.waitForTimeout(250);
  const oneLetter = await menuText();
  await page.keyboard.type('ea'); await page.waitForTimeout(250);
  const open = await menuText();
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const closed = await menuText();
  const p = await waitParagraph(0, x => /:hea/.test(textOf(x)));
  return { pass: oneLetter == null && !!open && /heart/.test(open) && closed == null && /:hea/.test(textOf(p)), oneLetter, open: (open || '').slice(0, 60), closed, text: textOf(p) };
});

await page.screenshot({ path: 'test-results/38-emoji.png' });
const passed = results.filter(r => r.pass).length;
console.log(JSON.stringify({ summary: `${passed}/${results.length} green`, results, errors: [...new Set(errors)].slice(0, 10) }, null, 1));
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
process.exitCode = passed === results.length ? 0 : 1;
