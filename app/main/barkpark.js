// Barkpark HTTP adapter. Reads Papers, search, backlinks, related and history from a Barkpark server.
// Writes are fenced through the bulldocs ops endpoint with an if-rev guard and are off unless enabled in settings.
// Endpoint shapes come from the Barkpark OpenAPI document (docs/openapi.json in the sibling repository).
const { execFile, spawn } = require('child_process');
const portabledoc = require('../shared/portabledoc');
const { readCatalog } = require('./paper-catalog');

function normalise(config) {
  const server = String(config?.server || '').replace(/\/+$/, '');
  return { server, token: config?.token || '', dataset: config?.dataset || 'production', writes: Boolean(config?.writes) };
}

async function request(config, method, route, body, { maxBytes } = {}) {
  const { server, token } = normalise(config);
  if (!server) throw new Error('No Barkpark server configured');
  const response = await fetch(server + route, {
    method,
    headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let text;
  if (maxBytes && response.body) {
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new Error('Paper library response exceeded the page size budget; no partial catalog was loaded.'); }
        chunks.push(Buffer.from(value));
      }
      text = Buffer.concat(chunks).toString('utf8');
    } finally { reader.releaseLock(); }
  } else text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || data?.message || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.code = data?.error?.code || data?.code;
    throw error;
  }
  return data;
}

// Responses arrive bare, or wrapped in { result: … } on newer servers.
function unwrap(data) { return data && typeof data === 'object' && !Array.isArray(data) && data.result && typeof data.result === 'object' ? data.result : data; }
function envelopeDocs(data) {
  const d = unwrap(data);
  if (Array.isArray(d)) return d;
  return d?.documents || d?.revisions || d?.results || d?.items || d?.data || [];
}

function htmlToText(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function paperToSummary(doc) {
  const fromHtml = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(doc.body_html || '')?.[1];
  const fromBlocks = Array.isArray(doc.blocks) ? doc.blocks.find(b => /^heading|^h[1-3]$/.test(b.type || b._type || '')) : null;
  const given = doc.title && doc.title !== doc._id && doc.title !== doc.slug ? doc.title : null;
  const title = given || doc.name || (fromHtml && htmlToText(fromHtml)) || (fromBlocks && blocksToText([fromBlocks])) || doc.title || doc.slug || doc._id;
  const text = doc.blocks ? blocksToText(doc.blocks) : htmlToText(doc.body_html);
  return { id: doc._id, title, updatedAt: doc._updatedAt, createdAt: doc._createdAt, rev: doc._rev, source: 'barkpark', excerpt: text.slice(0, 160), references: [], proposals: 0, tags: doc.tags || [], slug: doc.slug || doc._id, draft: doc._draft };
}

function blocksToText(blocks) {
  const out = [];
  const walk = value => {
    if (value == null) return;
    if (typeof value === 'string') { out.push(value); return; }
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === 'object') {
      if (typeof value.value === 'string') out.push(value.value);
      if (typeof value.text === 'string') out.push(value.text);
      for (const key of ['children', 'items', 'content', 'cells', 'rows', 'columns', 'body']) if (value[key]) walk(value[key]);
    }
  };
  walk(blocks);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

function blocksToMarkdown(blocks) { return portabledoc.blocksToMarkdown(blocks); }
function markdownView(blocks) {
  if (!blocks) return { markdown: null };
  try { return { markdown: blocksToMarkdown(blocks) }; }
  catch (error) { return { markdown: null, markdownError: error.message }; }
}
function readablePaper(paper, format) {
  if (format === 'structured') {
    if (!Array.isArray(paper.blocks)) throw new Error('This paper has no structured blocks; read its Markdown/HTML representation.');
    const slug = paper.id || paper.slug;
    return JSON.stringify({ id: slug ? 'bp:' + slug : undefined, title: paper.title, rev: paper.rev, blocks: paper.blocks }, null, 2);
  }
  if (paper.markdownError && paper.blocks) return 'Markdown representation unavailable: ' + paper.markdownError + '\nUse these PortableDoc blocks as authoritative content. For tables, call edit_table with the stable block id after this read; its cells use zero-based row/column and optional header:true. It preserves untouched content and metadata. Do not replace this JSON as Markdown.\n' + JSON.stringify(paper.blocks, null, 2);
  return paper.markdown || htmlToText(paper.html);
}

async function test(config) {
  const { server, dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/query/${encodeURIComponent(dataset)}/paper?limit=60&fields=title`);
  return { ok: true, server, dataset, papers: envelopeDocs(data).length };
}

async function listPapers(config, limit = 60) {
  const { dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/query/${encodeURIComponent(dataset)}/paper?limit=${limit}&order=_updatedAt:desc&fields=title,slug,tags,body_html,blocks`);
  return envelopeDocs(data).map(paperToSummary);
}

// Discovery needs identities and labels, not every note's full body. Content
// is read when opened/searched; long papers must not inflate every refresh.
const catalogFields = 'title,slug,tags';
function catalogSummaries(documents) {
  return documents.map(paperToSummary).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || a.id.localeCompare(b.id));
}
async function listAllPapers(config) {
  // Capture the entire connection before the first asynchronous page.
  const captured = normalise(config);
  const documents = await readCatalog(({ limit, offset }) => request(captured, 'GET',
    `/v1/data/query/${encodeURIComponent(captured.dataset)}/paper?limit=${limit}&offset=${offset}&order=_createdAt:asc&perspective=published&count=true&fields=${catalogFields}`, undefined, { maxBytes: 20 * 1024 * 1024 }));
  return catalogSummaries(documents);
}

async function getPaper(config, id) {
  const { dataset } = normalise(config);
  const doc = unwrap(await request(config, 'GET', `/v1/data/doc/${encodeURIComponent(dataset)}/paper/${encodeURIComponent(id)}?perspective=raw`));
  const paper = doc?.document || doc;
  const view = markdownView(paper.blocks);
  return { ...paperToSummary(paper), raw: paper, ...view, html: paper.body_html || null, blocks: paper.blocks || null, revision: paper._rev, rev: paper.rev ?? null, description: paper.description || '' };
}

async function search(config, query, limit = 20) {
  const { dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/search/${encodeURIComponent(dataset)}?q=${encodeURIComponent(query)}&limit=${limit}&type=paper`);
  return envelopeDocs(data).map(doc => ({ ...paperToSummary(doc), snippet: doc._snippet || doc.snippet || paperToSummary(doc).excerpt, score: doc._score || doc.score || 0 }));
}

async function backlinks(config, id) {
  const { dataset } = normalise(config);
  return envelopeDocs(await request(config, 'GET', `/v1/data/backlinks/${encodeURIComponent(dataset)}/${encodeURIComponent(id)}`)).map(paperToSummary);
}

async function related(config, id, limit = 6) {
  const { dataset } = normalise(config);
  return envelopeDocs(await request(config, 'GET', `/v1/data/related/${encodeURIComponent(dataset)}/${encodeURIComponent(id)}?limit=${limit}`)).map(doc => ({ ...paperToSummary(doc), reasons: doc._reasons || doc.reasons || ['related'] }));
}

async function history(config, id, limit = 20) {
  const { dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/history/${encodeURIComponent(dataset)}/paper/${encodeURIComponent(id)}?limit=${limit}`);
  return envelopeDocs(data).map(rev => ({ rev: rev._rev || rev.rev || rev.id, at: rev._createdAt || rev.at || rev.created_at, actor: rev.actor || rev._author || rev.author || 'barkpark', summary: rev.summary || rev.message || rev.reason || '' }));
}

async function applyOps(config, slug, ops, ifRev) {
  const result = await request(config, 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(slug)}/ops`, ifRev != null ? { ifRev, ops } : { ops });
  return { ok: true, rev: result.rev != null ? Number(result.rev) : null, unchanged: Boolean(result.unchanged), opCount: result.op_count ?? ops.length };
}
async function publish(config, payload) { return request(config, 'POST', '/v1/plugins/bulldocs/papers', payload); }

async function propose(config, slug, proposal) {
  return request(config, 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(slug)}/proposals`, proposal);
}

// Reuse the credentials the person already saved with the bp CLI, without Barkdown storing them itself.
// Upload a picture to the connected Barkpark's media library. viaCli: `bp media upload <file>`;
// direct: multipart POST /media/upload with the bearer. Returns { src, id, width, height, alt }.
async function uploadMedia(config, { name, mime, dataUrl, filePath }) {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  let file = filePath;
  let temp = null;
  if (!file) {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
    if (!m) throw new Error('uploadMedia needs a data: URL or a file path');
    temp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-upload-')), (name || 'image').replace(/[^\w.-]+/g, '_') || 'image');
    fs.writeFileSync(temp, Buffer.from(m[2], 'base64'));
    file = temp;
  }
  try {
    let data;
    if (config.viaCli) {
      data = await cli([...(config.cliRouting || []), 'media', 'upload', file, '--yes']);
    } else {
      const { server, token, dataset } = normalise(config);
      if (!server) throw new Error('No Barkpark server configured');
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(file)], { type: mime || 'application/octet-stream' }), name || path.basename(file));
      form.append('dataset', dataset);
      const response = await fetch(server + '/media/upload', { method: 'POST', headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: form, signal: AbortSignal.timeout(60000) });
      const text = await response.text();
      try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
      if (!response.ok) throw new Error(data?.error?.message || data?.message || `${response.status} ${response.statusText}`);
    }
    const d = unwrap(data) || {};
    const info = d.asset?.fileInfo || {};
    const server = String(config.server || '').replace(/\/+$/, '');
    // The dataset-less /media/upload endpoint returns {url, assetDocId};
    // v1/CLI responses expose absoluteUrl or asset.fileInfo.url instead.
    const mediaUrl = d.absoluteUrl || info.url || d.url;
    const src = mediaUrl ? (server ? new URL(mediaUrl, server + '/').href : mediaUrl) : '';
    if (!src) throw new Error('the upload returned no url');
    return { src, id: d.asset?._publishedId || d.assetDocId || null, width: info.width ? Number(info.width) : null, height: info.height ? Number(info.height) : null, alt: d.asset?.altText || null };
  } finally {
    if (temp) { try { fs.rmSync(path.dirname(temp), { recursive: true, force: true }); } catch {} }
  }
}

function importFromCli() {
  return new Promise(resolve => {
    execFile('bp', ['servers', '-o', 'json'], { windowsHide: true, shell: false, timeout: 15000 }, (error, stdout) => {
      if (error) return resolve({ ok: false, error: error.message });
      try {
        const data = JSON.parse(stdout);
        const active = (data.servers || []).find(s => s.active) || data.servers?.[0];
        if (!active) return resolve({ ok: false, error: 'No saved bp server' });
        execFile('bp', ['whoami', '-o', 'json'], { windowsHide: true, shell: false, timeout: 15000 }, (error2, stdout2) => {
          let who = null;
          try { who = JSON.parse(stdout2); } catch {}
          resolve({ ok: true, server: active.server, name: active.name, dataset: who?.dataset || 'production', tier: active.tier, tokenFromCli: true });
        });
      } catch (parseError) { resolve({ ok: false, error: parseError.message }); }
    });
  });
}

// When the token itself is not exposed by `bp servers`, proxy reads through the CLI.
function cli(args, input) {
  return new Promise((resolve, reject) => {
    // bp is a native executable on Windows. Pass titles/searches as literal
    // arguments: cmd.exe would split spaces and interpret shell metacharacters.
    // A write without a body must also have no stdin pipe: older native CLI
    // builds correctly refuse an unused pipe as a possibly lost payload.
    const child = spawn('bp', [...args, '-o', 'json'], { windowsHide: true, shell: false, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, settled = false;
    const finish = (error) => {
      if (settled) return; settled = true; clearTimeout(timer);
      let data = null;
      for (const text of [stdout, stderr]) { if (data) break; try { const parsed = JSON.parse(String(text || '').trim()); if (parsed && typeof parsed === 'object') data = parsed; } catch {} }
      if (data && data.ok === false && data.error) { const e = new Error(data.error.message || 'bp failed'); e.code = data.error.code; if (!e.code && /ifRev did not match|precondition/i.test(e.message)) e.code = 'precondition_failed'; e.status = e.code === 'precondition_failed' ? 412 : undefined; return reject(e); }
      if (error) { const e = new Error((stderr || stdout || error.message).trim().slice(0, 500)); if (/ifRev did not match|precondition_failed/i.test(e.message)) { e.code = 'precondition_failed'; e.status = 412; } return reject(e); }
      resolve(data ?? { raw: stdout });
    };
    const timer = setTimeout(() => { child.kill(); finish(new Error('bp timed out after 60 seconds')); }, 60000);
    const receive = stream => chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 20 * 1024 * 1024) { child.kill(); finish(new Error('bp exceeded its output limit')); return; }
      if (stream === 'out') stdout += chunk; else stderr += chunk;
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', receive('out')); child.stderr.on('data', receive('err'));
    child.on('error', finish);
    child.on('close', (code, signal) => finish(code === 0 ? null : new Error(`bp exited ${signal || code}`)));
    if (input != null) { child.stdin.on('error', finish); child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input)); }
  });
}

async function cliListPapers(limit = 60, routing = []) {
  const data = await cli([...routing, 'doc', 'query', 'paper', '--limit', String(limit), '--order', '_updatedAt:desc', '--fields', 'title,slug,tags,body_html,blocks']);
  return envelopeDocs(data).map(paperToSummary);
}

async function cliScope(config) {
  const captured = normalise(config);
  // Windows bp currently needs a shell. Accept only safe literal routing values;
  // never let saved connection text become shell syntax or ambient CLI routing.
  if (!/^https?:\/\/[a-zA-Z0-9.:[\]_/~-]+$/.test(captured.server) || !/^[a-zA-Z0-9_-]+$/.test(captured.dataset)) throw new Error('Complete CLI discovery requires an explicit server URL and dataset. Choose a direct connection in Settings.');
  const routing = ['-s', captured.server, '-d', captured.dataset];
  const who = await cli([...routing, 'whoami']);
  if (String(who?.server || '').replace(/\/+$/, '') !== captured.server || who?.dataset !== captured.dataset ||
      !/^[a-zA-Z0-9_-]+$/.test(who?.workspace || '') || !/^[a-zA-Z0-9_-]+$/.test(who?.project || '')) throw new Error('The CLI could not confirm the configured library scope. Choose a direct connection in Settings.');
  routing.push('-w', who.workspace, '-p', who.project);
  return routing;
}

async function cliListAllPapers(config) {
  const routing = await cliScope(config);
  const documents = await readCatalog(({ limit, offset }) => cli([...routing, 'doc', 'query', 'paper', '--limit', String(limit), '--offset', String(offset), '--order', '_createdAt:asc', '--perspective', 'published', '--count', '--fields', catalogFields]));
  return catalogSummaries(documents);
}

async function cliGetPaper(id, routing = []) {
  const data = unwrap(await cli([...routing, 'doc', 'get', 'paper', id, '--perspective', 'raw']));
  const paper = data?.document || data;
  return { ...paperToSummary(paper), raw: paper, ...markdownView(paper.blocks), html: paper.body_html || null, blocks: paper.blocks || null, revision: paper._rev, rev: paper.rev ?? null, description: paper.description || '' };
}

// Writes through the bp CLI. The fenced ops verb rejects a stale rev with precondition_failed.
async function cliApplyOps(slug, ops, ifRev, routing = []) {
  // The guard travels in the body as ifRev (the CLI's --if-rev flag is not honoured by the server).
  const result = await cli([...routing, 'bulldocs', 'patch', slug, '--file', '-', '--yes'], ifRev != null ? { ifRev, ops } : { ops });
  return { ok: true, rev: result.rev != null ? Number(result.rev) : null, unchanged: Boolean(result.unchanged), opCount: result.op_count ?? ops.length };
}
async function cliPublish(payload, routing = []) { return cli([...routing, 'bulldocs', 'publish', payload.slug, '--file', '-', '--yes'], payload); }
async function cliPatchTitle() {
  // Generic doc patch creates a draft twin; it does not rename the published
  // Paper. The audited Paper ops API has no guarded title operation. Refuse
  // before writing instead of claiming success or publishing unrelated drafts.
  throw new Error('Paper title changes are not supported by this connection yet. No title was saved.');
}

async function cliSearch(query, limit = 20, routing = []) {
  try {
    const data = await cli([...routing, 'doc', 'query', 'paper', '--filter', `title*=${query}`, '--limit', String(limit), '--fields', 'title,slug,tags,body_html,blocks']);
    return envelopeDocs(data).map(doc => ({ ...paperToSummary(doc), snippet: paperToSummary(doc).excerpt }));
  } catch (error) { return []; }
}

async function cliBacklinks(id, routing = []) { try { return envelopeDocs(await cli([...routing, 'doc', 'backlinks', id])).map(paperToSummary); } catch { return []; } }
async function cliHistory(id, routing = []) { try { return envelopeDocs(await cli([...routing, 'doc', 'history', 'paper', id])).map(rev => ({ rev: rev._rev || rev.rev, at: rev._createdAt || rev.at, actor: rev.actor || rev.author || 'barkpark', summary: rev.summary || rev.message || '' })); } catch { return []; } }

module.exports = { cliScope, uploadMedia, test, listPapers, listAllPapers, getPaper, search, backlinks, related, history, applyOps, publish, propose, importFromCli, cliListPapers, cliListAllPapers, cliGetPaper, cliSearch, cliBacklinks, cliHistory, cliApplyOps, cliPublish, cliPatchTitle, blocksToMarkdown, markdownView, readablePaper, htmlToText };
