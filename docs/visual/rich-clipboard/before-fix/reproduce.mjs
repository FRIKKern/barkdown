import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const source='C:/Users/Frikk/.codex/worktrees/barkpark-rich-clipboard/api/priv/static/assets';
const out=path.resolve('docs/visual/rich-clipboard/before-fix');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1100,height:750}});
await page.goto('about:blank');await page.evaluate(()=>window.BP_PAPER_EDITOR_NO_INJECT=true);
await page.addScriptTag({path:source+'/bp-paper-editor.bundle.js'});await page.addStyleTag({path:source+'/bp-paper-editor.css'});
const table='<table><tr><td>Cell text retained</td></tr></table>';
const picture='<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6x8kAAAAASUVORK5CYII=" alt="Important diagram">';
const cases=[
 {name:'table-image-sibling',html:'<p>Lead</p>'+table+picture+'<p>Tail</p>'},
 {name:'table-image-inside',html:'<table><tr><td>Cell'+picture+'</td></tr></table>'},
 {name:'image-only-selected-text',html:picture,selected:true},
 {name:'mixed-image-file-and-table',html:table,file:true},
 {name:'explicit-plain-paste-with-file',html:table,file:true,plain:true},
 {name:'table-nested-details',html:table+'<details><summary>Summary</summary><p>Hidden child</p></details>'},
];const results=[];
try {for(const fixture of cases){
 const result=await page.evaluate(f=>{
  document.body.replaceChildren();document.body.className='bp-paper-surface';const c=document.createElement('bp-paper-canvas');c.blocks=[{id:'seed',type:'paragraph',content:[{type:'text',value:'Before selected After'}]}];document.body.append(c);c._editor.commands.focus();c._editor.commands.setTextSelection(f.selected?{from:8,to:16}:c._editor.state.doc.content.size-1);
  const before=c.recoverySnapshot();const transfer=new DataTransfer();transfer.setData('text/html',f.html);transfer.setData('text/plain','CLIPBOARD PLAIN CONTENT');if(f.file)transfer.items.add(new File([new Uint8Array([137,80,78,71])],'clipboard.png',{type:'image/png'}));
  if(f.plain){c._editor.view.input.shiftKey=true;c._editor.view.input.lastKeyCode=86;}
  const event=new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true});c._editor.view.dom.dispatchEvent(event);
  return{before,after:c.recoverySnapshot(),pm:c._editor.getJSON(),notice:c.querySelector('[role=status]')?.textContent||'',prevented:event.defaultPrevented};
 },fixture);await page.screenshot({path:path.join(out,fixture.name+'.png')});results.push({...fixture,...result});
}fs.writeFileSync(path.join(out,'d8-audit.json'),JSON.stringify({source:'d24c7a094 (runtime bytes identical to d8fda9690)',browser:browser.version(),cases:results},null,2));console.log(JSON.stringify(results.map(r=>({name:r.name,types:r.after.blocks.map(b=>b.type),text:JSON.stringify(r.after.blocks),notice:r.notice,prevented:r.prevented})),null,2));}
finally{await browser.close();}
