import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Live check of the Barkpark paper tab: edits typed into <bp-paper-canvas> land on the connected server
// through the fenced ops endpoint, and a stale revision surfaces as a conflict instead of overwriting.
// Uses the scratch paper `barkdown-editor-test` on the bp-connected server. Not part of `npm test`.
import { _electron as electron } from 'playwright';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const SLUG = 'barkdown-editor-test';
import { bp, publishFixture } from './lib/paper-fixture.mjs';
const serverPaper = () => { const j = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); return j.document || j; };

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-paper-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.waitForSelector('#bw-documents .bw-nav');
await page.setViewportSize({ width: 1400, height: 900 });
const results = [];
const step = (name, ok) => { results.push({ name, ok }); if (!ok) throw new Error('Failed: ' + name); };
try {
  await connectPaperFixture(page);
  await page.evaluate(() => window.__barkdown.expandArchive());
  await page.waitForSelector('#bw-pages [data-source="barkpark"], #bw-cloud-archive [data-source="barkpark"]', { timeout: 90000 });
  // Reset the scratch paper to a known shape (unfenced publish) so earlier runs cannot skew the checks.
  publishFixture({ slug: SLUG, title: 'Fenced ops round trip', description: 'Scratch paper for the Barkdown paper tab: a typed change lands through the fenced ops endpoint under a revision guard, an injected external edit forces a 412 and the conflict card keeps both edits; rewritten on every run of tests/paper.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Barkdown editor test' }, { type: 'paragraph', content: [{ type: 'text', value: 'Type here; the change lands through the fenced ops endpoint with a revision guard.' }] }, { type: 'list', ordered: false, items: [[{ type: 'text', value: 'Cross-block caret and Enter split' }], [{ type: 'text', value: 'Server-acknowledged saves' }], [{ type: 'text', value: 'Conflicts surface instead of overwriting' }]] }] });
  const before = serverPaper();
  await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug, paperOwner: window.__barkdown.state.barkparkDocs.find(d => d.id === slug)?.paperOwner }), SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
  await page.waitForFunction(() => (document.querySelector('.bw-paper-pane:not([hidden]) #meta')?.textContent || '').includes('Editing live'), null, { timeout: 30000 });
  step('paper opened in the Barkpark canvas with live editing', true);
  step('canvas shows the server blocks', (await page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror').innerText()).includes('Barkdown editor test'));
  await page.screenshot({ path: 'test-results/11-paper-canvas.png' });

  // Type into the second block and wait for the acknowledged save.
  const marker = 'live-' + Date.now().toString(36);
  const para = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror > p').first();
  await para.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' ' + marker);
  await page.waitForFunction(() => /Saved · rev \d+/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 30000 });
  const after = serverPaper();
  step('server revision advanced after the edit', after.rev > before.rev);
  step('typed text landed on the server', JSON.stringify(after.blocks).includes(marker));
  await page.screenshot({ path: 'test-results/12-paper-saved.png' });

  // Conflict: change the paper behind the app's back, then type again.
  bp(['bulldocs', 'patch', SLUG, '--file', '-', '--yes'], JSON.stringify({ ifRev: after.rev, ops: [{ op: 'append-block', block: { type: 'paragraph', content: [{ type: 'text', value: 'External edit from another writer.' }] } }] }));
  const external = serverPaper();
  step('external edit advanced the revision', external.rev > after.rev);
  await para.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' again');
  await page.waitForSelector('.bw-paper-pane:not([hidden]) #conflict .bw-conflict', { timeout: 30000 });
  const conflictText = await page.locator('.bw-paper-pane:not([hidden]) #conflict').innerText();
  console.log('CONFLICT BOX:', conflictText);
  step('stale revision surfaced as a conflict', conflictText.includes('Someone else changed'));
  await page.screenshot({ path: 'test-results/13-paper-conflict.png' });
  await page.locator('.bw-paper-pane:not([hidden]) #conflict [data-act="mine"]').click();
  await page.waitForFunction(() => /Saved · rev \d+/.test(document.querySelector('.bw-paper-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 30000 });
  const merged = serverPaper();
  console.log('MERGED rev', merged.rev, 'external rev', external.rev, 'state:', await page.locator('.bw-paper-pane:not([hidden]) #save-state').innerText(), JSON.stringify(merged.blocks).slice(0, 600));
  step('re-applying on top kept both edits', JSON.stringify(merged.blocks).includes(marker) && JSON.stringify(merged.blocks).includes(' again') && JSON.stringify(merged.blocks).includes('External edit from another writer.') && merged.rev > external.rev);
  await page.waitForTimeout(1500);
  step('canvas received the external block through the echo', (await page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror').innerText()).includes('External edit from another writer.'));
  await page.screenshot({ path: 'test-results/14-paper-merged.png' });

  // Clean up the appended external block so the scratch paper does not grow unbounded.
  const extra = merged.blocks.filter(b => JSON.stringify(b).includes('External edit from another writer.')).map(b => ({ op: 'remove-block', id: b.id }));
  if (extra.length) bp(['bulldocs', 'patch', SLUG, '--file', '-', '--yes'], JSON.stringify({ ifRev: merged.rev, ops: extra }));
  step('opening a cloud paper never places it in Pages', await page.evaluate(slug => !window.__barkdown.state.pages.roots.some(key => key === 'bp:' + slug || key.endsWith(':' + encodeURIComponent(slug))), SLUG));
  await page.evaluate(async () => { await window.__barkdown.refreshLibrary(); window.__barkdown.expandArchive(); });
  const cloudTitle = await page.evaluate(slug => window.__barkdown.state.barkparkDocs.find(d => d.id === slug)?.title, SLUG);
  if (!cloudTitle) throw new Error('Scratch paper missing from listing');
  await page.locator('#bw-cloud-archive-filter').fill(cloudTitle);
  const cloudKey = await page.evaluate(slug => { const d = window.__barkdown.state.barkparkDocs.find(d => d.id === slug); return `bp:v1:${d.paperOwner}:${encodeURIComponent(slug)}`; }, SLUG);
  await page.locator('#bw-cloud-archive [data-open="' + cloudKey + '"]').hover();
  await page.locator('#bw-cloud-archive [data-more="' + cloudKey + '"]').click({timeout:10000});
  await page.locator('[data-act="import"]').click();
  await page.waitForFunction(title => window.__barkdown.state.documents.some(d => d.title === title && window.__barkdown.state.pages.roots.includes(d.id)), cloudTitle, {timeout:30000});
  step('import creates a local Page and leaves the cloud original unplaced', await page.evaluate(slug => !window.__barkdown.state.pages.roots.some(key => key === 'bp:' + slug || key.endsWith(':' + encodeURIComponent(slug))), SLUG));
  const relevant = errors.filter(e => !/Autofill|devtools|ERR_BLOCKED_BY_RESPONSE|Electron Security Warning|CSP/i.test(e));
  step('no renderer errors', relevant.length === 0 || (console.error(relevant), false));
} finally {
  console.log(JSON.stringify({ results, errors: errors.slice(0, 6) }, null, 1));
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
if (results.some(r => !r.ok)) process.exit(1);
console.log(`All ${results.length} live paper checks passed.`);
