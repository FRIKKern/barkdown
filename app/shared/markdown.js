// Markdown <-> ProseMirror (Tiptap) JSON. Small, dependency-free, and good enough for
// headings, paragraphs, lists, task lists, quotes, code fences, links, emphasis and code.
// Used by the agent (main process) and the document tab (renderer).
const { allowedUrl } = require('./safe-url');

// A code fence, as markdownToDoc reads one: ``` at the start of the line. `~~~` and an indented ``` are prose here.
// Anything that must agree with the converter on what is code (the Markdown importer) uses this test.
const isFenceLine = line => /^```/.test(line);
const QUOTE = /^>\s?/;
// Which lines of a text markdownToDoc keeps as code (a fence line or a line between fences), the way it reads
// them: a fence toggles code, and a run of quoted lines is read again without its "> ", with its own fences.
// The importer leaves exactly these lines as written. tests/markdown-import.test.mjs checks this against the converter.
function codeLines(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n'), code = new Array(lines.length).fill(false);
  let fenced = false;
  for (let i = 0; i < lines.length;) {
    if (fenced || isFenceLine(lines[i])) { code[i] = true; if (isFenceLine(lines[i])) fenced = !fenced; i++; continue; }
    if (QUOTE.test(lines[i])) {
      const start = i;
      while (i < lines.length && QUOTE.test(lines[i])) i++;
      codeLines(lines.slice(start, i).map(line => line.replace(QUOTE, '')).join('\n')).forEach((inner, k) => { code[start + k] = inner; });
      continue;
    }
    i++;
  }
  return code;
}

// The inline syntax parseInline reads, left to right, the first alternative winning: bold, code, link or picture
// link, italic, strike. `[2]|[3]` bold, `[4]` code, `[5..7]` link, `[8]|[9]` italic, `[10]` strike. A URL may hold
// balanced parentheses two deep, as in f(1) or a((b)). Bold is tried before code, so in **x`y** `z` the first
// backtick is inside bold and `z` is the code span.
const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|(!?)\[([^\]]+)\]\(((?:[^()\s]|\((?:[^()\s]|\([^()\s]*\))*\))+)\)|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~]+)~~)/g;
const inlineTokens = text => [...String(text).matchAll(INLINE)];
// Where the inline code spans of a text start and end, as parseInline reads them: [start, end) with the backticks.
// Anything that must agree with the converter on what is inline code (the Markdown importer) uses this.
const codeSpans = text => inlineTokens(text).filter(m => m[4]).map(m => [m.index, m.index + m[0].length]);
// The inline text of one prose line as markdownToDoc hands it to parseInline: after quote marks, a heading's #s or a
// list or task marker, and a table row cell by cell. [offset, text] parts.
const BLOCK_MARK = /^(?:#{1,6}\s+|\s*[-*+]\s+\[[ xX]\]\s+|\s*(?:[-*+]|\d+[.)])\s+)/;
function inlineParts(line) {
  const quote = QUOTE.exec(line);
  if (quote) return inlineParts(line.slice(quote[0].length)).map(([at, text]) => [at + quote[0].length, text]);
  if (isTableRow(line)) {
    const parts = [];
    for (const cell of line.matchAll(/(?<=^\s*\||(?<!\\)\|)((?:\\\||[^|])*)(?=\|)/g)) parts.push([cell.index, cell[1]]);
    return parts;
  }
  const mark = BLOCK_MARK.exec(line)?.[0].length || 0;
  return [[mark, line.slice(mark)]];
}
// The inline code spans of one prose line, [start, end) in the line, as the converter reads them.
const lineCodeSpans = line => inlineParts(line).flatMap(([at, text]) => codeSpans(text).map(([start, end]) => [at + start, at + end]));

// A link or picture link becomes one only when the reader allows its URL (shared/safe-url.js); any other keeps its
// text only (a picture its alt text). `legacy` keeps a legacy note's barkdown://doc/<id> links too (see markdownToDoc).
function parseInline(text, legacy = false) {
  const nodes = [];
  let last = 0;
  for (const match of inlineTokens(text)) {
    if (match.index > last) nodes.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[2] || match[3]) nodes.push({ type: 'text', text: match[2] || match[3], marks: [{ type: 'bold' }] });
    else if (match[4]) nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] });
    else if (match[6]) {
      const href = allowedUrl(match[7], { legacyNoteLinks: legacy });
      if (!href) nodes.push({ type: 'text', text: match[6] });
      else { if (match[5]) nodes.push({ type: 'text', text: '!' }); nodes.push({ type: 'text', text: match[6], marks: [{ type: 'link', attrs: { href, target: '_blank' } }] }); }
    }
    else if (match[8] || match[9]) nodes.push({ type: 'text', text: match[8] || match[9], marks: [{ type: 'italic' }] });
    else if (match[10]) nodes.push({ type: 'text', text: match[10], marks: [{ type: 'strike' }] });
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  // Text a refused link left behind joins the plain text around it.
  const out = [];
  for (const node of nodes.filter(n => n.text.length)) {
    const prev = out.at(-1);
    if (prev && !prev.marks && !node.marks) prev.text += node.text; else out.push(node);
  }
  return out;
}

// GFM tables: a header row, a separator row of dashes, then body rows. Cells may escape a pipe as \|.
function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
function isTableSeparator(line) { return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-'); }
function splitCells(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
  return cells;
}

function paragraph(text, legacy = false) {
  const content = parseInline(text, legacy);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

// Lists, with nesting by indentation. Returns the list node and the index after it.
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
function parseList(lines, start, legacy = false) {
  const first = LIST_ITEM.exec(lines[start]);
  const indent = first[1].length, ordered = /\d/.test(first[2]);
  const node = ordered ? { type: 'orderedList', attrs: { start: parseInt(first[2], 10) || 1 }, content: [] } : { type: 'bulletList', content: [] };
  let i = start;
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (!m || m[1].length < indent) break;
    if (m[1].length > indent) { const child = parseList(lines, i, legacy); const last = node.content.at(-1); if (last) last.content.push(child.node); else node.content.push({ type: 'listItem', content: [child.node] }); i = child.next; continue; }
    if (/\d/.test(m[2]) !== ordered) break; // the other kind at the same indent starts a new list
    node.content.push({ type: 'listItem', content: [paragraph(m[3], legacy)] });
    i++;
    // Continuation lines: indented text under an item that is not itself an item joins the item's paragraph.
    while (i < lines.length && lines[i].trim() && !LIST_ITEM.test(lines[i]) && /^\s{2,}/.test(lines[i]) && lines[i].search(/\S/) > indent) { const p = node.content.at(-1).content[0]; p.content.push(...parseInline(' ' + lines[i].trim(), legacy)); i++; }
  }
  return { node, next: i };
}
// Paper content (strictPortable, or paperLinks for a caller that converts block by block) keeps only the links the
// reader allows. Without either this is the legacy ProseMirror path, which also keeps barkdown://doc/<id> links.
function markdownToDoc(markdown, options = {}) {
  const legacy = !options.strictPortable && !options.paperLinks;
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  if (options.strictPortable) {
    let fenced = false;
    for (const line of lines) {
      if (isFenceLine(line)) { fenced = !fenced; continue; }
      if (!fenced && /^\s+(?:[-*+]|\d+[.)])\s/.test(line)) throw new Error('Cannot convert indented or nested Markdown lists; use structured Paper editing.');
    }
  }
  const content = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) { content.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2].trim(), legacy) }); i++; continue; }
    if (isFenceLine(line)) {
      const language = line.slice(3).trim() || null;
      const code = [];
      i++;
      while (i < lines.length && !isFenceLine(lines[i])) { code.push(lines[i]); i++; }
      i++;
      content.push({ type: 'codeBlock', attrs: { language }, content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { content.push({ type: 'horizontalRule' }); i++; continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const alignments = splitCells(lines[i + 1]).map(value => value.endsWith(':') ? (value.startsWith(':') ? 'center' : 'right') : null);
      if (options.strictPortable && alignments.length !== splitCells(line).length) throw new Error('Cannot convert table with mismatched separator columns.');
      const cell = (text, type, column) => ({ type, ...(options.strictPortable && alignments[column] ? { attrs: { align: alignments[column] } } : {}), content: [paragraph(text, legacy)] });
      const rows = [{ type: 'tableRow', content: splitCells(line).map((c, column) => cell(c, 'tableHeader', column)) }];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push({ type: 'tableRow', content: splitCells(lines[i]).map((c, column) => cell(c, 'tableCell', column)) }); i++; }
      content.push({ type: 'table', content: rows });
      continue;
    }
    if (QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE.test(lines[i])) { quoted.push(lines[i].replace(QUOTE, '')); i++; }
      content.push({ type: 'blockquote', content: markdownToDoc(quoted.join('\n'), options).content });
      continue;
    }
    if (/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+\[( |x|X)\]\s+/.test(lines[i])) {
        const m = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(lines[i]);
        items.push({ type: 'taskItem', attrs: { checked: m[1] !== ' ' }, content: [paragraph(m[2], legacy)] });
        i++;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      // A list: items at one indent, deeper lines become a child list of the item above (indentation of
      // two or more spaces relative to the parent), an ordered list keeps its first number as `start`.
      const { node, next } = parseList(lines, i, legacy);
      content.push(node); i = next;
      continue;
    }
    const buffer = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i]) && !(isTableRow(lines[i]) && isTableSeparator(lines[i + 1] || ''))) { buffer.push(lines[i]); i++; }
    const inline = [];
    for (let lineIndex = 0; lineIndex < buffer.length; lineIndex++) {
      if (lineIndex) inline.push(/(?: {2,}|\\)$/.test(buffer[lineIndex - 1]) ? { type: 'hardBreak' } : { type: 'text', text: ' ' });
      const value = lineIndex < buffer.length - 1 ? buffer[lineIndex].replace(/(?: {2,}|\\)$/, '') : buffer[lineIndex];
      inline.push(...parseInline(value, legacy));
    }
    content.push(inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' });
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

function inlineToMarkdown(nodes) {
  return (nodes || []).map(node => {
    if (node.type === 'hardBreak') return '  \n';
    if (node.type !== 'text') return '';
    let text = node.text || '';
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') text = `**${text}**`;
      else if (mark.type === 'italic') text = `*${text}*`;
      else if (mark.type === 'code') text = `\`${text}\``;
      else if (mark.type === 'strike') text = `~~${text}~~`;
      else if (mark.type === 'link') text = `[${text}](${mark.attrs?.href || ''})`;
    }
    return text;
  }).join('');
}

function blockToMarkdown(node, depth = 0) {
  const indent = '  '.repeat(depth);
  switch (node.type) {
    case 'heading': return `${'#'.repeat(node.attrs?.level || 1)} ${inlineToMarkdown(node.content)}`;
    case 'paragraph': return inlineToMarkdown(node.content);
    case 'codeBlock': return '```' + (node.attrs?.language || '') + '\n' + (node.content || []).map(n => n.text || '').join('') + '\n```';
    case 'blockquote': return (node.content || []).map(n => blockToMarkdown(n, depth)).join('\n\n').split('\n').map(l => `> ${l}`).join('\n');
    case 'horizontalRule': return '---';
    case 'bulletList': return (node.content || []).map(item => `${indent}- ${listItemToMarkdown(item, depth)}`).join('\n');
    case 'orderedList': return (node.content || []).map((item, n) => `${indent}${(node.attrs?.start || 1) + n}. ${listItemToMarkdown(item, depth)}`).join('\n');
    case 'taskList': return (node.content || []).map(item => `${indent}- [${item.attrs?.checked ? 'x' : ' '}] ${listItemToMarkdown(item, depth)}`).join('\n');
    case 'image': return `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`;
    case 'table': {
      const rows = (node.content || []).map(row => (row.content || []).map(c => (c.content || []).map(p => inlineToMarkdown(p.content)).join(' ').replace(/\|/g, '\\|')));
      if (!rows.length) return '';
      const [head, ...body] = rows;
      const line = r => `| ${r.join(' | ')} |`;
      return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.map(line)].join('\n');
    }
    default: return inlineToMarkdown(node.content);
  }
}

function listItemToMarkdown(item, depth) {
  const [first, ...rest] = item.content || [];
  const head = first ? blockToMarkdown(first, depth) : '';
  const tail = rest.map(n => blockToMarkdown(n, depth + 1)).join('\n');
  return tail ? `${head}\n${tail}` : head;
}

function docToMarkdown(doc) {
  return (doc?.content || []).map(node => blockToMarkdown(node)).join('\n\n').trim() + '\n';
}

function docToText(doc) {
  const out = [];
  const walk = node => {
    if (!node) return;
    if (node.type === 'text') out.push(node.text || '');
    (node.content || []).forEach(walk);
    if (['paragraph', 'heading', 'listItem', 'taskItem', 'codeBlock', 'tableRow'].includes(node.type)) out.push('\n');
    else if (['tableCell', 'tableHeader'].includes(node.type)) out.push(' ');
  };
  walk(doc);
  return out.join('').replace(/\n{2,}/g, '\n').trim();
}

module.exports = { markdownToDoc, docToMarkdown, docToText, parseInline, isFenceLine, codeLines, codeSpans, lineCodeSpans };
