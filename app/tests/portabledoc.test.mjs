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
assert(blocks[4].type === 'blockquote', 'quote retains native blockquote identity');
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
assert(fromHtml[3].type === 'blockquote', 'html quote');
console.log('PortableDoc checks passed.');

const strict = require('node:assert/strict');
const tableMarkdown = '| Name | Value |\n| --- | --- |\n| **Alpha** | [Beta](https://example.org) \\| Gamma |';
const mixed = pd.markdownToBlocks('Before\n\n'+tableMarkdown+'\n\nAfter');
strict.deepEqual(mixed.map(b=>b.type),['paragraph','table','paragraph']);
strict.equal(mixed[1].head[0][0].value,'Name');
strict.equal(mixed[1].rows[0][0][0].type,'strong');
strict.equal(mixed[1].rows[0][1][0].href,'https://example.org');
strict.deepEqual(pd.markdownToBlocks(pd.blocksToMarkdown(mixed)),mixed,'mixed table round trip preserves headers, values, links and escaped pipes');
for (const bad of [
 {type:'unknown',content:[{type:'text',text:'must survive'}]},
 {type:'paragraph',content:[{type:'image',attrs:{src:'private-image'}}]},
 {type:'paragraph',content:[{type:'text',text:'marked',marks:[{type:'unknown'}]}]},
 {type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'parent'}]},{type:'paragraph',content:[]}]}]},
 {type:'blockquote',content:[{type:'table',content:[]}]},
 {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[{type:'unknown'}]}]}]},
]) strict.throws(()=>pd.pmDocToBlocks({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'valid sibling'}]},bad]}),/Cannot convert/,'mixed unsupported nested content must fail before yielding partial blocks');
console.log('Rich mixed PortableDoc conversion and fail-closed nested checks passed.');

const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
require('../main/store').init(fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-rich-conversion-')));
const bp = require('../main/barkpark'), edits = require('../main/agent-edits');
const originalGet=bp.cliGetPaper,originalApply=bp.cliApplyOps;
const calls=[];
try {
 bp.cliGetPaper=async()=>({rev:1,blocks:[{id:'existing',type:'paragraph',content:[{type:'text',value:'Keep existing content'}]}]});
 bp.cliApplyOps=async(...args)=>{calls.push(args);return{rev:2};};
 const config={enabled:true,writes:true,viaCli:true,server:'https://fixture.invalid',dataset:'production',cliRouting:['-s','https://fixture.invalid','-d','production','-w','fixture','-p','fixture']};
 for(const mode of ['replace','replace_block','append']) {
  await strict.rejects(()=>edits.apply({id:'bp:fixture',baseRev:1,mode,blockIndex:0,markdown:'Valid sibling\n\n> | Name | Value |\n> | --- | --- |\n> | Nested | table |',summary:'Unsupported nested table'},config),/Cannot convert/);
  strict.equal(calls.length,0,'unsupported mixed document cannot emit any API mutation');
 }
 for (const markdown of ['Valid sibling\n\n- Parent\n  - Child']) {
  await strict.rejects(()=>edits.apply({id:'bp:fixture',baseRev:1,mode:'replace',markdown,summary:'Unsupported shape'},config),/Cannot convert/);
  strict.equal(calls.length,0,'unsupported source syntax cannot mutate the API');
 }
 await edits.apply({id:'bp:fixture',baseRev:1,mode:'replace_block',blockIndex:0,markdown:tableMarkdown,summary:'Keep rich table'},config);
 strict.equal(calls.length,1);strict.equal(calls[0][1][0].op,'replace-block');strict.equal(calls[0][1][0].block.type,'table');strict.equal(calls[0][1][0].block.head.length,2);
 console.log('Production agent converter rejects unsupported mixed input before API writes; table uses replace-block.');
} finally {bp.cliGetPaper=originalGet;bp.cliApplyOps=originalApply;}

const multiline = pd.markdownToBlocks('First **line**  \nSecond [line](https://example.org)');
strict.equal(pd.pdInlineToText(multiline[0].content),'First line\nSecond line','explicit hard break retained');
strict.deepEqual(pd.markdownToBlocks(pd.blocksToMarkdown(multiline)),multiline,'hardbreak rich conversion round trip');
console.log('Explicit multiline rich content is preserved.');

for (const table of [
 {type:'table',rows:[['No header','Keep me']]},
 {type:'table',head:['Head'],rows:[['First\nSecond']]},
 {type:'table',head:['Head'],rows:[[{content:[{type:'text',value:'Aligned'}],align:'right'}]]},
]) {
 strict.throws(()=>pd.blocksToMarkdown([table]),/cannot preserve/);
 const view=bp.markdownView([table]);strict.equal(view.markdown,null);strict.ok(view.markdownError);
 const readable=bp.readablePaper({...view,blocks:[table]});strict.ok(readable.includes(JSON.stringify([table],null,2)),'read_document keeps full structured content usable');
 strict.ok(pd.blocksToText([table]).length,'snippets do not depend on Markdown export');
}
strict.equal(pd.markdownToBlocks('```text\n- Parent\n  - Child\n```')[0].type,'code','strict nested-list check ignores fenced source');
console.log('Unsupported nested source and unrepresentable export are blocked; structured reads and snippets remain usable.');

// Paper's native code shape is lang; retain read compatibility for older data.
const nativeCode = pd.pmDocToBlocks({type:'doc',content:[{type:'codeBlock',attrs:{language:'js'},content:[{type:'text',text:'const n = 1;\n'}]}]})[0];
assert(nativeCode.lang === 'js' && !Object.hasOwn(nativeCode, 'language'), 'code language uses the actual Paper field');
assert(nativeCode.value === 'const n = 1;\n', 'code trailing newline retained');
const plainCode = pd.pmDocToBlocks({type:'doc',content:[{type:'codeBlock',attrs:{language:''},content:[{type:'text',text:'plain'}]}]})[0];
assert(!Object.hasOwn(plainCode, 'lang') && !Object.hasOwn(plainCode, 'language'), 'empty code language has no carrier');
assert(pd.blocksToMarkdown([{type:'code',lang:'js',value:'run();'}]) === '```js\nrun();\n```', 'native language exported');
assert(pd.blocksToMarkdown([{type:'code',language:'js',value:'run();'}]) === '```js\nrun();\n```', 'legacy language remains readable');
assert(pd.blocksToMarkdown([{type:'code',lang:'',language:'old',value:'run();'}]) === '```\nrun();\n```', 'explicit native empty language takes precedence');
console.log('Native Paper code language, empty language, trailing newline and legacy export compatibility passed.');

const nested = pd.pmDocToBlocks({type:'doc',content:[{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Parent'}]},{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Child'}]}]}]}]}]}]});
strict.equal(nested[0].items[0].children[0].ordered,true);
strict.ok(pd.blocksToText(nested).includes('Child'));
strict.throws(()=>pd.blocksToMarkdown(nested),/cannot preserve nested lists/);
strict.equal(bp.markdownView(nested).markdown,null);
strict.deepEqual(pd.markdownToBlocks(pd.blocksToMarkdown([{type:'blockquote',content:[{type:'strong',children:[{type:'text',value:'Keep quote'}]}]}])),[{type:'blockquote',content:[{type:'strong',children:[{type:'text',value:'Keep quote'}]}]}]);
console.log('Native quote identity and nested structured fallback preserve child content.');
