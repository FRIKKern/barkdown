const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),fragment=fs.readFileSync(path.join(root,'concepts/workspace.html'),'utf8');
const icons=fs.readFileSync(path.join(path.dirname(require.resolve('lucide/package.json')),'dist/umd/lucide.min.js'),'utf8');
const assert=(ok,message)=>{if(!ok)throw Error(message)};
(async()=>{
 const browser=await require('./browser.cjs').launch();
 const page=await browser.newPage({viewport:{width:1320,height:800},colorScheme:'dark'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#191b18}</style><script>'+icons+'</script></head><body>'+fragment+'</body></html>');
 const chatWidth=()=>page.evaluate(()=>getComputedStyle(document.getElementById('bd-worktabs')).getPropertyValue('--bw-chat').trim());
 const activeTab=()=>page.locator('.bw-tab.active [data-tab]').getAttribute('data-tab');
 // Adjustable split (D07): drag, keyboard, clamp, reset.
 assert(await chatWidth()==='60fr','Default split is not 60/40');
 const handle=await page.locator('#bw-splitter').boundingBox(),chat=await page.locator('.bw-chat').boundingBox(),rootBox=await page.locator('#bd-worktabs').boundingBox();
 await page.mouse.move(handle.x+handle.width/2,handle.y+200);await page.mouse.down();await page.mouse.move(chat.x+(rootBox.x+rootBox.width-chat.x)*0.5,handle.y+200,{steps:5});await page.mouse.up();
 assert(await chatWidth()==='50fr','Dragging the splitter did not resize the conversation: '+await chatWidth());
 await page.locator('#bw-splitter').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowLeft');
 assert(await chatWidth()==='40fr','Keyboard resize did not clamp at 40%: '+await chatWidth());
 await page.locator('#bw-splitter').dblclick();assert(await chatWidth()==='60fr','Double-click did not reset the split');
 // Quick open (D23) reaches tabs, documents, chats, new tabs, and actions.
 await page.keyboard.press('Control+k');assert(await page.locator('#bw-palette').isVisible(),'Ctrl+K did not open quick open');
 await page.locator('#bw-palette-input').fill('review');await page.keyboard.press('Enter');
 assert(await activeTab()==='3','Quick open did not switch to the Review tab');assert(await page.locator('#bw-palette').isHidden(),'Quick open stayed open after running an item');
 await page.keyboard.press('Control+k');await page.locator('#bw-palette-input').fill('interaction notes');await page.keyboard.press('Enter');
 assert(!await page.locator('.bw-chat').isVisible(),'Quick open document did not enter direct document mode');
 assert(await page.locator('#bw-splitter').isHidden(),'Splitter visible in document mode');
 await page.keyboard.press('Control+k');await page.locator('#bw-palette-input').fill('shaping');await page.keyboard.press('Enter');
 assert(await page.locator('.bw-chat').isVisible(),'Quick open chat did not restore chat mode');
 await page.keyboard.press('Control+k');await page.locator('#bw-palette-input').fill('zzz-nothing');
 assert(await page.locator('.bw-palette-empty').isVisible(),'Empty quick open state missing');await page.keyboard.press('Escape');
 assert(await page.locator('#bw-palette').isHidden(),'Escape did not close quick open');
 // Keyboard shortcuts: Alt+digit switches, Alt+W closes, Alt+N opens the type menu.
 await page.keyboard.press('Alt+1');assert(await activeTab()==='1','Alt+1 did not focus the first tab');
 const last=await page.locator('#bw-tabs [data-tab]').last().getAttribute('data-tab');await page.keyboard.press('Alt+9');assert(await activeTab()===last,'Alt+9 did not focus the last tab');
 const before=await page.locator('#bw-tabs [data-tab]').count();await page.keyboard.press('Alt+w');
 assert(await page.locator('#bw-tabs [data-tab]').count()===before-1,'Alt+W did not close the active tab');
 await page.keyboard.press('Alt+n');assert(await page.locator('#bw-new-menu').isVisible(),'Alt+N did not open the new-tab menu');await page.keyboard.press('Escape');
 // Composer: Enter sends, Shift+Enter keeps writing; middle-click closes a tab.
 await page.locator('#bw-prompt').fill('First line');await page.locator('#bw-prompt').press('Shift+Enter');await page.locator('#bw-prompt').type('second line');
 assert((await page.locator('#bw-prompt').inputValue()).includes('\n'),'Shift+Enter did not insert a newline');
 await page.locator('#bw-prompt').press('Enter');assert(await page.locator('#bw-prompt').inputValue()==='','Enter did not send the message');
 assert(await page.locator('.bw-user-message').count()===2,'Sent message missing from the transcript');
 const tabs=await page.locator('#bw-tabs [data-tab]').count();await page.locator('#bw-tabs [data-tab]').first().click({button:'middle'});
 assert(await page.locator('#bw-tabs [data-tab]').count()===tabs-1,'Middle-click did not close the tab');
 // Working indicator follows the scripted run; unsaved project edits mark the project tab.
 await page.locator('#bw-watch').click();assert(await page.locator('#bw-working').isVisible(),'Working indicator missing during the AI walkthrough');
 await page.waitForFunction(()=>!document.querySelector('#bw-watch').disabled);assert(await page.locator('#bw-working').isHidden(),'Working indicator stayed after the run');
 await page.locator('#bw-folder-context').click();await page.locator('#bw-project-menu [data-project-open]').click();
 assert(await page.locator('#bw-splitter').isHidden(),'Splitter visible in the expanded editor');
 await page.locator('#bw-source-input').type('\n/* draft */');assert(await page.locator('.bw-dot-dirty').count()===1,'Unsaved project edit not shown on the tab');
 await page.locator('[data-store-file]').click();assert(await page.locator('.bw-dot-dirty').count()===0,'Stored file still marked unsaved');
 assert(errors.length===0,'Runtime errors: '+errors.join(';'));
 console.log(JSON.stringify({checks:'adjustable split, quick open, keyboard shortcuts, Enter to send, middle-click close, working indicator, unsaved project marker',errors}));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
