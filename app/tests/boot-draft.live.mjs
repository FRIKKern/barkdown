import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-boot-draft-')), legacy = path.join(userData, 'barkdown');
fs.mkdirSync(legacy);
const chat = (id, draft, extra = {}) => ({ id, title: id, draft, messages: [], events: [], apiHistory: [], tabs: [], following: true, ...extra });
fs.writeFileSync(path.join(legacy, 'workspace.json'), JSON.stringify({ version: 1, current: 'parent', order: ['parent', 'side'], chats: { parent: chat('parent', 'Saved parent draft', { tabs: [{ id: 'saved-tab', type: 'doc', title: 'Saved note', path: ['saved-note'], source: 'local', url: '', file: '', treeOpen: false, scroll: 0, unread: false }], active: 'saved-tab' }), side: chat('side', 'Saved side draft', { side: true, parent: 'parent' }) } }));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.querySelector('#bw-prompt')?.value === 'Saved parent draft');
  await app.evaluate(({ app }) => {
    const docs = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./documents'), original = docs.list;
    let release; const pending = new Promise(resolve => { release = resolve; });
    global.libraryWaiting = false;
    docs.list = async () => { global.libraryWaiting = true; await pending; return original(); };
    global.releaseLibrary = () => { docs.list = original; release(); };
  });
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  for (let i = 0; i < 100 && !(await app.evaluate(() => global.libraryWaiting)); i++) await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await app.evaluate(() => global.libraryWaiting), true);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Saved parent draft');
  // The person's tabs are theirs, not the library's: they show at once, under their saved names.
  assert.equal(await page.locator('#bw-tabs [data-tab="saved-tab"]').getAttribute('title', { timeout: 2000 }), 'Saved note');
  await page.evaluate(() => window.__barkdown.switchChat('side'));
  assert.equal(await page.evaluate(() => window.__barkdown.state.chats.parent.draft), 'Saved parent draft');
  await page.locator('#bw-prompt').fill('Human side draft while loading');
  await app.evaluate(() => global.releaseLibrary());
  await page.waitForFunction(() => window.__barkdown.state.documents.length > 0);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Human side draft while loading');
  await page.evaluate(() => window.__barkdown.switchChat('parent'));
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'Saved parent draft');
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal(await page.evaluate(() => window.__barkdown.state.chats.parent.draft), 'Saved parent draft');
  assert.equal(await page.evaluate(() => window.__barkdown.state.chats.side.draft), 'Human side draft while loading');
  console.log('PASS delayed startup library shows saved tabs at once and preserves restored main draft, early side navigation, new typing and reload');
} finally { await app.evaluate(() => global.releaseLibrary?.()).catch(() => {}); await app.close(); }
