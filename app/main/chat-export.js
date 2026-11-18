// A chat leaves the app two ways (renderer/src/chat-menu.js builds the Markdown with shared/chat-menu.js):
// - Save as a note: chatNoteBlocks turns it into Paper blocks for barkpark:createNoteWith. Replies are free
//   Markdown, which the strict converter refuses (nested lists, for one), so each top-level block converts on
//   its own and one Paper cannot hold keeps its text as a paragraph, the way Markdown import does.
// - Export as Markdown: exportChatMarkdown writes the text to the one file the person picked in the save dialog.
const fs = require('node:fs');
const { markdownToDoc, docToText } = require('../shared/markdown');
const { pmDocToBlocks } = require('../shared/portabledoc');
const { fileName } = require('./note-export');

const MAX_CHARS = 4 * 1024 * 1024;

function chatNoteBlocks(title, markdown) {
  const body = [];
  for (const node of markdownToDoc(String(markdown || '')).content || []) {
    if (node.type === 'paragraph' && !node.content?.length) continue;
    try { body.push(...pmDocToBlocks({ type: 'doc', content: [node] })); }
    catch {
      const text = docToText({ type: 'doc', content: [node] });
      if (text) body.push({ type: node.type === 'blockquote' ? 'blockquote' : 'paragraph', content: [{ type: 'text', value: text }] });
    }
  }
  return [{ id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text: String(title || '') },
    ...body.map((block, i) => ({ ...block, id: `chat-${i}` }))];
}

// chooseFile({ defaultName, filters }) -> chosen path or null (Cancel). Returns { filePath } or null.
async function exportChatMarkdown({ title, markdown, chooseFile, write = fs.writeFileSync }) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('There is no Markdown to export.');
  if (markdown.length > MAX_CHARS) throw new Error('This chat is too long to export as one Markdown file.');
  const filePath = await chooseFile({ defaultName: fileName(title || 'Chat') + '.md', filters: [{ name: 'Markdown', extensions: ['md'] }] });
  if (!filePath) return null;
  write(filePath, markdown);
  return { filePath };
}

module.exports = { chatNoteBlocks, exportChatMarkdown };
