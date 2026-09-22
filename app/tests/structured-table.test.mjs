import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url), edits=require('../main/agent-edits'), bp=require('../main/barkpark'), store=require('../main/store');
store.init(fs.mkdtempSync(path.join(os.tmpdir(),'bd-table-unit-')));
const t=value=>[{type:'text',value}];
const original=[{id:'intro',type:'paragraph',content:t('Keep prose')},{id:'table',type:'table',caption:'Keep caption',cols:[{width:130},{width:180}],headCol:true,rows:[{note:'Keep row metadata',cells:[{content:[{type:'strong',children:t('First\nSecond')}],align:'right',note:'Keep cell metadata'},t('Human target')]}]},{id:'tail',type:'paragraph',content:t('Keep tail')}];
let paper={id:'fixture',rev:7,blocks:structuredClone(original)},writes=[];
bp.getPaper=async()=>structuredClone(paper);bp.applyOps=async(c,s,ops,rev)=>{assert.equal(rev,paper.rev);writes.push(structuredClone(ops));for(const op of ops){if(op.op==='patch-block')Object.assign(paper.blocks.find(b=>b.id===op.id),op.patch);else if(op.op==='remove-block')paper.blocks=paper.blocks.filter(b=>b.id!==op.id);else if(op.op==='append-block')paper.blocks.push(structuredClone(op.block));else throw new Error(op.op);}return {rev:++paper.rev};};
const cfg={enabled:true,writes:true,server:'http://fixture.invalid'};
const edit=(cells,extra={})=>edits.applyTable({id:'bp:fixture',blockId:'table',baseRev:paper.rev,cells,summary:'Edit a table cell',...extra},cfg);
const receipt=await edit([{row:0,column:0,text:'Changed\nSecond',align:'center'}]);
assert.equal(writes.length,1);assert.equal(writes[0].length,1);assert.equal(writes[0][0].op,'patch-block');assert.deepEqual(Object.keys(writes[0][0].patch),['rows']);
assert.equal(paper.blocks[1].rows[0].cells[0].note,'Keep cell metadata');assert.equal(paper.blocks[1].rows[0].note,'Keep row metadata');assert.equal(paper.blocks[1].rows[0].cells[0].align,'center');assert.deepEqual(paper.blocks[0],original[0]);assert.deepEqual(paper.blocks[2],original[2]);assert.deepEqual(paper.blocks[1].rows[0].cells[1],original[1].rows[0].cells[1]);assert.equal(paper.blocks[1].head,undefined);assert.deepEqual(paper.blocks[1].cols,original[1].cols);assert.equal(receipt.mode,'replace_block');assert.equal(receipt.blockIndex,1);
await edits.undo('bp:fixture',receipt.id,cfg);assert.deepEqual(paper.blocks,original);
for(const [cells,extra] of [[[{row:0,column:0,text:'ok'},{row:8,column:0,text:'bad'}],{}],[[{row:0,column:0,text:'bad'}],{baseRev:1}],[[{row:0,column:0,text:'bad'}],{blockId:'missing'}],[[{row:0,column:0,content:[{type:'unsupported',value:'no'}]}],{}],[[{row:0,column:0,text:'x',content:t('y')}],{}],[[{row:0,column:0,align:'justify'}],{}]]){const count=writes.length,before=structuredClone(paper);await assert.rejects(()=>edit(cells,extra));assert.equal(writes.length,count);assert.deepEqual(paper,before);}
const cleared=await edit([{row:0,column:0,align:'left'}]);assert.equal(paper.blocks[1].rows[0].cells[0].align,undefined);assert.deepEqual(paper.blocks[1].rows[0].cells[0].content,original[1].rows[0].cells[0].content);assert.equal(paper.blocks[1].rows[0].cells[0].note,'Keep cell metadata');
const exported=JSON.parse(bp.readablePaper(paper,'structured'));assert.deepEqual(exported.blocks,paper.blocks);assert.equal(exported.rev,paper.rev);assert.equal(exported.id,'bp:fixture');
console.log('Structured table adapter: actual patch shape, metadata, multiline/alignment, Undo, stale/invalid zero-write, structured export passed.');

const pd=require('../shared/portabledoc');
const aligned='| Left | Center | Right |\n| --- | :---: | ---: |\n| One | **Two** | [Three](https://example.org) |';
const converted=pd.markdownToBlocks(aligned);
assert.equal(converted[0].head[1].align,'center');assert.equal(converted[0].rows[0][2].align,'right');assert.equal(pd.blocksToMarkdown(converted),aligned);assert.deepEqual(pd.markdownToBlocks(pd.blocksToMarkdown(converted)),converted);
assert.throws(()=>pd.blocksToMarkdown([{type:'table',head:['A'],rows:[[{content:t('B'),align:'right'}]]}]),/mixed cell alignment/);
console.log('Uniform GFM alignment roundtrip passes; mixed per-cell alignment remains structured.');

const {tablePatch}=require('../shared/table-edits');
const merged={id:'merged',type:'table',rows:[[t('Anchor'),[]],[t('Next'),t('Stay')]],spans:[{row:0,col:0,rowspan:1,colspan:2}]};
assert.throws(()=>tablePatch(merged,[{row:0,column:1,text:'covered'}]),/covered/);
assert.throws(()=>tablePatch(merged,[{row:0,column:0,text:'one'},{row:0,column:0,text:'two'}]),/only once/);
assert.deepEqual(tablePatch(merged,[{row:0,column:0,text:'Changed'}]).rows[0],[t('Changed'),[]]);
assert.deepEqual(merged.rows[0],[t('Anchor'),[]],'pure adapter never mutates source');
paper.blocks.push(structuredClone(paper.blocks[1]));const beforeDuplicate=writes.length;await assert.rejects(()=>edit([{row:0,column:0,text:'ambiguous'}]),/uniquely/);assert.equal(writes.length,beforeDuplicate);paper.blocks.pop();
const runs=require('../main/providers/runs');const event=runs.activityForTool({context:{}},'mcp__barkdown__edit_table',{id:'bp:fixture',summary:'Align a cell'});assert.equal(event.target.source,'barkpark');assert.equal(event.agentEdit,true);assert.equal(event.libraryChanged,true);
console.log('Merged coverage, duplicate cell/block identity and signed-provider edit activity passed.');

for(const cell of [[{type:'underline',children:t('underlined')}],t('literal **stars**'),[{type:'code',value:'literal ` backtick'}]]) assert.throws(()=>pd.blocksToMarkdown([{type:'table',head:['A'],rows:[[cell]]}]),/cannot preserve/);
console.log('Lossy literal Markdown/unsupported inline table exports retain structured fallback.');

assert.throws(()=>pd.markdownToBlocks('| A | B |\n| ---: |\n| One | Two |'),/mismatched separator/);

assert.ok(pd.blocksToMarkdown([{type:'table',head:['Number'],rows:[[42]]}]).includes('42'));
assert.throws(()=>pd.blocksToMarkdown([{type:'table',head:['Boolean'],rows:[[false]]}]),/cannot preserve/);
