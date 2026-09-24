import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
const require = createRequire(import.meta.url), source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit private runtime source required');
const appDir = path.resolve('.'), root = path.resolve('..');
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-delete-native-'));
const out = path.join(root, 'docs/visual/paper-deletions/runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const manifest = { host: git(['rev-parse', 'HEAD']), upstream: git(['rev-parse', 'HEAD'], source), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', frames: [], results: [], errors: [], failure: null };
let app, page, video;
const launch = async () => {
  app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', '--user-data=' + userData],
    recordVideo: { dir: out, size: { width: 1400, height: 900 } }, timeout: 180000,
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '' } });
  page = await app.firstWindow({ timeout: 180000 }); video = page.video(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => manifest.errors.push(error.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 180000 });
  await page.setViewportSize({ width: 1400, height: 900 });
};
const close = async name => { await app.close(); app = null; if (video) fs.renameSync(await video.path(), path.join(out, name + '.webm')); };
const shot = async name => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: path.join(out, name + '.png') }); manifest.frames.push(name + '.png'); };
const saved = () => page.waitForFunction(() => {
  const pane = document.querySelector('.bw-paper-pane:not([hidden])');
  return pane?.querySelector('#save-state')?.textContent.startsWith('Saved · rev') && !pane.querySelector('bp-paper-canvas')?.hasPendingChanges();
});
const state = () => page.evaluate(() => { const s = window.__barkdown.state; return { pages:s.pages, favorites:s.favorites }; });
const save = () => page.evaluate(async () => { const s = window.__barkdown.state; await window.barkdown.state.save({ version:1, profileId:s.profileId, generation:s.generation, chats:s.chats, order:s.order, favorites:s.favorites, pages:s.pages, current:s.current, mode:s.mode, directTab:s.directTab }); });
const currentPaper = () => page.evaluate(async () => {
  const s = window.__barkdown.state;
  const chat = s.mode === 'chat' ? s.chats[s.current] : s.chats.direct;
  const tab = chat.tabs.find(t => t.id === (s.mode === 'chat' ? chat.active : s.directTab));
  return window.barkdown.barkpark.get(tab.path.at(-1), undefined, tab.paperOwner);
});
try {
  await launch();
  await page.evaluate(async source => {
    const b = window.__barkdown;
    b.state.settings = await window.barkdown.settings.set({ theme:'dark', provider:'api', barkpark:{ enabled:true, writes:true, viaCli:false, local:{enabled:true,source} } });
    document.documentElement.dataset.theme='dark'; b.render();
  }, source);
  await page.locator('#bw-new-page').click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click();
  await page.keyboard.type('A note worth keeping'); await saved();
  await page.keyboard.press('End'); await page.keyboard.press('Enter');
  await page.keyboard.type('These exact words return in a separate copy.'); await saved();
  const original = await currentPaper();
  // Retain an explicit human destination before testing destructive behavior.
  await page.evaluate(p => { const b=window.__barkdown; b.addPage(`bp:v1:${p.paperOwner}:${encodeURIComponent(p.id)}`); }, original);
  await page.locator('.bw-tab.active').hover();
  await page.getByRole('button',{name:'Add to favorites',exact:true}).click();
  assert.equal((await state()).favorites.length,1);
  const organization = await state(); await save(); await shot('01-human-note');
  await page.getByRole('button', {name:'Delete note', exact:true}).click();
  await page.getByRole('alertdialog').waitFor(); await shot('02-confirm-delete');
  await page.getByRole('alertdialog').getByRole('button', {name:'Delete note',exact:true}).click();
  await page.getByText('This note was deleted.', {exact:false}).waitFor();
  await shot('03-retained-original-tab');
  assert.deepEqual(await state(),organization);
  await page.locator('#bw-deleted-notes').click();
  await page.getByRole('dialog',{name:'Deleted notes'}).getByText(original.title,{exact:true}).waitFor();
  await shot('04-deleted-notes'); await page.keyboard.press('Escape'); await save();
  await close('delete-and-retain');
  await launch();
  await page.locator('#bw-deleted-notes').click();
  await page.getByRole('dialog',{name:'Deleted notes'}).getByText(original.title,{exact:true}).waitFor();
  await shot('05-after-restart');
  await page.setViewportSize({width:820,height:900}); await shot('06-narrow-recovery');
  await page.getByRole('button',{name:'Recover a copy',exact:true}).click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  const copy = await currentPaper();
  assert.notEqual(copy.id,original.id); assert.equal(copy.title,original.title);
  assert.deepEqual(copy.raw.blocks,original.raw.blocks);
  assert.deepEqual(await state(),organization);
  await shot('07-recovered-copy');
  await page.setViewportSize({width:1400,height:900});
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror h1').click();
  await page.keyboard.press('End'); await page.keyboard.type(' — edited later'); await saved();
  const later = await currentPaper();
  await page.locator('#bw-deleted-notes').click();
  await page.getByRole('button',{name:'Open recovered copy',exact:true}).click();
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  assert.deepEqual((await currentPaper()).raw,later.raw);
  assert.deepEqual(await state(),organization); await shot('08-later-edit-preserved');
  const absence = await page.evaluate(async p => { try { await window.barkdown.barkpark.get(p.id,undefined,p.paperOwner); return false; } catch (e) { return /404|not found/i.test(e.message); } },original);
  assert(absence,'Recovery must not recreate the original');
  assert.deepEqual(manifest.errors,[]);
  manifest.results.push('Human Paper typing, revision-checked deletion and retained unavailable original tab',
    'Deleted notes survives application restart; narrow dialog recovers native blocks under a new identity',
    'Original Pages/favorites remain unchanged; repeat recovery preserves later human edits and leaves original absent');
  console.log('PASS',manifest.results);
} catch (error) {
  manifest.failure=error.stack;
  if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  throw error;
} finally {
  if(app)await close('restart-and-recover');
  manifest.artifacts=Object.fromEntries(fs.readdirSync(out).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(out,name))).digest('hex')]));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Native deletion evidence:',out,'Retained data:',userData);
}
