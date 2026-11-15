// Web clipper: a page's HTML (or a selection of it) becomes the markdown of a Paper note.
// The HTML is untrusted. It is parsed by a caller-supplied parser into an inert document (DOMParser in the
// renderer, jsdom in tests): nothing here inserts it into a live DOM, runs its scripts or loads its media.
// Only http(s)/mailto links survive; script, style, handlers and page chrome are dropped by construction,
// because only text and a few allowed attributes (href, src, alt) are ever read.
//
// The output is the strict-portable markdown that shared/portabledoc.js#markdownToBlocks accepts
// (one level of list, one-paragraph quotes, rectangular tables). That parser has no escapes, so text that
// would read as markdown structure is broken with a word joiner (U+2060) instead.
const { markdownToBlocks } = require('./portabledoc');

const MAX_CHARS = 100000;
const MAX_BLOCKS = 2000;
const WJ = '⁠';
const DROP = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'svg', 'math', 'canvas',
  'video', 'audio', 'source', 'track', 'map', 'link', 'meta', 'head', 'base', 'title', 'input', 'select', 'textarea', 'button', 'option', 'datalist',
  'nav', 'aside', 'footer', 'dialog', 'menu']);
const DROP_ROLES = /^(navigation|banner|contentinfo|complementary|search|dialog|alertdialog|menubar|toolbar|menu)$/i;
const JUNK = /(?:^|[\s_-])(cookies?|consent|gdpr|advert\w*|ads?|ad-slot|sponsor(?:ed)?|promo\w*|newsletter|subscribe|signup|share|sharing|social|related|recommended|comments?|sidebar|breadcrumbs?|popup|modal|overlay|paywall|skip-link|banner)(?:$|[\s_-])/i;
const BLOCK = new Set(['address', 'article', 'blockquote', 'details', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'header', 'hgroup', 'hr', 'li', 'main', 'ol', 'p', 'pre', 'section', 'table', 'ul', 'summary', 'center', 'body', 'html', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'caption', 'legend']);
const tag = node => node.nodeType === 1 ? node.localName.toLowerCase() : '';
const collapse = text => String(text || '').replace(/[\s ]+/g, ' ');

function resolver(doc, pageUrl) {
  let base = pageUrl;
  try { const href = doc.querySelector('base[href]')?.getAttribute('href'); if (href) { const b = new URL(href, pageUrl); if (/^https?:$/.test(b.protocol)) base = b.href; } } catch {}
  return (value, mail = true) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    try {
      const url = new URL(raw, base);
      if (!(/^https?:$/.test(url.protocol) || (mail && url.protocol === 'mailto:'))) return null;
      return url.href.replace(/[()\s|<>]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
    } catch { return null; }
  };
}

function hiddenOrChrome(el, insideArticle) {
  const name = tag(el);
  if (DROP.has(name)) return true;
  if (name === 'header' && !insideArticle) return true;
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true' || DROP_ROLES.test(el.getAttribute('role') || '')) return true;
  return /(?:^|;)\s*(display\s*:\s*none|visibility\s*:\s*hidden)/i.test(el.getAttribute('style') || '');
}

// Remove what is never content, before measuring anything (a script's text would otherwise count as words).
function strip(root) {
  const walk = (node, insideArticle) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) { child.remove(); continue; }
      if (child.nodeType !== 1) continue;
      if (hiddenOrChrome(child, insideArticle)) { child.remove(); continue; }
      walk(child, insideArticle || tag(child) === 'article');
    }
  };
  walk(root, false);
}
const textLength = el => collapse(el.textContent).trim().length;
const linkLength = el => [...el.querySelectorAll('a')].reduce((n, a) => n + textLength(a), 0);
const plainLength = el => Math.max(0, textLength(el) - linkLength(el));

// The article: the landmark with the most non-link text, unless a denser container of paragraphs beats it.
function pickRoot(doc) {
  const body = doc.body || doc.documentElement;
  const landmarks = [...body.querySelectorAll('article, main, [role="main"], [itemprop="articleBody"]')];
  let best = null, bestScore = 0;
  for (const el of landmarks) { const s = plainLength(el); if (s > bestScore) { best = el; bestScore = s; } }
  const scores = new Map();
  for (const p of body.querySelectorAll('p, pre, blockquote')) {
    const n = plainLength(p);
    if (n < 25) continue;
    const parent = p.parentElement, grand = parent?.parentElement;
    if (parent) scores.set(parent, (scores.get(parent) || 0) + n);
    if (grand) scores.set(grand, (scores.get(grand) || 0) + n / 2);
  }
  let dense = null, denseScore = 0;
  for (const [el, s] of scores) { const total = textLength(el) || 1, score = s * (1 - linkLength(el) / total); if (score > denseScore) { dense = el; denseScore = score; } }
  if (best && (bestScore >= denseScore * 0.5 || best.contains(dense))) return best;
  return dense || best || body;
}

function dropJunk(root) {
  const total = textLength(root) || 1;
  for (const el of [...root.querySelectorAll('[class], [id]')]) {
    if (!el.isConnected || !root.contains(el)) continue;
    const names = `${el.getAttribute('class') || ''} ${el.getAttribute('id') || ''}`;
    if (JUNK.test(names) && textLength(el) < total / 3) el.remove();
  }
}

// A line the markdown parser would read as structure gets a word joiner in front; a markdown link written
// as page text is broken so it cannot become a link (to javascript:, say).
function guardLine(line) {
  const text = line.replace(/^[\s ]+/, '');
  return (/^(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|\|)/.test(text) || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(text) ? WJ : '') + text;
}
// Every ] in page text is followed by a word joiner: a markdown link needs "](" side by side, and the pieces
// may come from separate nodes (a span, a comment, an anchor without href, a code span) joined later.
const guardText = text => text.replace(/\]/g, ']' + WJ);
const wrap = (inner, mark, forbidden) => {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(inner);
  if (!m[2] || m[2].includes(forbidden) || m[2].includes('\n')) return inner;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
};

function converter(resolve) {
  const imageUrl = img => {
    const w = Number(img.getAttribute('width')), h = Number(img.getAttribute('height'));
    if ((w && w <= 2) || (h && h <= 2)) return null; // tracking pixels
    const srcset = (img.getAttribute('srcset') || '').split(',')[0].trim().split(/\s+/)[0];
    return resolve(img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || srcset, false);
  };
  const label = text => collapse(text).replace(/[[\]*_`~]/g, '').trim();
  const image = img => { const src = imageUrl(img); if (!src) return ''; const alt = label(img.getAttribute('alt')); return `[Image${alt ? ': ' + alt : ''}](${src})`; };

  // Inline markdown for a node's content. Hard breaks are '  \n'.
  function inline(node) {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) { out += guardText(collapse(child.nodeValue)); continue; }
      if (child.nodeType !== 1) continue;
      const name = tag(child);
      if (name === 'br') { out += '  \n'; continue; }
      if (name === 'img') { out += image(child); continue; }
      if (name === 'a') {
        const href = resolve(child.getAttribute('href'));
        const text = label(child.textContent) || [...child.querySelectorAll('img')].map(i => label(i.getAttribute('alt'))).find(Boolean) || '';
        if (href && text) out += `[${text}](${href})`;
        else if (text) out += guardText(collapse(child.textContent));
        else { const img = child.querySelector('img'); if (img) out += image(img); }
        continue;
      }
      if (name === 'code' || name === 'kbd' || name === 'samp' || name === 'tt') { const text = guardText(collapse(child.textContent)); out += text.includes('`') ? text : wrap(text, '`', '`'); continue; }
      const inner = inline(child);
      if (name === 'strong' || name === 'b') out += wrap(inner, '**', '*');
      else if (name === 'em' || name === 'i' || name === 'cite') out += wrap(inner, '*', '*');
      else if (name === 'del' || name === 's' || name === 'strike') out += wrap(inner, '~~', '~');
      else if (BLOCK.has(name)) out += ' ' + inline(child) + ' ';
      else out += inner;
    }
    return out;
  }
  const lines = md => md.split('\n').map(l => l.replace(/[ \t]+$/g, m => (m.length >= 2 ? '  ' : ''))).map(guardLine).map(l => l.replace(/ {3,}/g, ' ')).filter(l => l.replace(WJ, '').trim());
  const oneLine = md => guardLine(md.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim());
  const paragraph = md => { const ls = lines(md.trim()).map((l, i, all) => i < all.length - 1 ? l.replace(/\s*$/, '  ') : l.trimEnd()); return ls.length ? ls.join('\n') : ''; };

  function table(el) {
    if (el.querySelector('table') || el.querySelector('[colspan]:not([colspan="1"]), [rowspan]:not([rowspan="1"])')) return null;
    const rows = [...el.querySelectorAll('tr')].filter(tr => tr.closest('table') === el).map(tr => [...tr.children].filter(c => ['td', 'th'].includes(tag(c))));
    const width = Math.max(0, ...rows.map(r => r.length));
    if (!rows.length || width < 2 || width > 30) return null;
    const cell = c => oneLine(inline(c)).replace(new RegExp('^' + WJ), '').replace(/\|/g, '\\|') || ' ';
    const text = rows.map(r => { const cells = r.map(cell); while (cells.length < width) cells.push(' '); return `| ${cells.join(' | ')} |`.replace(/ {2,}\|/g, ' |'); });
    return [text[0], `| ${Array(width).fill('---').join(' | ')} |`, ...text.slice(1)].join('\n');
  }

  // Block markdown: a list of block strings, in order.
  function blocks(root) {
    const out = [];
    let run = null; // the open inline run (text directly inside a container)
    const flush = () => { if (run !== null) { const p = paragraph(run); if (p) out.push(p); run = null; } };
    const list = (el, items) => {
      let n = Number.parseInt(el.getAttribute('start'), 10) || 1;
      const ordered = tag(el) === 'ol';
      for (const li of el.children) {
        if (tag(li) !== 'li') { if (['ul', 'ol'].includes(tag(li))) list(li, items); continue; }
        const nested = [...li.children].filter(c => ['ul', 'ol'].includes(tag(c)));
        const clone = li.cloneNode(true);
        for (const c of [...clone.children]) if (['ul', 'ol'].includes(tag(c))) c.remove();
        const text = oneLine(inline(clone));
        if (text.replace(WJ, '')) items.push(`${ordered ? (n++) + '.' : '-'} ${text.replace(new RegExp('^' + WJ), '')}`);
        for (const sub of nested) list(sub, items);
      }
      return items;
    };
    let lastLi = false; // sibling <li> elements without their list (a selection of items) read as one list
    for (const child of root.childNodes) {
      if (child.nodeType === 1 && tag(child) !== 'li' && (BLOCK.has(tag(child)) || collapse(child.textContent).trim())) lastLi = false;
      if (child.nodeType === 3 && collapse(child.nodeValue).trim()) lastLi = false;
      if (child.nodeType === 3) { run = (run || '') + guardText(collapse(child.nodeValue)); continue; }
      if (child.nodeType !== 1) continue;
      const name = tag(child);
      if (!BLOCK.has(name) || name === 'td' || name === 'th') {
        if (name === 'img' && run === null) { const img = image(child); if (img) out.push(img); continue; }
        run = (run || '') + inline({ childNodes: [child] });
        continue;
      }
      flush();
      if (/^h[1-6]$/.test(name)) { const text = oneLine(inline(child)); if (text.replace(WJ, '')) out.push(`${Number(name[1]) <= 2 ? '##' : '###'} ${text.replace(new RegExp('^' + WJ), '')}`); }
      else if (name === 'p' || name === 'summary' || name === 'dt' || name === 'caption' || name === 'figcaption' || name === 'legend') { const p = paragraph(inline(child)); if (p) out.push(p); }
      else if (name === 'ul' || name === 'ol') { const items = list(child, []); if (items.length) out.push(items.join('\n')); }
      else if (name === 'li') { const items = list({ children: [child], getAttribute: () => null, localName: 'ul', nodeType: 1 }, []); if (items.length) { if (lastLi) out[out.length - 1] += '\n' + items.join('\n'); else out.push(items.join('\n')); lastLi = true; } }
      else if (name === 'blockquote') { const text = oneLine(inline(child)); if (text.replace(WJ, '')) out.push('> ' + text); } // keeps a leading word joiner: "> 1. …" must stay a quote
      else if (name === 'pre') {
        const code = String(child.textContent || '').replace(/\r\n?/g, '\n').replace(/^\n+|\s+$/g, '');
        const lang = /(?:^|\s)(?:language|lang)-([\w+#-]{1,30})/.exec(`${child.getAttribute('class') || ''} ${child.querySelector('code')?.getAttribute('class') || ''}`)?.[1] || '';
        if (code.trim()) out.push('```' + lang + '\n' + code.split('\n').map(l => /^```/.test(l) ? ' ' + l : l).join('\n') + '\n```');
      }
      else if (name === 'hr') out.push('---');
      else if (name === 'table') { const t = table(child); if (t) out.push(t); else out.push(...blocks(child)); }
      else out.push(...blocks(child));
    }
    flush();
    return out;
  }
  return { blocks };
}

// The last word on links: whatever the guards above missed, a note never carries a link that is not http(s)/mailto.
function unsafeLink(node) {
  if (Array.isArray(node)) return node.some(unsafeLink);
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'link' && !/^(https?:|mailto:)/i.test(String(node.href || ''))) return true;
  return Object.values(node).some(value => value && typeof value === 'object' && unsafeLink(value));
}

function dateOf(now) { const d = now instanceof Date ? now : new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function titleOf(doc, url) {
  const meta = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const title = collapse(doc.title || meta || doc.querySelector('h1')?.textContent || '').trim();
  if (title) return title.slice(0, 200);
  try { return new URL(url).hostname || 'Clipped page'; } catch { return 'Clipped page'; }
}

function sourceLine(url, now, resolve) {
  const href = resolve(url, false);
  if (!href) return `Source: ${dateOf(now)}`;
  let shown = href.replace(/^https?:\/\//, '').replace(/\/$/, '');
  try { shown = decodeURI(shown); } catch {}
  shown = shown.replace(/[[\]*_`~]/g, '');
  if (shown.length > 80) shown = shown.slice(0, 79) + '…';
  return `Source: [${shown}](${href}) · ${dateOf(now)}`;
}

/**
 * Clip a page, or the selection within it, to a note.
 * @param {{ html: string, url: string, selectionHtml?: string, now?: Date, parse: (html: string) => Document, maxChars?: number }} input
 * @returns {{ title: string, markdown: string, truncated: boolean }}
 */
function clipPage({ html, url, selectionHtml = null, now = new Date(), parse, maxChars = MAX_CHARS }) {
  if (typeof parse !== 'function') throw new TypeError('clipPage needs an HTML parser');
  const doc = parse(String(html || ''));
  const title = titleOf(doc, url), resolve = resolver(doc, url);
  let root;
  if (typeof selectionHtml === 'string') {
    const fragment = parse(`<!doctype html><html><body>${selectionHtml}</body></html>`);
    root = fragment.body; strip(root);
  } else {
    strip(doc.body || doc.documentElement); root = pickRoot(doc); dropJunk(root);
  }
  let parts = converter(resolve).blocks(root);
  // The article's own title heading is already the note's title.
  const first = parts.findIndex(p => !p.startsWith('[Image'));
  if (first >= 0 && /^#{2,3} /.test(parts[first]) && collapse(parts[first].replace(/^#+ /, '')).trim().toLowerCase() === title.toLowerCase()) parts.splice(first, 1);
  const kept = []; let size = 0, truncated = false;
  for (const part of parts) {
    if (size + part.length + 2 > maxChars || kept.length >= MAX_BLOCKS) { truncated = true; break; }
    kept.push(part); size += part.length + 2;
  }
  if (truncated) kept.push(`*Clipped: this note keeps the first part of the page (${kept.length} blocks, about ${Math.round(size / 1000)}k characters). The rest is at the source link above.*`);
  if (!kept.length) kept.push(typeof selectionHtml === 'string' ? '*The selection had no text to keep.*' : '*The page had no readable text to keep.*');
  let markdown = [sourceLine(url, now, resolve), ...kept].join('\n\n') + '\n';
  try { if (unsafeLink(markdownToBlocks(markdown))) throw new Error('unsafe link'); }
  catch {
    // Never lose the clip to a converter limit: keep the words as plain paragraphs.
    const text = kept.flatMap(part => part.split('\n')).map(l => guardLine(guardText(collapse(l.replace(/^(#+|>|-|\d+\.|```\w*)\s?/, '')).trim()))).filter(l => l.replace(WJ, ''));
    markdown = [sourceLine(url, now, resolve), ...text].join('\n\n').slice(0, maxChars) + '\n';
    let blocks = null; try { blocks = markdownToBlocks(markdown); } catch {}
    if (!blocks || unsafeLink(blocks)) markdown = [sourceLine(url, now, resolve), ...text.map(l => l.replace(/\(/g, '(' + WJ))].join('\n\n').slice(0, maxChars) + '\n';
  }
  return { title, markdown, truncated };
}

module.exports = { clipPage, MAX_CHARS };
