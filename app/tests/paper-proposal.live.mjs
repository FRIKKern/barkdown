// Live check: an agent proposal on a Barkpark paper (made through the MCP server) shows up in the paper tab
// and, when kept, is applied on the server through the fenced ops endpoint.
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
  await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
  await page.evaluate(() => window.__barkdown.expandArchive());
  await page.waitForSelector('#bw-pages [data-source="barkpark"], #bw-cloud-archive [data-source="barkpark"]', { timeout: 90000 });
  const storeDir = await page.evaluate(() => window.__barkdown.state.settings.userData);

  // The MCP server the agents use, pointed at the app's own store.
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.resolve('main/mcp-server.js'), storeDir] });
  const client = new Client({ name: 'barkdown-test', version: '0.0.0' });
  await client.connect(transport);
  const listing = JSON.parse((await client.callTool({ name: 'list_documents', arguments: {} })).content[0].text);
  step('MCP listing includes Barkpark papers', listing.some(d => d.id === 'bp:' + SLUG));
  const read = (await client.callTool({ name: 'read_document', arguments: { id: 'bp:' + SLUG } })).content[0].text;
  step('MCP read_document returns the paper as markdown', read.includes('Barkpark paper') && read.includes('Top-level blocks'));
  const marker = 'proposal-' + Date.now().toString(36);
  const proposed = (await client.callTool({ name: 'propose_document_edit', arguments: { id: 'bp:' + SLUG, mode: 'append', markdown: `Agent proposal ${marker} with **bold** text.`, summary: 'Live proposal check' } })).content[0].text;
  step('MCP proposal recorded for the paper', /Proposal .* added to Barkpark paper/.test(proposed));
  await client.close();

  const before = serverPaper();
  await page.evaluate(slug => window.__barkdown.openTarget({ kind: 'doc', id: slug, source: 'barkpark', title: slug }), SLUG);
  await page.waitForSelector('.bw-paper-pane:not([hidden]) .bw-proposal [data-act="keep"]', { timeout: 60000 });
  step('proposal card shown in the paper tab', (await page.locator('.bw-paper-pane:not([hidden]) .bw-proposal').innerText()).includes('Live proposal check'));
  await page.screenshot({ path: 'test-results/15-paper-proposal.png' });
  await page.locator('.bw-paper-pane:not([hidden]) .bw-proposal [data-act="keep"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.bw-paper-pane:not([hidden]) .bw-proposal').length === 0, null, { timeout: 60000 });
  await page.waitForFunction(marker => (document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror')?.innerText || '').includes(marker), marker, { timeout: 60000 });
  const after = serverPaper();
  step('kept proposal landed on the server as a new block', after.rev > before.rev && JSON.stringify(after.blocks).includes(marker));
  step('inline markdown became a strong node', JSON.stringify(after.blocks).includes('"type":"strong"'));
  await page.screenshot({ path: 'test-results/16-paper-proposal-kept.png' });
  const extra = after.blocks.filter(b => JSON.stringify(b).includes(marker)).map(b => ({ op: 'remove-block', id: b.id }));
  if (extra.length) bp(['bulldocs', 'patch', SLUG, '--file', '-', '--yes'], JSON.stringify({ ifRev: after.rev, ops: extra }));
} finally {
  console.log(JSON.stringify({ results }, null, 1));
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
if (results.some(r => !r.ok)) process.exit(1);
console.log(`All ${results.length} live proposal checks passed.`);
