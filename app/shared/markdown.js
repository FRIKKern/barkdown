// Markdown <-> ProseMirror (Tiptap) JSON. Small, dependency-free, and good enough for
// headings, paragraphs, lists, task lists, quotes, code fences, links, emphasis and code.
// Used by the agent (main process) and the document tab (renderer).

function parseInline(text) {
  const nodes = [];
  const pattern = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\n]+)\*|_([^_\n]+)_|~~([^~]+)~~)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push({ type: 'text', text: text.slice(last, match.index) });
    if (match[2] || match[3]) nodes.push({ type: 'text', text: match[2] || match[3], marks: [{ type: 'bold' }] });
    else if (match[4]) nodes.push({ type: 'text', text: match[4], marks: [{ type: 'code' }] });
    else if (match[5]) nodes.push({ type: 'text', text: match[5], marks: [{ type: 'link', attrs: { href: match[6], target: '_blank' } }] });
    else if (match[7] || match[8]) nodes.push({ type: 'text', text: match[7] || match[8], marks: [{ type: 'italic' }] });
    else if (match[9]) nodes.push({ type: 'text', text: match[9], marks: [{ type: 'strike' }] });
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes.filter(n => n.text.length);
}

// GFM tables: a header row, a separator row of dashes, then body rows. Cells may escape a pipe as \|.
function isTableRow(line) { return /^\s*\|.*\|\s*$/.test(line); }
function isTableSeparator(line) { return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-'); }
function splitCells(line) {
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.replace(/\\\|/g, '|').trim());
  return cells;
}

function paragraph(text) {
  const content = parseInline(text);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function markdownToDoc(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const content = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) { content.push({ type: 'heading', attrs: { level: heading[1].length }, content: parseInline(heading[2].trim()) }); i++; continue; }
    if (/^```/.test(line)) {
      const language = line.slice(3).trim() || null;
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      content.push({ type: 'codeBlock', attrs: { language }, content: code.length ? [{ type: 'text', text: code.join('\n') }] : [] });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { content.push({ type: 'horizontalRule' }); i++; continue; }
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const cell = (text, type) => ({ type, content: [paragraph(text)] });
      const rows = [{ type: 'tableRow', content: splitCells(line).map(c => cell(c, 'tableHeader')) }];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) { rows.push({ type: 'tableRow', content: splitCells(lines[i]).map(c => cell(c, 'tableCell')) }); i++; }
      content.push({ type: 'table', content: rows });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quoted = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { quoted.push(lines[i].replace(/^>\s?/, '')); i++; }
      content.push({ type: 'blockquote', content: markdownToDoc(quoted.join('\n')).content });
      continue;
    }
    if (/^\s*[-*+]\s+\[( |x|X)\]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+\[( |x|X)\]\s+/.test(lines[i])) {
        const m = /^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/.exec(lines[i]);
        items.push({ type: 'taskItem', attrs: { checked: m[1] !== ' ' }, content: [paragraph(m[2])] });
        i++;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push({ type: 'listItem', content: [paragraph(lines[i].replace(/^\s*[-*+]\s+/, ''))] });
        i++;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push({ type: 'listItem', content: [paragraph(lines[i].replace(/^\s*\d+[.)]\s+/, ''))] });
        i++;
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items });
      continue;
    }
    const buffer = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i]) && !(isTableRow(lines[i]) && isTableSeparator(lines[i + 1] || ''))) { buffer.push(lines[i]); i++; }
    const inline = [];
    for (let lineIndex = 0; lineIndex < buffer.length; lineIndex++) {
      if (lineIndex) inline.push(/(?: {2,}|\\)$/.test(buffer[lineIndex - 1]) ? { type: 'hardBreak' } : { type: 'text', text: ' ' });
      const value = lineIndex < buffer.length - 1 ? buffer[lineIndex].replace(/(?: {2,}|\\)$/, '') : buffer[lineIndex];
      inline.push(...parseInline(value));
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

module.exports = { markdownToDoc, docToMarkdown, docToText, parseInline };
