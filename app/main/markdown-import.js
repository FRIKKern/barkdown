// Markdown files and folders (an Obsidian vault, a Notion "Markdown & CSV" export) become Paper notes.
// planImport walks the selection once and orders the notes parents-first; readNote parses one file
// when it is imported; noteBlocks turns it into Paper blocks with uploaded images and resolved links.
// Everything here reads the disk and nothing else, so a test drives it with a temporary folder.
const fs = require('node:fs');
const path = require('node:path');
const { markdownToDoc, docToText } = require('../shared/markdown');
const { pmDocToBlocks } = require('../shared/portabledoc');

const LIMITS = Object.freeze({ fileBytes: 4 * 1024 * 1024, imageBytes: 20 * 1024 * 1024, notes: 2000, entries: 50000, depth: 12 });
const MARKDOWN = /\.(md|markdown)$/i;
const IMAGE_TYPES = Object.freeze({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' });
const SKIPPED_FOLDERS = new Set(['node_modules', '__MACOSX']);
const NOTION_ID = /\s+[0-9a-f]{32}$/i;
// ![alt](src "title") with an optional <bracketed src>, and Obsidian's ![[file.png|300]].
const IMAGE_TOKEN = /!\[([^\]\n]*)\]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'))?\s*\)|!\[\[([^\]\n]+)\]\]/g;
const WIKI_LINK = /(?<!!)\[\[([^\]\n]+)\]\]/g;
const FENCE = /^\s{0,3}(```|~~~)/;

const stem = name => name.replace(/\.[^.]+$/, '');
const plainName = name => stem(name).replace(NOTION_ID, '').trim() || stem(name).trim();
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
const within = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!!rel && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
const plainTitle = text => String(text).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t, a) => a || t).replace(/\*\*|__|`|~~/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 300);

// Text, not bytes: UTF-8 when it is valid, otherwise Windows-1252 (every byte maps), never a binary file.
function decode(bytes) {
  if (bytes.subarray(0, 8192).includes(0)) return null;
  const body = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(body), encoding: 'utf-8' }; }
  catch { try { return { text: new TextDecoder('windows-1252').decode(body), encoding: 'windows-1252' }; } catch { return { text: body.toString('latin1'), encoding: 'latin1' }; } }
}

// YAML front matter is metadata: only a plain `title:` is read, and none of it reaches the body.
function splitFrontMatter(text) {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (!match) return { title: null, body: text };
  const line = /^title:[ \t]*(.+?)[ \t]*$/m.exec(match[1]);
  let title = line ? line[1] : null;
  if (title && /^(["']).*\1$/.test(title)) title = title.slice(1, -1);
  return { title: title ? plainTitle(title) || null : null, body: text.slice(match[0].length) };
}

// Title: front matter, else the first H1 (then removed from the body), else the file name without
// Notion's id. A body that opens with the same H1 as the title drops it (the duplicate-title trap, #127).
function titleAndBody(text, fileName) {
  const front = splitFrontMatter(text.replace(/\r\n?/g, '\n'));
  const lines = front.body.split('\n');
  let fenced = false, firstContent = -1, firstH1 = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { fenced = !fenced; if (firstContent < 0) firstContent = i; continue; }
    if (fenced || !lines[i].trim()) continue;
    if (firstContent < 0) firstContent = i;
    if (/^#\s+\S/.test(lines[i])) { firstH1 = i; break; }
  }
  const h1 = firstH1 >= 0 ? plainTitle(lines[firstH1].replace(/^#\s+/, '').replace(/\s+#+\s*$/, '')) : null;
  let title = front.title, drop = -1;
  if (title) { if (firstH1 >= 0 && firstH1 === firstContent && h1.toLowerCase() === title.toLowerCase()) drop = firstH1; }
  else if (h1) { title = h1; drop = firstH1; }
  if (drop >= 0) lines.splice(drop, 1);
  return { title: title || plainName(fileName) || 'Untitled', body: lines.join('\n').replace(/^\n+/, '') };
}

function titleOf(file) {
  const bytes = fs.readFileSync(file);
  const decoded = decode(bytes);
  return decoded ? titleAndBody(decoded.text, path.basename(file)).title : null;
}

// One walk of the selection. Folders become parent notes; a Notion "Page.md" beside "Page/" is that
// folder's parent instead. Hidden entries, node_modules, links, large and binary files are skipped.
function planImport(selection, limits = LIMITS) {
  if (!Array.isArray(selection) || !selection.length || selection.some(p => typeof p !== 'string' || !path.isAbsolute(p))) throw new TypeError('Choose Markdown files or a folder to import.');
  const notes = [], skipped = [], images = [];
  let entries = 0, ignored = 0;
  const skip = (file, reason) => skipped.push({ path: file, reason });
  const addFile = (file, root, parentKey, display) => {
    let stat, title;
    try { stat = fs.statSync(file); } catch { return skip(display, 'unreadable'); }
    if (stat.size > limits.fileBytes) return skip(display, 'larger than ' + Math.round(limits.fileBytes / 1048576) + ' MB');
    if (notes.length >= limits.notes) return skip(display, 'more than ' + limits.notes + ' notes in one import');
    try { title = titleOf(file); } catch { return skip(display, 'unreadable'); }
    if (title == null) return skip(display, 'not a text file');
    const note = { key: 'file:' + file, kind: 'file', file, root, parentKey, title, relPath: display };
    notes.push(note); return note;
  };
  const walk = (dir, root, parentKey, display, depth) => {
    let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }).sort(byName); } catch (error) { skip(display, 'unreadable folder'); return; }
    const folders = new Map(list.filter(e => e.isDirectory()).map(e => [e.name, e]));
    const paired = new Set();
    for (const entry of list) {
      if (++entries > limits.entries) { skip(display, 'too many files'); return; }
      const full = path.join(dir, entry.name), shown = display + '/' + entry.name;
      if (entry.name.startsWith('.')) { ignored++; continue; }
      if (entry.isSymbolicLink()) { skip(shown, 'a link, not followed'); continue; }
      if (entry.isFile()) {
        if (!MARKDOWN.test(entry.name)) { if (IMAGE_TYPES[path.extname(entry.name).toLowerCase()]) images.push(full); else ignored++; continue; }
        const note = addFile(full, root, parentKey, shown);
        const pair = folders.get(stem(entry.name));
        if (note && pair && !SKIPPED_FOLDERS.has(pair.name)) { paired.add(pair.name); folder(path.join(dir, pair.name), root, note.key, display + '/' + pair.name, depth + 1, false); }
      }
    }
    for (const entry of list) if (entry.isDirectory() && !entry.name.startsWith('.') && !paired.has(entry.name)) {
      if (SKIPPED_FOLDERS.has(entry.name)) { skip(display + '/' + entry.name, 'skipped folder'); continue; }
      folder(path.join(dir, entry.name), root, parentKey, display + '/' + entry.name, depth + 1, true);
    }
  };
  // A folder note is created only when something inside it is imported.
  const folder = (dir, root, parentKey, display, depth, ownNote) => {
    if (depth > limits.depth) return skip(display, 'nested too deeply');
    if (!ownNote) return walk(dir, root, parentKey, display, depth);
    const note = { key: 'dir:' + dir, kind: 'folder', dir, root, parentKey, title: plainName(path.basename(dir) + '.x') || 'Folder', relPath: display };
    const at = notes.length;
    notes.push(note);
    walk(dir, root, note.key, display, depth);
    if (notes.length === at + 1) notes.splice(at, 1);
  };
  for (const chosen of [...new Set(selection.map(p => path.resolve(p)))].sort()) {
    let stat;
    try { stat = fs.lstatSync(chosen); } catch { skip(path.basename(chosen), 'not found'); continue; }
    if (stat.isSymbolicLink()) { skip(path.basename(chosen), 'a link, not followed'); continue; }
    if (stat.isDirectory()) folder(chosen, fs.realpathSync(chosen), null, path.basename(chosen), 0, true);
    else if (stat.isFile() && MARKDOWN.test(chosen)) addFile(chosen, fs.realpathSync(path.dirname(chosen)), null, path.basename(chosen));
    else skip(path.basename(chosen), 'not a Markdown file');
  }
  return { selection: [...new Set(selection.map(p => path.resolve(p)))].sort(), notes, skipped, ignored, images };
}

// Resolve an image reference against the note's folder (Obsidian also searches the whole selection
// by name). The real path must stay inside the chosen folder: ../../etc and links out are refused.
function resolveImage(reference, note, plan) {
  let ref = reference.trim();
  if (/^<.*>$/.test(ref)) ref = ref.slice(1, -1);
  if (/^https?:\/\//i.test(ref)) return { remote: ref };
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return { reason: 'not a file in the folder' };
  try { ref = decodeURIComponent(ref); } catch {}
  ref = ref.split(/[?#]/)[0];
  if (!IMAGE_TYPES[path.extname(ref).toLowerCase()]) return { reason: 'not an image' };
  let base;
  try { base = fs.realpathSync(note.kind === 'file' ? path.dirname(note.file) : note.dir); } catch { return { reason: 'missing' }; }
  const candidates = [path.resolve(base, ref), path.resolve(note.root, ref)];
  if (!within(note.root, candidates[0])) return { reason: 'outside the chosen folder' };
  if (!ref.includes('/') && !ref.includes('\\')) candidates.push(...(plan.images || []).filter(file => path.basename(file) === ref));
  let refused = false;
  for (const candidate of candidates) {
    let real;
    try { real = fs.realpathSync(candidate); } catch { continue; }
    if (!within(note.root, real)) { refused = true; continue; }
    const stat = fs.statSync(real);
    if (!stat.isFile()) continue;
    if (stat.size > LIMITS.imageBytes) return { reason: 'image larger than 20 MB' };
    return { file: real, mime: IMAGE_TYPES[path.extname(real).toLowerCase()] };
  }
  return { reason: refused ? 'outside the chosen folder' : 'missing' };
}

// The body of one note with its images resolved. Folder notes have no body.
function readNote(note, plan) {
  if (note.kind === 'folder') return { title: note.title, body: '', images: [], encoding: null };
  const decoded = decode(fs.readFileSync(note.file));
  if (!decoded) throw new Error(note.relPath + ' is not a text file.');
  const { title, body } = titleAndBody(decoded.text, path.basename(note.file));
  const images = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (FENCE.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    for (const m of line.matchAll(IMAGE_TOKEN)) {
      const ref = m[3] ? m[3].split('|')[0] : m[2];
      images.push({ token: m[0], alt: m[3] ? '' : m[1].trim(), ref, ...resolveImage(ref, note, plan) });
    }
  }
  return { title, body, images, encoding: decoded.encoding };
}

// Wiki links and links to other imported .md files point at the imported note, matched by title,
// file name or path; links to notes outside this import stay text.
function linkIndex(plan) {
  const index = new Map();
  const put = (name, note) => { const key = name.toLowerCase().trim(); if (key && !index.has(key)) index.set(key, note); };
  for (const note of plan.notes) { put(note.title, note); if (note.kind === 'file') { put(stem(path.basename(note.file)), note); put(plainName(path.basename(note.file)), note); put('path:' + note.file, note); } }
  return index;
}
function wikiTarget(raw, index) {
  const [target, alias] = raw.split('|');
  const name = target.split('#')[0].split('^')[0].split('/').pop().replace(MARKDOWN, '').trim();
  return { note: index.get(name.toLowerCase()) || null, label: (alias || target.split('#')[0] || target).trim() };
}

const textInline = value => ({ type: 'text', value });
function mapLinks(value, links, note, index, docId) {
  if (Array.isArray(value)) return value.map(item => mapLinks(item, links, note, index, docId));
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'link' && typeof value.href === 'string') {
    const label = value.children;
    let target = null;
    const placeholder = /^bdimport:(\d+)$/.exec(value.href);
    if (placeholder) target = links[Number(placeholder[1])];
    else if (note.kind === 'file' && !/^[a-z][a-z0-9+.-]*:/i.test(value.href) && MARKDOWN.test(value.href.split('#')[0])) {
      let rel = value.href.split('#')[0]; try { rel = decodeURIComponent(rel); } catch {}
      target = { note: index.get('path:' + path.resolve(path.dirname(note.file), rel).toLowerCase()) || null };
    }
    if (placeholder && !target?.note) return { type: 'text', value: target?.label || '' };
    if (target?.note) return { type: 'wikilink', target: target.note.title, docId: docId(target.note), children: label };
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapLinks(v, links, note, index, docId)]));
}

// Paper blocks for one Markdown chunk. Each top-level node converts on its own; one the Paper
// converter cannot hold (a nested quote, say) keeps its text as a plain paragraph instead of failing.
function chunkBlocks(markdown, note, index, docId) {
  const links = [];
  const replaced = markdown.replace(WIKI_LINK, (_, raw) => {
    const link = wikiTarget(raw, index);
    links.push(link);
    return `[${link.label.replace(/[[\]]/g, '') || 'link'}](bdimport:${links.length - 1})`;
  });
  const doc = markdownToDoc(replaced);
  const blocks = [];
  for (const node of doc.content || []) {
    if (node.type === 'paragraph' && !node.content?.length) continue;
    try { blocks.push(...pmDocToBlocks({ type: 'doc', content: [node] })); }
    catch {
      const text = docToText({ type: 'doc', content: [node] }).replace(/\[([^\]]*)\]\(bdimport:\d+\)/g, '$1');
      if (text) blocks.push({ type: node.type === 'blockquote' ? 'blockquote' : 'paragraph', content: [textInline(text)] });
    }
  }
  return mapLinks(blocks, links, note, index, docId);
}

// The note's Paper blocks: the locked title, then the body with each image as its own block.
// `media` maps an image file to its uploaded src (or { error }); an image without one stays text.
function noteBlocks(parsed, note, plan, { media = {}, docId }) {
  const index = plan.index || (plan.index = linkIndex(plan));
  const body = [];
  let buffer = [], fenced = false, missing = 0;
  const flush = () => { const text = buffer.join('\n'); buffer = []; if (text.trim()) body.push(...chunkBlocks(text, note, index, docId)); };
  const imagesByToken = new Map(parsed.images.map(image => [image.token, image]));
  for (const line of parsed.body.split('\n')) {
    if (FENCE.test(line)) { fenced = !fenced; buffer.push(line); continue; }
    if (fenced || !line.includes('![')) { buffer.push(line); continue; }
    // Only an uploaded picture splits the line into its own block; other references stay inline.
    let text = '', last = 0;
    const keep = () => { if (text.trim() && !/^\s*([-*+]|\d+[.)]|>)?\s*$/.test(text)) buffer.push(text.trimEnd()); text = ''; };
    for (const m of line.matchAll(IMAGE_TOKEN)) {
      text += line.slice(last, m.index);
      last = m.index + m[0].length;
      const image = imagesByToken.get(m[0]);
      const src = image?.file && typeof media[image.file] === 'string' ? media[image.file] : null;
      if (src) { keep(); flush(); body.push({ type: 'image', src, ...(image.alt ? { alt: image.alt } : {}) }); continue; }
      if (image?.remote) { text += `[${image.alt || image.remote}](${image.remote})`; continue; }
      missing++;
      text += `[missing image: ${image?.ref || m[0]}]`;
    }
    text += line.slice(last);
    if (text.trim()) buffer.push(last && !/^\s*([-*+]|\d+[.)]|>)\s/.test(text) ? text.trimStart() : text);
  }
  flush();
  const blocks = [{ id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text: parsed.title },
    ...body.map((block, i) => ({ ...block, id: `import-${i}` }))];
  return { blocks, missing };
}

module.exports = { LIMITS, IMAGE_TYPES, planImport, readNote, noteBlocks, titleAndBody, decode, resolveImage };
