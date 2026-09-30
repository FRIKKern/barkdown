import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'node:module';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { DOC_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-agent-edit-'));
const app = await electron.launch({executablePath:require('electron'),args:[path.resolve('.'), '--legacy',`--user-data=${userData}`],env:{...process.env,BARKDOWN_PROVIDER:'api',ANTHROPIC_API_KEY:''}});
const page = await app.firstWindow();
// Hosted runners are slower than a developer machine; give live waits room there.
if (process.env.CI) page.setDefaultTimeout(90000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
let client;
try {
  await page.waitForSelector('#bw-documents .bw-nav');
  await page.setViewportSize({width:1400,height:900});
  const doc = await page.evaluate(async () => { const d = await window.barkdown.docs.create({title:'Visible agent edits',markdown:'Original target sentence.\n\nAn untouched second paragraph.'}); await window.__barkdown.refreshLibrary(); window.__barkdown.openTarget({kind:'doc',id:d.id,title:d.title}); return d; });
  await page.waitForSelector('.bw-doc-pane:not([hidden]) .ProseMirror');
  const storeDir = await page.evaluate(() => window.__barkdown.state.settings.userData);
  client = new Client({name:'agent-edit-check',version:'1'});
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve('main/mcp-server.js'),storeDir]}));
  const read = () => client.callTool({name:'read_document',arguments:{id:doc.id}});
  const edit = markdown => client.callTool({name:'edit_document',arguments:{id:doc.id,mode:'replace_block',blockIndex:0,markdown,summary:'Clarify the first paragraph'}});
  const refresh = async () => { await app.evaluate(({app}) => { process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js')('./documents').loadAll(); }); await page.evaluate(() => { window.__barkdown.controllers.forEach(c => {if(c.type==='doc') c.refresh();}); }); };
  await read(); assert.ok(!(await edit('A clearer replacement sentence, written directly in the document.')).isError);
  await refresh();
  await page.waitForSelector('[data-agent-phase="select"]');
  assert.ok((await page.locator('.bw-doc-pane:not([hidden]) .ProseMirror').innerText()).includes('Original target'));
  await page.screenshot({path:'test-results/agent-select.png'});
  await page.waitForSelector('[data-agent-phase="write"]');
  assert.equal(await page.locator('.bw-agent-caret').count(),1);
  await page.screenshot({path:'test-results/agent-writing.png'});
  await page.waitForFunction(() => !document.querySelector('[data-agent-phase]'));
  assert.equal(await page.locator('[data-act="keep"]').count(),0);
  assert.equal((await page.evaluate(id=>window.barkdown.docs.get(id),doc.id)).rev,2,'presentation must not create saves');
  await page.locator('.bw-doc-pane:not([hidden]) #agent-edit button').click();
  await page.waitForFunction(() => document.querySelector('.bw-doc-pane:not([hidden]) .ProseMirror')?.textContent.includes('Original target'));
  await read(); await edit('The next change can be interrupted without losing it.'); await refresh();
  await page.waitForSelector('[data-agent-phase="select"]');
  await page.locator('.bw-doc-pane:not([hidden]) .ProseMirror').click();
  assert.equal(await page.locator('.bw-agent-caret').count(),0,'user interaction must clear presence immediately');
  await page.keyboard.press(DOC_END); await page.keyboard.type(' Human addition.');
  await page.waitForFunction(() => document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent === 'Saved · rev 5');
  const saved = await page.evaluate(id=>window.barkdown.docs.get(id),doc.id);
  assert.ok(saved.markdown.includes('The next change') && saved.markdown.includes('Human addition.'), saved.markdown);
  await page.emulateMedia({reducedMotion:'reduce'});
  await read(); await edit('Reduced motion update.'); await refresh();
  await page.waitForFunction(() => document.querySelector('.bw-doc-pane:not([hidden]) .ProseMirror')?.textContent.includes('Reduced motion update.'));
  assert.equal(await page.locator('.bw-agent-caret').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Direct edit UI passed: target selection, writing caret, no Keep, one save, Undo, human takeover, reduced motion, no renderer errors.');
} finally { await client?.close(); await app.close(); }



