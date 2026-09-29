import { openFixturePaper } from './lib/paper-fixture.mjs';
import { connectPaperFixture } from './lib/paper-fixture.mjs';
// Live check: MCP edits save directly, show intention in the paper, and support fenced Undo.
import { _electron as electron } from 'playwright';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const SLUG = 'barkdown-editor-test';
import { bp, publishFixture } from './lib/paper-fixture.mjs';
const serverPaper = () => { const j = bp(['doc', 'get', 'paper', SLUG, '--perspective', 'raw']); return j.document || j; };
publishFixture({ slug: SLUG, title: 'Agent proposal target', description: 'Scratch paper an agent proposes a change to through the MCP server; the proposal stays pending on the paper tab; rewritten on every run of tests/paper-proposal.live.mjs.', blocks: [{ type: 'heading', level: 1, text: 'Barkdown editor test' }, { type: 'paragraph', content: [{ type: 'text', value: 'Top-level blocks live here; an agent proposes, a person keeps or discards.' }] }] });
const results = [];
const step = (name, ok) => { results.push({ name, ok }); if (!ok) throw new Error('Failed: ' + name); };

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-proposal-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
await page.waitForSelector('#bw-documents .bw-nav');
await page.setViewportSize({ width: 1400, height: 900 });
try {
  await connectPaperFixture(page);
  await page.evaluate(() => window.__barkdown.expandArchive());
  await page.waitForSelector('#bw-pages [data-source="barkpark"], #bw-cloud-archive [data-source="barkpark"]', { timeout: 90000 });
  const storeDir = await page.evaluate(() => window.__barkdown.state.settings.userData);

  // The MCP server the agents use, pointed at the app's own store.
  // Main hands the MCP server the stored token as BARKDOWN_BP_TOKEN (main/providers/runs.js); the tour does the same.
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('main/mcp-server.js'), storeDir], env: { ...process.env, BARKDOWN_BP_TOKEN: process.env.BARKPARK_API_TOKEN || '' } });
  const client = new Client({ name: 'barkdown-test', version: '0.0.0' });
  await client.connect(transport);
  const listing = JSON.parse((await client.callTool({ name: 'list_documents', arguments: {} })).content[0].text);
  step('MCP listing includes Barkpark papers', listing.some(d => d.id === 'bp:' + SLUG));
  const read = (await client.callTool({ name: 'read_document', arguments: { id: 'bp:' + SLUG } })).content[0].text;
  step('MCP read_document returns the paper as markdown', read.includes('Barkpark paper') && read.includes('Top-level blocks'));
  const before = serverPaper();
  await openFixturePaper(page, SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) .ProseMirror', {timeout:60000});
  const marker = 'direct-' + Date.now().toString(36);
  const result = await client.callTool({name:'edit_document',arguments:{id:'bp:'+SLUG,mode:'replace_block',blockIndex:1,markdown:`Agent edit ${marker} with **bold** text.\n\nA second replacement block.\n\nA third replacement block.`,summary:'Live direct edit check'}});
  step('MCP directly saves the paper', !result.isError && result.content[0].text.includes('Saved edit'));
  await page.evaluate(() => { window.__barkdown.controllers.forEach(c => { if(c.type==='doc') c.refresh(); }); });
  await page.waitForSelector('[data-agent-phase="select"]', {timeout:10000});
  step('paper marks the target before replacing it', true);
  await page.screenshot({path:'test-results/15-paper-agent-selection.png'});
  await page.waitForSelector('[data-agent-phase="write"]', {timeout:10000});
  step('paper shows a writing caret', await page.locator('.bw-agent-caret').count() === 1);
  await page.waitForFunction(() => !document.querySelector('[data-agent-phase]'));
  const after = serverPaper();
  step('all replacement blocks landed without Keep', after.rev > before.rev && JSON.stringify(after.blocks).includes(marker) && JSON.stringify(after.blocks).includes('A third replacement block.') && await page.locator('[data-act="keep"]').count() === 0);
  step('inline markdown became a strong node', JSON.stringify(after.blocks).includes('"type":"strong"'));
  await page.locator('.bw-paper-pane:not([hidden]) #agent-edit button').click();
  await page.waitForFunction(marker => !(document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')?.textContent || '').includes(marker), marker);
  step('Undo restores the exact server blocks', JSON.stringify(serverPaper().blocks) === JSON.stringify(before.blocks));
  await client.close();
} finally {
  console.log(JSON.stringify({ results }, null, 1));
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
if (results.some(r => !r.ok)) process.exit(1);
console.log(`All ${results.length} live proposal checks passed.`);
