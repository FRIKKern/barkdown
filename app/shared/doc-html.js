// A read-only rendering of a legacy document (the ProseMirror JSON the legacy store holds) as
// HTML, in the markup the note styles already know (R1 of the legacy retirement): retained
// originals and read-only copies no longer need the editor to be shown. Everything is escaped;
// only http, https and barkdown links are kept; nothing here writes.
const SAFE_HREF = /^(?:https?:\/\/|barkdown:\/\/doc\/)[^\s"'<>]+$/;
const SAFE_SRC = /^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)[^\s"'<>]+$/;
function escape(text) { return String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function inline(nodes) {
  return (nodes || []).map(node => {
    if (node.type === 'hardBreak') return '<br>';
    if (node.type !== 'text') return '';
    let html = escape(node.text);
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') html = `<strong>${html}</strong>`;
      else if (mark.type === 'italic') html = `<em>${html}</em>`;
      else if (mark.type === 'code') html = `<code>${html}</code>`;
      else if (mark.type === 'strike') html = `<s>${html}</s>`;
      else if (mark.type === 'underline') html = `<u>${html}</u>`;
      else if (mark.type === 'link') { const href = String(mark.attrs?.href || ''); html = SAFE_HREF.test(href) ? `<a href="${escape(href)}">${html}</a>` : html; }
    }
    return html;
  }).join('');
}
function block(node) {
  if (!node || typeof node !== 'object') return '';
  switch (node.type) {
    case 'paragraph': return `<p>${inline(node.content)}</p>`;
    case 'heading': { const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1)); return `<h${level}>${inline(node.content)}</h${level}>`; }
    case 'codeBlock': { const language = String(node.attrs?.language || '').replace(/[^\w+#.-]/g, ''); return `<pre><code${language ? ` class="language-${escape(language)}"` : ''}>${escape((node.content || []).map(n => n.text || '').join(''))}</code></pre>`; }
    case 'blockquote': return `<blockquote>${blocks(node.content)}</blockquote>`;
    case 'horizontalRule': return '<hr>';
    case 'hardBreak': return '<br>';
    case 'bulletList': return `<ul>${(node.content || []).map(item => `<li>${blocks(item.content)}</li>`).join('')}</ul>`;
    case 'orderedList': { const start = Number(node.attrs?.start); return `<ol${Number.isInteger(start) && start !== 1 ? ` start="${start}"` : ''}>${(node.content || []).map(item => `<li>${blocks(item.content)}</li>`).join('')}</ol>`; }
    case 'taskList': return `<ul data-type="taskList">${(node.content || []).map(item => { const checked = Boolean(item.attrs?.checked); return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" disabled${checked ? ' checked' : ''}></label><div>${blocks(item.content)}</div></li>`; }).join('')}</ul>`;
    case 'image': { const src = String(node.attrs?.src || ''); return SAFE_SRC.test(src) ? `<img src="${escape(src)}" alt="${escape(node.attrs?.alt || '')}"${node.attrs?.title ? ` title="${escape(node.attrs.title)}"` : ''}>` : `<p class="bw-muted">[picture: ${escape(node.attrs?.alt || src || 'unavailable')}]</p>`; }
    case 'table': return `<table><tbody>${(node.content || []).map(row => `<tr>${(row.content || []).map(cell => { const tag = cell.type === 'tableHeader' ? 'th' : 'td'; const span = a => Number.isInteger(Number(a)) && Number(a) > 1 ? Number(a) : null; const cols = span(cell.attrs?.colspan), rows = span(cell.attrs?.rowspan); return `<${tag}${cols ? ` colspan="${cols}"` : ''}${rows ? ` rowspan="${rows}"` : ''}>${blocks(cell.content)}</${tag}>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    case 'listItem': case 'taskItem': case 'tableRow': case 'tableCell': case 'tableHeader': return blocks(node.content);
    case 'text': return inline([node]);
    default: return node.content ? blocks(node.content) : '';
  }
}
function blocks(nodes) { return (nodes || []).map(block).join(''); }
// The whole document, as the body of a `.ProseMirror` container.
function docToHtml(doc) {
  const content = doc && typeof doc === 'object' ? (doc.type === 'doc' ? doc.content : Array.isArray(doc) ? doc : doc.content) : null;
  const html = blocks(content);
  return html || '<p class="bw-muted">This document is empty.</p>';
}
module.exports = { docToHtml };
