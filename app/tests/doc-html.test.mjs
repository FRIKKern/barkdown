// The read-only rendering of a legacy document: every block the store holds, escaped, in the
// markup the note styles know; only safe links and pictures are kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { docToHtml } = require('../shared/doc-html');
const { markdownToDoc } = require('../shared/markdown');
test('a Markdown document renders every block type in the expected markup', () => {
  const doc = markdownToDoc(['# Title', '', 'Some **bold**, *italic*, `code`, ~~gone~~ and a [link](https://example.com/a).', '', '- one', '- two', '', '1. first', '2. second', '', '- [ ] open', '- [x] done', '', '> quoted', '', '```js', 'const x = 1;', '```', '', '| a | b |', '| --- | --- |', '| 1 | 2 |', '', '---'].join('\n'));
  doc.content.push({ type: 'image', attrs: { src: 'https://example.com/p.png', alt: 'alt text' } });
  const html = docToHtml(doc);
  for (const piece of ['<h1>Title</h1>', '<strong>bold</strong>', '<em>italic</em>', '<code>code</code>', '<s>gone</s>', '<a href="https://example.com/a">link</a>', '<ul><li><p>one</p></li><li><p>two</p></li></ul>', '<ol><li><p>first</p></li>',
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox" disabled></label><div><p>open</p></div></li><li data-type="taskItem" data-checked="true"><label><input type="checkbox" disabled checked></label>',
    '<blockquote><p>quoted</p></blockquote>', '<pre><code class="language-js">const x = 1;</code></pre>', '<table><tbody><tr><th>', '<hr>', '<img src="https://example.com/p.png" alt="alt text">']) assert.ok(html.includes(piece), piece + ' in ' + html);
});
test('text is escaped and unsafe links and pictures are dropped', () => {
  const html = docToHtml({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script> & "quotes"', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'ours', marks: [{ type: 'link', attrs: { href: 'barkdown://doc/abc-123' } }] }] },
    { type: 'image', attrs: { src: 'file:///etc/passwd', alt: 'a "picture"' } },
    { type: 'heading', attrs: { level: 9 }, content: [{ type: 'text', text: 'deep' }] },
  ] });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;')); assert.ok(!html.includes('javascript:')); assert.ok(!html.includes('<a href="javascript'));
  assert.ok(html.includes('<a href="barkdown://doc/abc-123">ours</a>'));
  assert.ok(!html.includes('<img')); assert.ok(html.includes('[picture: a &quot;picture&quot;]'));
  assert.ok(html.includes('<h6>deep</h6>'));
});
test('an empty or malformed document says so instead of throwing', () => {
  assert.equal(docToHtml(null), '<p class="bw-muted">This document is empty.</p>');
  assert.equal(docToHtml({ type: 'doc', content: [] }), '<p class="bw-muted">This document is empty.</p>');
  assert.equal(docToHtml({ type: 'doc', content: [{ type: 'mystery', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'kept' }] }] }, 7, null] }), '<p>kept</p>');
});
