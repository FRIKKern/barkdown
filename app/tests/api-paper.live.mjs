// Actual Electron/API SDK and disposable Paper server; model responses are scripted.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { createToolFixture } from './fixtures/anthropic-tools-http.mjs';
const require = createRequire(import.meta.url);
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1') throw new Error('Requires status-shots-isolated.mjs');
const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], { shell: true, encoding: 'utf8', maxBuffer: 20e6, ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input }) }));
for (const [id, title] of [['barkdown', 'Barkdown'], ['scratch', 'Scratch']]) { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); }
const slug = 'api-paper-parity';
bp(['bulldocs', 'publish', slug, '--file', '-', '--yes'], JSON.stringify({ slug, title: 'API Paper parity', description: 'Disposable actual API tool-loop evidence for connected Paper discovery, structured reads, revision checked paragraph and table edits, visible Undo and durable reload.', tags: [{ tag: 'barkdown', strength: 90, rationale: 'Barkdown integration evidence' }, { tag: 'scratch', strength: 40, rationale: 'Disposable synthetic fixture' }], blocks: [{ type: 'heading', level: 1, text: 'API Paper parity' }, { type: 'paragraph', content: [{ type: 'text', value: 'Original paragraph.' }] }, { type: 'table', rows: [['First line\nSecond line', 'Keep this cell']] }] }));
const read = () => { const raw = bp(['doc', 'get', 'paper', slug, '--perspective', 'raw']); return raw.document || raw; };
const original = read(), results = [];
let tableId;
const transport = await createToolFixture((body, index) => {
  const last = body.messages.at(-1).content;
  const result = Array.isArray(last) ? last.find(b => b.type === 'tool_result') : null;
  if ([1, 2, 3, 5, 6].includes(index)) assert.ok(result && !result.is_error, JSON.stringify(last));
  if (index === 0) return { name: 'list_documents' };
  if (index === 1) { assert.ok(JSON.parse(result.content).some(d => d.id === 'bp:' + slug)); return { name: 'read_document', input: { id: 'bp:' + slug, format: 'structured' } }; }
  if (index === 2) { const doc = JSON.parse(result.content); assert.equal(doc.id, 'bp:' + slug); assert.deepEqual(doc.blocks, original.blocks); tableId = doc.blocks[2].id; return { name: 'edit_document', input: { id: 'bp:' + slug, mode: 'replace_block', blockIndex: 1, markdown: 'Paragraph edited through the API.', summary: 'Clarify the paragraph' } }; }
  if (index === 3) { assert.match(result.content, /Saved edit/); return { text: 'Paragraph update complete.' }; }
  if (index === 4) return { name: 'read_document', input: { id: 'bp:' + slug, format: 'structured' } };
  if (index === 5) { assert.equal(JSON.parse(result.content).blocks[2].id, tableId); return { name: 'edit_table', input: { id: 'bp:' + slug, blockId: tableId, cells: [{ row: 0, column: 0, text: 'API first\nAPI second', align: 'center' }], summary: 'Clarify the table cell' } }; }
  if (index === 6) { assert.match(result.content, /Saved table edit/); return { text: 'Table update complete.' }; }
  throw new Error('Unexpected model turn ' + index);
});
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-api-paper-'));
const capture = process.env.BARKDOWN_EDITOR_CAPTURE === '1';
const out = path.resolve((capture ? '../docs/visual/api-paper/runs/' : 'test-results/api-paper/') + new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(out, { recursive: true });
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceDirty = execFileSync('git', ['status', '--porcelain', '--', '.'], { encoding: 'utf8' }).trim() !== '';
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], recordVideo: { dir: out, size: { width: 1400, height: 900 } }, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
let page, video, editorBundle; const errors = [];
try {
  page = await app.firstWindow(); video = page.video(); await page.setViewportSize({ width: 1400, height: 900 });
  page.on('pageerror', e => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.evaluate(async config => { const s = window.__barkdown.state; s.settings = await window.barkdown.settings.set({ provider: 'api', apiKey: 'synthetic-fixture', barkpark: config }); s.chats[s.current].provider = 'api'; await window.__barkdown.refreshLibrary(); window.__barkdown.render(); }, { enabled: true, writes: true, viaCli: false, server: process.env.BARKDOWN_SHOTS_SERVER, token: process.env.BARKPARK_API_TOKEN, dataset: 'production' });
  const send = async text => { await page.locator('#bw-prompt').fill(text); await page.locator('#bw-prompt').press('Enter'); };
  await send('Update the paragraph in API Paper parity.');
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('Paragraph update complete.'), null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane .ProseMirror')?.textContent.includes('Paragraph edited through the API.'), null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-agent-phase]'));
  editorBundle = JSON.parse(fs.readFileSync(path.join(userData, 'canvas-bundle/current.json'), 'utf8')); assert.equal(editorBundle.source, 'server');
  const paragraphState = read(); assert.match(JSON.stringify(paragraphState.blocks[1]), /Paragraph edited through the API/); assert.deepEqual(paragraphState.blocks[2], original.blocks[2]);
  await page.screenshot({ path: path.join(out, 'paragraph-saved.png') }); results.push('Actual API SDK discovery/read/revision-checked paragraph edit visible in real Paper');
  await page.waitForFunction(() => !window.__barkdown.state.chats[window.__barkdown.state.current].runId);
  await send('Now update the first table cell, keeping its two lines.');
  await page.waitForFunction(() => document.querySelector('#bw-transcript')?.textContent.includes('Table update complete.'), null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane .ProseMirror')?.textContent.includes('API first'), null, { timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-agent-phase]'));
  const tableState = read(); assert.equal(tableState.blocks[2].head, undefined); assert.deepEqual(tableState.blocks[2].rows[0][1], original.blocks[2].rows[0][1]); assert.equal(tableState.blocks[2].rows[0][0].align, 'center'); assert.match(JSON.stringify(tableState.blocks[2]), /API first\\nAPI second/);
  await page.screenshot({ path: path.join(out, 'table-saved.png') }); results.push('API edit_table preserves headerless table, multiline value, alignment and untouched cell');
  await page.locator('.bw-paper-pane #agent-edit button').click();
  await page.waitForFunction(() => document.querySelector('.bw-paper-pane .ProseMirror')?.textContent.includes('First line'));
  assert.deepEqual(read().blocks, paragraphState.blocks); await page.screenshot({ path: path.join(out, 'table-undone.png') }); results.push('Visible Undo restores exact prior table and keeps paragraph edit');
  await page.reload(); await page.waitForFunction(() => document.querySelector('.bw-paper-pane .ProseMirror')?.textContent.includes('Paragraph edited through the API.'), null, { timeout: 60000 });
  assert.deepEqual(read().blocks, paragraphState.blocks); await page.screenshot({ path: path.join(out, 'reloaded.png') }); results.push('Reload retains durable actual server state');
  assert.deepEqual(errors, []); assert.deepEqual(transport.errors, []); assert.equal(transport.requests.length, 7);
  console.log(JSON.stringify({ results, out }));
} catch (error) { if (page) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: error.stack, modelErrors: transport.errors }, null, 2)); throw error; }
finally {
  await app.close(); await transport.close(); if (video) fs.renameSync(await video.path(), path.join(out, 'api-paper.webm'));
  const artifacts = Object.fromEntries(fs.readdirSync(out).filter(f => /\.(png|webm)$/.test(f)).map(f => [f, require('crypto').createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')]));
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ sourceCommit, sourceDirty, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, barkparkDirty: process.env.BARKDOWN_SHOTS_BP_DIRTY, buildFingerprint: process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT, isolated: true, editorBundle, results, artifacts, model: 'Deterministic SSE responses over actual Anthropic SDK; not authenticated model proof', video: 'api-paper.webm' }, null, 2) + '\n');
}
