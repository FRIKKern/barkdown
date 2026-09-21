// PortableDoc conversions: markdown -> blocks -> markdown, inline mark nesting, ops builders, HTML fallback.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pd = require('../shared/portabledoc.js');
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const md = '# Title\n\nPlain **bold** and *em* with `code` and [a link](https://x.y).\n\n- one\n- two **strong**\n\n1. first\n2. second\n\n> A quoted note\n\n```js\nrun();\n```\n\n---\n';
const blocks = pd.markdownToBlocks(md);
assert(blocks[0].type === 'heading' && blocks[0].level === 1 && blocks[0].text === 'Title', 'heading block');
assert(blocks[1].type === 'paragraph', 'paragraph block');
const inline = blocks[1].content;
assert(inline[0].type === 'text' && inline[0].value === 'Plain ', 'plain text leaf');
assert(inline[1].type === 'strong' && inline[1].children[0].value === 'bold', 'strong wraps text');
assert(inline[3].type === 'em', 'em wrapper');
assert(inline.some(n => n.type === 'code' && n.value === 'code'), 'code leaf');
assert(inline.some(n => n.type === 'link' && n.href === 'https://x.y' && n.children[0].value === 'a link'), 'link wrapper');
assert(blocks[2].type === 'list' && blocks[2].ordered === false && blocks[2].items.length === 2 && blocks[2].items[1][1].type === 'strong', 'bullet list with nested strong');
assert(blocks[3].type === 'list' && blocks[3].ordered === true, 'ordered list');
assert(blocks[4].type === 'callout', 'quote -> callout');
assert(blocks[5].type === 'code' && blocks[5].value === 'run();', 'code block');
assert(blocks[6].type === 'divider', 'divider');

const back = pd.blocksToMarkdown(blocks);
assert(back.includes('# Title') && back.includes('**bold**') && back.includes('*em*') && back.includes('`code`') && back.includes('[a link](https://x.y)') && back.includes('- two **strong**') && back.includes('2. second') && back.includes('```js'), 'markdown round trip lost structure: ' + back);

// Server-shaped blocks (ids, text headings, string list items) render too.
const server = [{ id: 'block-0', type: 'heading', level: 1, text: 'Barkdown editor test' }, { id: 'block-1', type: 'paragraph', content: [{ type: 'text', value: 'Hello' }] }, { id: 'block-2', type: 'list', items: [[{ type: 'text', value: 'a' }], 'b'] }];
const serverMd = pd.blocksToMarkdown(server);
assert(serverMd === '# Barkdown editor test\n\nHello\n\n- a\n- b', 'server blocks markdown: ' + JSON.stringify(serverMd));

// Ops builders
const append = pd.appendOps('New paragraph.');
assert(append.length === 1 && append[0].op === 'append-block' && append[0].block.type === 'paragraph', 'append ops');
const replace = pd.replaceBlockOps('block-1', '## Replaced\n\nBody');
assert(replace[0].op === 'replace-block' && replace[0].id === 'block-1' && replace[0].block.id === 'block-1' && replace[1].op === 'insert-after' && replace[1].afterId === 'block-1', 'replace-block ops: ' + JSON.stringify(replace));
const all = pd.replaceAllOps(server, 'Only this.');
assert(all.filter(o => o.op === 'remove-block').length === 3 && all.at(-1).op === 'append-block', 'replace-all ops');

// HTML fallback
const html = '<style>.x{}</style><h1>Head</h1><p>Para with <strong>bold</strong> &amp; more</p><ul><li>one</li><li>two</li></ul><blockquote>q</blockquote>';
const fromHtml = pd.htmlToBlocks(html);
assert(fromHtml[0].type === 'heading' && fromHtml[0].text === 'Head', 'html heading');
assert(fromHtml[1].type === 'paragraph' && pd.pdInlineToText(fromHtml[1].content) === 'Para with bold & more', 'html paragraph: ' + pd.pdInlineToText(fromHtml[1].content));
assert(fromHtml[2].type === 'list' && fromHtml[2].items.length === 2, 'html list');
assert(fromHtml[3].type === 'callout', 'html quote');
console.log('PortableDoc checks passed.');
