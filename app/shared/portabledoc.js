// PortableDoc (Barkpark paper blocks) <-> markdown, via the ProseMirror JSON the markdown module already produces.
// Wire shapes follow api/assets/paper-editor/src/convert.js: inline text is {type:"text", value}, marks nest as
// {type:"strong"|"em"|"strikethrough"|"underline", children} and {type:"link", href, children}; code is a leaf {type:"code", value}.
const { markdownToDoc } = require('./markdown');

function pmInlineToPd(nodes) {
  const out = [];
  for (const node of nodes || []) {
    if (node.type === 'hardBreak') { out.push({ type: 'text', value: '\n' }); continue; }
    if (node.type !== 'text') throw new Error('Cannot convert inline node: ' + node.type);
    const marks = node.marks || [];
    for (const mark of marks) if (!['code', 'link', 'bold', 'italic', 'underline', 'strike'].includes(mark.type)) throw new Error('Cannot convert inline mark: ' + mark.type);
    const code = marks.find(m => m.type === 'code');
    let leaf = code ? { type: 'code', value: node.text || '' } : { type: 'text', value: node.text || '' };
    const wrappers = marks.filter(m => m.type !== 'code');
    const order = ['link', 'bold', 'italic', 'underline', 'strike'];
    wrappers.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    for (let i = wrappers.length - 1; i >= 0; i--) {
      const m = wrappers[i];
      if (m.type === 'bold') leaf = { type: 'strong', children: [leaf] };
      else if (m.type === 'italic') leaf = { type: 'em', children: [leaf] };
      else if (m.type === 'strike') leaf = { type: 'strikethrough', children: [leaf] };
      else if (m.type === 'underline') leaf = { type: 'underline', children: [leaf] };
      else if (m.type === 'link') leaf = { type: 'link', href: m.attrs?.href || '', children: [leaf] };
    }
    out.push(leaf);
  }
  return out;
}

function pdInlineToText(nodes) {
  return (nodes || []).map(n => {
    if (!n || typeof n !== 'object') return String(n ?? '');
    if (n.type === 'text' || n.type === 'code') return n.value || '';
    if (n.type === 'tag') return '#' + (n.name || '');
    if (n.children) return pdInlineToText(n.children);
    return n.value || n.fallback || '';
  }).join('');
}

function pdInlineToMarkdown(nodes) {
  return (nodes || []).map(n => {
    if (!n || typeof n !== 'object') return String(n ?? '');
    switch (n.type) {
      case 'text': return (n.value || '').replace(/\n/g, '  \n');
      case 'code': return '`' + (n.value || '') + '`';
      case 'strong': return '**' + pdInlineToMarkdown(n.children) + '**';
      case 'em': return '*' + pdInlineToMarkdown(n.children) + '*';
      case 'strikethrough': return '~~' + pdInlineToMarkdown(n.children) + '~~';
      case 'underline': return pdInlineToMarkdown(n.children);
      case 'link': return '[' + pdInlineToMarkdown(n.children) + '](' + (n.href || '') + ')';
      case 'wikilink': return '[[' + (n.alias || n.target || '') + ']]';
      case 'tag': return '#' + (n.name || '');
      default: return n.children ? pdInlineToMarkdown(n.children) : (n.value || n.fallback || '');
    }
  }).join('');
}

function inlineOf(block) {
  if (Array.isArray(block.content)) return block.content;
  if (typeof block.text === 'string') return [{ type: 'text', value: block.text }];
  if (typeof block.content === 'string') return [{ type: 'text', value: block.content }];
  return [];
}

function paragraphContent(nodes, context) {
  if ((nodes || []).some(node => node.type !== 'paragraph')) throw new Error('Cannot convert nested content in ' + context);
  return (nodes || []).flatMap((node, index) => [...(index ? [{ type: 'text', value: '\n' }] : []), ...pmInlineToPd(node.content)]);
}

function pmTableToPd(node) {
  const rows = node.content || [];
  if (!rows.length || rows.some(row => row.type !== 'tableRow' || !row.content?.length)) throw new Error('Cannot convert malformed table');
  const width = rows[0].content.length;
  if (rows.some(row => row.content.length !== width)) throw new Error('Cannot convert ragged table');
  const cells = rows.map(row => row.content.map(cell => {
    if (!['tableHeader', 'tableCell'].includes(cell.type) || (cell.attrs?.colspan || 1) !== 1 || (cell.attrs?.rowspan || 1) !== 1) throw new Error('Cannot convert unsupported table cell');
    return paragraphContent(cell.content, 'table cell');
  }));
  const hasHead = rows[0].content.every(cell => cell.type === 'tableHeader');
  if (rows.some((row, index) => row.content.some(cell => cell.type !== (hasHead && index === 0 ? 'tableHeader' : 'tableCell')))) throw new Error('Cannot convert mixed table headers');
  return { type: 'table', ...(hasHead ? { head: cells.shift() } : {}), rows: cells };
}

// Validate every nested node before constructing operations; unsupported content
// must never disappear from an otherwise valid mixed document.

function pmDocToBlocks(doc) {
  const blocks = [];
  for (const node of doc?.content || []) {
    switch (node.type) {
      case 'heading': blocks.push({ type: 'heading', level: Math.min(3, Math.max(1, node.attrs?.level || 2)), text: pdInlineToText(pmInlineToPd(node.content)) }); break;
      case 'table': blocks.push(pmTableToPd(node)); break;
      case 'paragraph': blocks.push({ type: 'paragraph', content: pmInlineToPd(node.content) }); break;
      case 'bulletList': case 'orderedList': case 'taskList':
        blocks.push({ type: 'list', ordered: node.type === 'orderedList', ...(node.type === 'taskList' ? { task: true } : {}), items: (node.content || []).map(item => { if ((item.content || []).length !== 1 || item.content[0].type !== 'paragraph') throw new Error('Cannot convert nested or multi-paragraph list item'); const inline = pmInlineToPd(item.content[0].content); return node.type === 'taskList' ? { content: inline, checked: item.attrs?.checked === true } : inline; }) });
        break;
      case 'blockquote': blocks.push({ type: 'callout', tone: 'note', content: paragraphContent(node.content, 'blockquote') }); break;
      case 'codeBlock': blocks.push({ type: 'code', language: node.attrs?.language || '', value: (node.content || []).map(t => t.text || '').join('') }); break;
      case 'horizontalRule': blocks.push({ type: 'divider' }); break;
      default: throw new Error('Cannot convert block: ' + node.type);
    }
  }
  return blocks;
}

function markdownToBlocks(markdown) { return pmDocToBlocks(markdownToDoc(markdown)); }

function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks.map(block => {
    if (!block || typeof block !== 'object') return '';
    switch (block.type) {
      case 'heading': return '#'.repeat(Math.min(6, block.level || 2)) + ' ' + (typeof block.text === 'string' ? block.text : pdInlineToMarkdown(inlineOf(block)));
      case 'paragraph': return pdInlineToMarkdown(inlineOf(block));
      case 'list': return (block.items || []).map((item, n) => (block.task ? (item && item.checked === true ? '- [x] ' : '- [ ] ') : block.ordered ? `${n + 1}. ` : '- ') + pdInlineToMarkdown(Array.isArray(item) ? item : typeof item === 'string' ? [{ type: 'text', value: item }] : inlineOf(item || {}))).join('\n');
      case 'callout': case 'note': return '> ' + (block.title ? '**' + block.title + '** ' : '') + pdInlineToMarkdown(inlineOf(block));
      case 'code': return '```' + (block.language || '') + '\n' + (block.value || block.code || '') + '\n```';
      case 'divider': return '---';
      case 'eyebrow': case 'byline': case 'ingress': case 'pullquote': return pdInlineToMarkdown(inlineOf(block)) || (Array.isArray(block.items) ? block.items.join(' · ') : '');
      case 'table': {
        const cell = c => pdInlineToMarkdown(Array.isArray(c) ? c : typeof c === 'string' ? [{ type: 'text', value: c }] : c?.value != null ? [{ type: 'text', value: String(c.value) }] : inlineOf(c || {})).replace(/\|/g, '\\|');
        const row = cells => '| ' + cells.map(cell).join(' | ') + ' |';
        const head = block.head || [];
        return [...(head.length ? [row(head), row(head.map(() => '---'))] : []), ...(block.rows || []).map(r => row(r.cells || r || []))].join('\n');
      }
      default: { const text = pdInlineToText(inlineOf(block)) || (block.title || ''); return `<!-- ${block.type} block -->` + (text ? '\n' + text : ''); }
    }
  }).filter(Boolean).join('\n\n');
}

function blocksToText(blocks) { return blocksToMarkdown(blocks).replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim(); }

// Ops for the fenced endpoint: append markdown as new blocks, or replace one block by id.
function appendOps(markdown) { return markdownToBlocks(markdown).map(block => ({ op: 'append-block', block })); }
function replaceBlockOps(id, markdown) {
  const blocks = markdownToBlocks(markdown);
  if (!blocks.length) return [{ op: 'remove-block', id }];
  const [first, ...rest] = blocks;
  const ops = [{ op: 'replace-block', id, block: { ...first, id } }];
  let after = id;
  for (const block of rest) { ops.push({ op: 'insert-after', afterId: after, block }); after = null; }
  return ops.filter((op, i) => i === 0 || op.afterId != null);
}
function replaceAllOps(existing, markdown) {
  return [...(existing || []).filter(b => b?.id).map(b => ({ op: 'remove-block', id: b.id })), ...appendOps(markdown)];
}

// Minimal HTML -> blocks for legacy body_html papers (headings, paragraphs, lists, quotes, code, rules).
function htmlToBlocks(html) {
  const clean = String(html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  const inline = s => {
    const md = decode(s.replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**').replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*').replace(/<code>([\s\S]*?)<\/code>/gi, '`$1`').replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    return md;
  };
  const lines = [];
  const re = /<(h[1-6]|p|li|blockquote|pre|hr)(?:\s[^>]*)?>([\s\S]*?)(?:<\/\1>|(?=<hr))/gi;
  let m;
  while ((m = re.exec(clean))) {
    const tag = m[1].toLowerCase();
    const body = m[2] || '';
    if (tag === 'hr') { lines.push('---'); continue; }
    if (tag === 'pre') { lines.push('```\n' + decode(body.replace(/<[^>]+>/g, '')) + '\n```'); continue; }
    if (tag === 'li') { const text = inline(body); if (!text) continue; if (lines.length && lines[lines.length - 1].startsWith('- ')) lines[lines.length - 1] += '\n- ' + text; else lines.push('- ' + text); continue; }
    if (tag === 'blockquote') { const text = inline(body); if (text) lines.push('> ' + text); continue; }
    if (/^h/.test(tag)) { const text = inline(body); if (text) lines.push('#'.repeat(Math.min(3, Number(tag[1]))) + ' ' + text); continue; }
    const text = inline(body);
    if (text) lines.push(text);
  }
  return markdownToBlocks(lines.join('\n\n'));
}

module.exports = { pmDocToBlocks, markdownToBlocks, blocksToMarkdown, blocksToText, pdInlineToText, pdInlineToMarkdown, appendOps, replaceBlockOps, replaceAllOps, htmlToBlocks };
