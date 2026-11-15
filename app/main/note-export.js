// Export one Paper note: Markdown (pictures in a new `<name>_files` folder beside the file, relative links),
// HTML (one file, pictures embedded as data: URIs), PDF (that HTML printed with nothing remote) or Copy as
// Markdown (pictures keep their own addresses). Export only reads the note: it never changes its blocks or the
// store, it writes only the file the person chose in the save dialog plus a folder it creates new, and it never
// writes into an existing folder. Note text is escaped; links keep only http, https and mailto.
// Electron (dialog, clipboard, the PDF window) is injected by main.js; see main/note-pdf.js.
const path = require('path');
const { blocksToText } = require('../shared/portabledoc');

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FORMATS = { markdown: { ext: 'md', name: 'Markdown' }, html: { ext: 'html', name: 'HTML' }, pdf: { ext: 'pdf', name: 'PDF' } };

function safeHref(href) {
  const value = String(href ?? '').trim();
  if (!/^(?:https?:\/\/|mailto:)/i.test(value)) return null;
  try { const url = new URL(value); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
// A picture's address as an absolute http(s) URL (a server-relative /media path resolves against the server).
function resolveSrc(src, server) {
  const value = String(src ?? '').trim();
  if (!value || /^data:/i.test(value)) return null;
  try { const url = server ? new URL(value, server.replace(/\/+$/, '') + '/') : new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
const escapeHtml = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const textOf = node => node.value ?? node.text ?? '';
function inlineOf(block) {
  if (Array.isArray(block?.content)) return block.content;
  if (typeof block?.text === 'string') return [{ type: 'text', value: block.text }];
  if (typeof block?.content === 'string') return [{ type: 'text', value: block.content }];
  return [];
}
function cellInline(cell) {
  if (Array.isArray(cell)) return cell;
  if (typeof cell === 'string' || typeof cell === 'number') return [{ type: 'text', value: String(cell) }];
  if (cell && typeof cell === 'object') return cell.value != null && !cell.content ? [{ type: 'text', value: String(cell.value) }] : inlineOf(cell);
  return [];
}
function itemParts(item) {
  if (Array.isArray(item)) return { content: item };
  if (typeof item === 'string') return { content: [{ type: 'text', value: item }] };
  return { content: inlineOf(item || {}), checked: item?.checked === true, children: Array.isArray(item?.children) ? item.children : [] };
}

// ---------- Markdown ----------
// Backslash-escape every character that could start markup, so note text never becomes a link, HTML or emphasis.
// A `(` right after a `]` (or opening a run that may follow one) is escaped too: Barkdown's own small Markdown
// reader ignores backslashes, and `\](` must not read back as a link there either.
const mdText = s => String(s).replace(/[\\`*_[\]<>~|]/g, '\\$&').replace(/&(?=#?\w+;)/g, '\\&').replace(/(^|\\\])\(/g, '$1\\(');
const mdLineStarts = text => text.split('\n').map(line => line.replace(/^(\s*)([#+=-])/, '$1\\$2').replace(/^(\s*\d+)([.)])/, '$1\\$2')).join('\n');
function codeSpan(value, table) {
  const text = table ? String(value).replace(/\|/g, '\\|') : String(value);
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
  const fence = '`'.repeat(longest + 1), pad = /^`|`$/.test(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}
function inlineMd(nodes, ctx = {}) {
  return (nodes || []).map(n => {
    if (!n || typeof n !== 'object') return mdText(String(n ?? ''));
    const inner = () => inlineMd(n.children, ctx);
    const wrap = (mark, body) => body ? mark + body + mark : '';
    switch (n.type) {
      case 'text': return mdText(textOf(n)).replace(/\n/g, ctx.table ? '<br>' : '  \n');
      case 'hardBreak': return ctx.table ? '<br>' : '  \n';
      case 'code': return codeSpan(textOf(n), ctx.table);
      case 'strong': return wrap('**', inner());
      case 'em': return wrap('*', inner());
      case 'strikethrough': return wrap('~~', inner());
      case 'link': { const href = safeHref(n.href), body = inner(); return href && body ? `[${body}](${/[()\s<>]/.test(href) ? '<' + href + '>' : href})` : body; }
      case 'wikilink': return mdText(n.alias || n.target || '');
      case 'tag': return mdText('#' + (n.name || ''));
      default: return Array.isArray(n.children) ? inner() : mdText(n.value ?? n.text ?? n.fallback ?? '');
    }
  }).join('');
}
const indent = (text, pad) => text.split('\n').map((line, i) => i && line ? pad + line : line).join('\n');
function listMd(block) {
  const start = Number.isInteger(block.start) && block.start > 0 ? block.start : 1;
  return (block.items || []).map((item, n) => {
    const { content, checked, children = [] } = itemParts(item);
    const marker = block.ordered ? `${start + n}. ` : '- ', pad = ' '.repeat(marker.length);
    const body = (block.task ? (checked ? '[x] ' : '[ ] ') : '') + mdLineStarts(inlineMd(content));
    return marker + indent([body, ...children.filter(c => c && typeof c === 'object').map(listMd)].join('\n'), pad);
  }).join('\n');
}
function tableMd(block) {
  const rows = (block.rows || []).map(r => Array.isArray(r) ? r : r?.cells || []);
  const head = Array.isArray(block.head) && block.head.length ? block.head : null;
  const width = Math.max(head?.length || 0, ...rows.map(r => r.length), 1);
  const line = cells => '| ' + Array.from({ length: width }, (_, i) => inlineMd(cellInline(cells[i]), { table: true }).replace(/\n/g, ' ') || ' ').join(' | ') + ' |';
  const align = Array.from({ length: width }, (_, i) => { const a = head?.[i]?.align; return a === 'center' ? ':---:' : a === 'right' ? '---:' : '---'; });
  return [line(head || []), '| ' + align.join(' | ') + ' |', ...rows.map(line)].join('\n');
}
function blockMd(block, image) {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'heading': return '#'.repeat(Math.min(6, Math.max(1, Number(block.level) || 2))) + ' ' + inlineMd(inlineOf(block));
    case 'paragraph': case 'eyebrow': case 'byline': case 'ingress': case 'pullquote': {
      const body = inlineMd(inlineOf(block)) || (Array.isArray(block.items) ? mdText(block.items.filter(i => typeof i === 'string').join(' · ')) : '');
      return mdLineStarts(body);
    }
    case 'list': return listMd(block);
    case 'blockquote': return mdLineStarts(inlineMd(inlineOf(block))).split('\n').map(l => l ? '> ' + l : '>').join('\n');
    case 'callout': case 'note': {
      const lines = [...(block.title ? ['**' + mdText(block.title) + '**'] : []), ...mdLineStarts(inlineMd(inlineOf(block))).split('\n').filter((l, i, a) => l || a.length > 1)];
      return lines.map(l => l ? '> ' + l : '>').join('\n');
    }
    case 'code': {
      const value = String(block.value ?? block.code ?? ''), lang = String(block.lang ?? block.language ?? '').replace(/[^\w+#.-]/g, '');
      const fence = '`'.repeat(Math.max(3, ...(value.match(/`{3,}/g) || []).map(run => run.length + 1)));
      return fence + lang + '\n' + value + '\n' + fence;
    }
    case 'divider': return '---';
    case 'table': return tableMd(block);
    case 'image': {
      const ref = image(block), alt = mdText(block.alt || '');
      return ref ? `![${alt}](${ref})` : `*[picture: ${alt || 'unavailable'}]*`;
    }
    default: { const text = blocksToText([block]); return text ? mdLineStarts(mdText(text)) : ''; }
  }
}
// `image(block)` gives the address to write for a picture block (or null).
// An empty heading or paragraph (a new note's blank title row and first line) is left out rather than written
// as a bare `#` or a blank line, so the first heading with words decides whether the title is added.
const content = blocks => (Array.isArray(blocks) ? blocks : []).filter(b => !(['heading', 'paragraph'].includes(b?.type) && !blocksToText([b]).trim()));
function toMarkdown(blocks, { title, image = () => null } = {}) {
  const list = content(blocks);
  const parts = list.map(b => blockMd(b, image)).filter(Boolean);
  if (title && list[0]?.type !== 'heading') parts.unshift('# ' + mdText(title));
  return parts.join('\n\n') + '\n';
}

// ---------- HTML ----------
function inlineHtml(nodes) {
  return (nodes || []).map(n => {
    if (!n || typeof n !== 'object') return escapeHtml(String(n ?? ''));
    const inner = () => inlineHtml(n.children);
    switch (n.type) {
      case 'text': return escapeHtml(textOf(n)).replace(/\n/g, '<br>');
      case 'hardBreak': return '<br>';
      case 'code': return `<code>${escapeHtml(textOf(n))}</code>`;
      case 'strong': return `<strong>${inner()}</strong>`;
      case 'em': return `<em>${inner()}</em>`;
      case 'strikethrough': return `<s>${inner()}</s>`;
      case 'underline': return `<u>${inner()}</u>`;
      case 'link': { const href = safeHref(n.href); return href ? `<a href="${escapeHtml(href)}">${inner()}</a>` : inner(); }
      case 'wikilink': return escapeHtml(n.alias || n.target || '');
      case 'tag': return escapeHtml('#' + (n.name || ''));
      default: return Array.isArray(n.children) ? inner() : escapeHtml(n.value ?? n.text ?? n.fallback ?? '');
    }
  }).join('');
}
function listHtml(block) {
  const tag = block.ordered ? 'ol' : 'ul', start = Number.isInteger(block.start) && block.start > 1 ? ` start="${block.start}"` : '';
  return `<${tag}${start}${block.task ? ' class="tasks"' : ''}>` + (block.items || []).map(item => {
    const { content, checked, children = [] } = itemParts(item);
    return '<li>' + (block.task ? `<input type="checkbox" disabled${checked ? ' checked' : ''}> ` : '') + inlineHtml(content) + children.filter(c => c && typeof c === 'object').map(listHtml).join('') + '</li>';
  }).join('') + `</${tag}>`;
}
function tableHtml(block) {
  const style = cell => ['center', 'right'].includes(cell?.align) ? ` style="text-align:${cell.align}"` : '';
  const row = (cells, tag) => '<tr>' + cells.map(c => `<${tag}${style(c)}>${inlineHtml(cellInline(c))}</${tag}>`).join('') + '</tr>';
  const rows = (block.rows || []).map(r => Array.isArray(r) ? r : r?.cells || []);
  return '<table>' + (Array.isArray(block.head) && block.head.length ? `<thead>${row(block.head, 'th')}</thead>` : '') + `<tbody>${rows.map(r => row(r, 'td')).join('')}</tbody></table>`;
}
function blockHtml(block, image) {
  if (!block || typeof block !== 'object') return '';
  switch (block.type) {
    case 'heading': { const level = Math.min(6, Math.max(1, Number(block.level) || 2)); return `<h${level}>${inlineHtml(inlineOf(block))}</h${level}>`; }
    case 'paragraph': return `<p>${inlineHtml(inlineOf(block))}</p>`;
    case 'eyebrow': case 'byline': case 'ingress': case 'pullquote': return `<p class="${block.type}">${inlineHtml(inlineOf(block)) || escapeHtml(Array.isArray(block.items) ? block.items.filter(i => typeof i === 'string').join(' · ') : '')}</p>`;
    case 'list': return listHtml(block);
    case 'blockquote': return `<blockquote><p>${inlineHtml(inlineOf(block))}</p></blockquote>`;
    case 'callout': case 'note': return `<aside class="callout">${block.title ? `<p><strong>${escapeHtml(block.title)}</strong></p>` : ''}<p>${inlineHtml(inlineOf(block))}</p></aside>`;
    case 'code': { const lang = String(block.lang ?? block.language ?? '').replace(/[^\w+#.-]/g, ''); return `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ''}>${escapeHtml(block.value ?? block.code ?? '')}</code></pre>`; }
    case 'divider': return '<hr>';
    case 'table': return tableHtml(block);
    case 'image': {
      const src = image(block), width = Number(block.width);
      return src ? `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt || '')}"${Number.isFinite(width) && width > 0 ? ` width="${Math.round(width)}"` : ''}></p>` : `<p class="missing">[picture: ${escapeHtml(block.alt || 'unavailable')}]</p>`;
    }
    default: { const text = blocksToText([block]); return text ? `<p>${escapeHtml(text)}</p>` : ''; }
  }
}
function toHtml(blocks, { image = () => null } = {}) { return content(blocks).map(b => blockHtml(b, image)).join('\n'); }
const STYLE = 'body{font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d1d1f;background:#fff;max-width:760px;margin:40px auto;padding:0 20px}h1,h2,h3{line-height:1.25}img{max-width:100%;height:auto}pre{background:#f4f4f5;padding:12px 14px;border-radius:6px;overflow-x:auto;white-space:pre-wrap}code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}table{border-collapse:collapse;margin:1em 0}th,td{border:1px solid #d4d4d8;padding:6px 10px;text-align:left;vertical-align:top}blockquote,.callout{margin:1em 0;padding:4px 14px;border-left:3px solid #d4d4d8;color:#3f3f46}.callout{background:#f4f4f5;border-radius:6px}ul.tasks{list-style:none;padding-left:1.2em}.missing{color:#71717a;font-style:italic}a{color:#2563eb}@media print{body{margin:0;max-width:none}}';
// A standalone page. `remote: false` (the PDF) forbids every request but embedded pictures.
function htmlDocument({ title, blocks, image, remote = true }) {
  const list = content(blocks);
  const csp = `default-src 'none'; img-src data:${remote ? ' https: http:' : ''}; style-src 'unsafe-inline'`;
  const heading = title && list[0]?.type !== 'heading' ? `<h1>${escapeHtml(title)}</h1>\n` : '';
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(title || 'Note')}</title>\n<style>${STYLE}</style>\n</head>\n<body>\n<article>\n${heading}${toHtml(list, { image })}\n</article>\n</body>\n</html>\n`;
}

// ---------- pictures ----------
function sniff(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (/^GIF8[79]a/.test(bytes.toString('latin1', 0, 6))) return { mime: 'image/gif', ext: 'gif' };
  if (bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}
// The bytes of one picture, or null. The note's own server gets the token (and no redirects);
// anywhere else is asked without credentials. Only PNG, JPEG, GIF and WebP are taken, by their bytes.
async function fetchImage(src, { server, token, fetch }) {
  try {
    const data = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(src || '').trim());
    if (data) { const bytes = Buffer.from(data[1], 'base64'); const type = bytes.length <= MAX_IMAGE_BYTES && sniff(bytes); return type ? { bytes, ...type } : null; }
    const url = resolveSrc(src, server); if (!url) return null;
    const own = Boolean(server) && new URL(url).origin === new URL(server).origin;
    const response = await fetch(url, { headers: own && token ? { authorization: `Bearer ${token}` } : {}, redirect: own ? 'error' : 'follow', signal: AbortSignal.timeout(20000) });
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const type = bytes.length <= MAX_IMAGE_BYTES && sniff(bytes);
    return type ? { bytes, ...type } : null;
  } catch { return null; }
}
async function fetchImages(blocks, options) {
  const found = new Map();
  for (const block of Array.isArray(blocks) ? blocks : []) if (block?.type === 'image' && block.src && !found.has(block.src)) found.set(block.src, await fetchImage(block.src, options));
  return found;
}
// A new folder beside the file; an existing folder is never reused or written into.
function makeFolder(filePath, fs) {
  const dir = path.dirname(filePath), base = path.basename(filePath, path.extname(filePath)) || 'note';
  for (let i = 1; i < 1000; i++) {
    const name = `${base}_files${i > 1 ? '-' + i : ''}`;
    try { fs.mkdirSync(path.join(dir, name)); return name; } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  throw new Error('Could not make a new folder for the pictures beside ' + path.basename(filePath));
}
const fileName = title => (String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[\s.-]+|[\s.]+$/g, '').slice(0, 80) || 'Note');

// paper: { title, blocks } as barkpark:get returns it. format: markdown | html | pdf | copy.
// chooseFile({ defaultName, filters }) -> chosen path or null; printPdf(html) -> Buffer; writeClipboard(text).
async function exportNote({ paper, format, server = '', token = '', fetch = globalThis.fetch, chooseFile, printPdf, writeClipboard, fs = require('fs') }) {
  if (!Array.isArray(paper?.blocks)) throw new Error(paper?.html ? 'This paper is stored as HTML. Convert it to blocks before exporting it.' : 'This note has no content to export yet.');
  const blocks = structuredClone(paper.blocks), title = String(paper.title || '').trim();
  if (format === 'copy') {
    const markdown = toMarkdown(blocks, { title, image: b => resolveSrc(b.src, server) });
    await writeClipboard(markdown);
    return { format, copied: true, characters: markdown.length };
  }
  const kind = FORMATS[format];
  if (!kind) throw new Error('Unknown export format: ' + format);
  const filePath = await chooseFile({ defaultName: fileName(title) + '.' + kind.ext, filters: [{ name: kind.name, extensions: [kind.ext] }] });
  if (!filePath) return null;
  const images = await fetchImages(blocks, { server, token, fetch });
  const taken = [...images.values()].filter(Boolean).length, missing = images.size - taken;
  const result = { format, filePath, folder: null, images: taken, missing };
  if (format === 'markdown') {
    const refs = new Map();
    if (taken) {
      result.folder = makeFolder(filePath, fs);
      let n = 0;
      try {
        for (const [src, image] of images) {
          if (!image) continue;
          const name = `image-${++n}.${image.ext}`;
          fs.writeFileSync(path.join(path.dirname(filePath), result.folder, name), image.bytes, { flag: 'wx' });
          refs.set(src, encodeURIComponent(result.folder) + '/' + name);
        }
      } catch (error) { fs.rmSync(path.join(path.dirname(filePath), result.folder), { recursive: true, force: true }); throw error; }
    }
    const markdown = toMarkdown(blocks, { title, image: b => refs.get(b.src) || resolveSrc(b.src, server) });
    try { fs.writeFileSync(filePath, markdown); } catch (error) { if (result.folder) fs.rmSync(path.join(path.dirname(filePath), result.folder), { recursive: true, force: true }); throw error; }
    return result;
  }
  const embedded = b => { const image = images.get(b.src); return image ? `data:${image.mime};base64,${image.bytes.toString('base64')}` : null; };
  if (format === 'html') {
    fs.writeFileSync(filePath, htmlDocument({ title, blocks, image: b => embedded(b) || resolveSrc(b.src, server) }));
    return result;
  }
  const pdf = await printPdf(htmlDocument({ title, blocks, image: embedded, remote: false }));
  fs.writeFileSync(filePath, pdf);
  return result;
}

module.exports = { exportNote, toMarkdown, toHtml, htmlDocument, safeHref, fileName };
