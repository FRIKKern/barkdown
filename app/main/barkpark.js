// Barkpark HTTP adapter. Reads Papers, search, backlinks, related and history from a Barkpark server.
// Writes are fenced through the bulldocs ops endpoint with an if-rev guard and are off unless enabled in settings.
// Endpoint shapes come from the Barkpark OpenAPI document (docs/openapi.json in the sibling repository).
const { execFile } = require('child_process');

function normalise(config) {
  const server = String(config?.server || '').replace(/\/+$/, '');
  return { server, token: config?.token || '', dataset: config?.dataset || 'production', writes: Boolean(config?.writes) };
}

async function request(config, method, route, body) {
  const { server, token } = normalise(config);
  if (!server) throw new Error('No Barkpark server configured');
  const response = await fetch(server + route, {
    method,
    headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
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

function envelopeDocs(data) {
  if (Array.isArray(data)) return data;
  return data?.documents || data?.revisions || data?.results || data?.items || data?.data || [];
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

function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(block => {
    const type = block.type || block._type || 'paragraph';
    const inline = value => Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : v?.value || v?.text || '').join('') : typeof value === 'string' ? value : value?.value || value?.text || '';
    if (/^heading/.test(type) || type === 'h1' || type === 'h2' || type === 'h3') { const level = block.level || Number(type.replace(/\D/g, '')) || 2; return `${'#'.repeat(level)} ${inline(block.value ?? block.text ?? block.children)}`; }
    if (type === 'paragraph' || type === 'text') return inline(block.value ?? block.text ?? block.children);
    if (type === 'list' || type === 'bullets' || type === 'bulletList') return (block.items || []).map(i => `- ${inline(i.value ?? i)}`).join('\n');
    if (type === 'numbered' || type === 'orderedList') return (block.items || []).map((i, n) => `${n + 1}. ${inline(i.value ?? i)}`).join('\n');
    if (type === 'quote' || type === 'blockquote') return `> ${inline(block.value ?? block.text)}`;
    if (type === 'code') return '```' + (block.language || '') + '\n' + inline(block.value ?? block.code ?? block.text) + '\n```';
    if (type === 'divider' || type === 'hr') return '---';
    if (type === 'table') return (block.rows || []).map(row => '| ' + (row.cells || row).map(c => inline(c.value ?? c)).join(' | ') + ' |').join('\n');
    return `<!-- ${type} block -->\n${blocksToText([block])}`;
  }).join('\n\n');
}

async function test(config) {
  const { server, dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/query/${encodeURIComponent(dataset)}/paper?limit=1`);
  return { ok: true, server, dataset, sample: envelopeDocs(data).length };
}

async function listPapers(config, limit = 60) {
  const { dataset } = normalise(config);
  const data = await request(config, 'GET', `/v1/data/query/${encodeURIComponent(dataset)}/paper?limit=${limit}&order=_updatedAt:desc&fields=title,slug,tags,body_html,blocks`);
  return envelopeDocs(data).map(paperToSummary);
}

async function getPaper(config, id) {
  const { dataset } = normalise(config);
  const doc = await request(config, 'GET', `/v1/data/doc/${encodeURIComponent(dataset)}/paper/${encodeURIComponent(id)}?perspective=raw`);
  const paper = doc?.document || doc;
  const markdown = paper.blocks ? blocksToMarkdown(paper.blocks) : null;
  return { ...paperToSummary(paper), raw: paper, markdown, html: paper.body_html || null, blocks: paper.blocks || null, revision: paper._rev, contentRev: paper.content?.rev ?? paper.rev ?? null };
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
  if (!normalise(config).writes) throw new Error('Barkpark writes are disabled in Settings');
  return request(config, 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(slug)}/ops`, { ops, if_rev: ifRev });
}

async function propose(config, slug, proposal) {
  if (!normalise(config).writes) throw new Error('Barkpark writes are disabled in Settings');
  return request(config, 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(slug)}/proposals`, proposal);
}

// Reuse the credentials the person already saved with the bp CLI, without Barkdown storing them itself.
function importFromCli() {
  return new Promise(resolve => {
    execFile('bp', ['servers', '-o', 'json'], { windowsHide: true, shell: process.platform === 'win32', timeout: 15000 }, (error, stdout) => {
      if (error) return resolve({ ok: false, error: error.message });
      try {
        const data = JSON.parse(stdout);
        const active = (data.servers || []).find(s => s.active) || data.servers?.[0];
        if (!active) return resolve({ ok: false, error: 'No saved bp server' });
        execFile('bp', ['whoami', '-o', 'json'], { windowsHide: true, shell: process.platform === 'win32', timeout: 15000 }, (error2, stdout2) => {
          let who = null;
          try { who = JSON.parse(stdout2); } catch {}
          resolve({ ok: true, server: active.server, name: active.name, dataset: who?.dataset || 'production', tier: active.tier, tokenFromCli: true });
        });
      } catch (parseError) { resolve({ ok: false, error: parseError.message }); }
    });
  });
}

// When the token itself is not exposed by `bp servers`, proxy reads through the CLI.
function cli(args) {
  return new Promise((resolve, reject) => {
    execFile('bp', [...args, '-o', 'json'], { windowsHide: true, shell: process.platform === 'win32', timeout: 30000, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error((stderr || error.message).trim()));
      try { resolve(JSON.parse(stdout)); } catch { resolve({ raw: stdout }); }
    });
  });
}

async function cliListPapers(limit = 60) {
  const data = await cli(['doc', 'query', 'paper', '--limit', String(limit), '--order', '_updatedAt:desc', '--fields', 'title,slug,tags,body_html,blocks']);
  return envelopeDocs(data).map(paperToSummary);
}

async function cliGetPaper(id) {
  const data = await cli(['doc', 'get', 'paper', id, '--perspective', 'raw']);
  const paper = data?.document || data;
  return { ...paperToSummary(paper), raw: paper, markdown: paper.blocks ? blocksToMarkdown(paper.blocks) : null, html: paper.body_html || null, blocks: paper.blocks || null, revision: paper._rev };
}

async function cliSearch(query, limit = 20) {
  try {
    const data = await cli(['doc', 'query', 'paper', '--filter', `title*=${query}`, '--limit', String(limit), '--fields', 'title,slug,tags,body_html,blocks']);
    return envelopeDocs(data).map(doc => ({ ...paperToSummary(doc), snippet: paperToSummary(doc).excerpt }));
  } catch (error) { return []; }
}

async function cliBacklinks(id) { try { return envelopeDocs(await cli(['doc', 'backlinks', id])).map(paperToSummary); } catch { return []; } }
async function cliHistory(id) { try { return envelopeDocs(await cli(['doc', 'history', 'paper', id])).map(rev => ({ rev: rev._rev || rev.rev, at: rev._createdAt || rev.at, actor: rev.actor || rev.author || 'barkpark', summary: rev.summary || rev.message || '' })); } catch { return []; } }

module.exports = { test, listPapers, getPaper, search, backlinks, related, history, applyOps, propose, importFromCli, cliListPapers, cliGetPaper, cliSearch, cliBacklinks, cliHistory, blocksToMarkdown, htmlToText };
