// End-to-end checks against the real Electron app, driven by Playwright.
// Uses a throwaway userData folder and a throwaway git repository, so nothing on the machine is touched.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { MOD, DOC_END } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const out = path.join(appDir, 'test-results');
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-userdata-'));
const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-repo-'));
fs.writeFileSync(path.join(repo, 'README.md'), '# Sample project\n\nHello.\n');
fs.mkdirSync(path.join(repo, 'src'));
fs.writeFileSync(path.join(repo, 'src', 'app.js'), 'export function hello() {\n  return "hi";\n}\n');
execSync('git init -q && git add . && git -c user.email=t@t -c user.name=t commit -qm init', { cwd: repo, shell: true });

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const results = [];
const step = (name, ok) => { results.push({ name, ok }); if (!ok) throw new Error('Failed: ' + name); };

const app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--legacy', `--user-data=${userData}`], env: { ...process.env, ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', BARKDOWN_PROVIDER: 'api' } });
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.waitForSelector('#bw-documents .bw-nav', { timeout: 20000 });
await page.setViewportSize({ width: 1400, height: 880 });

try {
  // Library seeded with two documents; app-wide sidebar has no folder picker.
  step('seeded documents appear as root pages', (await page.locator('#bw-pages .bw-page-row').count()) === 2);
  step('archive is collapsed and empty when everything is placed', (await page.locator('#bw-archive-toggle').innerText()).includes('0'));
  step('no sidebar folder picker', (await page.locator('.bw-sidebar [data-project-open], .bw-sidebar select').count()) === 0);
  const sidebarWidth = () => page.locator('.bw-sidebar').evaluate(el => Math.round(el.getBoundingClientRect().width));
  const sidebarGrip = page.getByRole('separator', { name: 'Sidebar width' });
  const gripBounds = await sidebarGrip.boundingBox();
  await page.mouse.move(gripBounds.x + gripBounds.width / 2, 220);
  await page.mouse.down();
  await page.mouse.move(gripBounds.x + gripBounds.width / 2 + 110, 220, { steps: 10 });
  await page.mouse.up();
  // The width settles a frame or more after the pointer is released; on a loaded machine that is not at once.
  await page.waitForFunction(() => Math.round(document.querySelector('.bw-sidebar').getBoundingClientRect().width) === 310, null, { timeout: 5000 }).catch(() => {});
  step('sidebar edge drags without changing the conversation split', await sidebarWidth() === 310 && await page.evaluate(() => window.__barkdown.state.settings.chatWidth === 60));
  await page.waitForFunction(async () => (await window.barkdown.settings.get()).sidebarWidth === 310, null, { timeout: 10000 });
  await page.reload();
  await page.waitForSelector('#bw-pages .bw-page-row');
  step('sidebar width restores from saved settings', await sidebarWidth() === 310);
  await sidebarGrip.focus();
  await page.keyboard.press('ArrowRight');
  step('sidebar edge supports keyboard resizing', await sidebarWidth() === 320);
  await sidebarGrip.dblclick();
  step('sidebar double click resets its width', await sidebarWidth() === 200);
  await page.setViewportSize({ width: 736, height: 880 });
  step('sidebar resize edge hides with the sidebar on narrow windows', await sidebarGrip.isHidden());
  await page.setViewportSize({ width: 1400, height: 880 });
  await page.screenshot({ path: path.join(out, '01-start.png') });

  // Missing authentication is a refused send with a retained draft, not a fake assistant run.
  await page.locator('#bw-prompt').fill('Open the Interaction notes and the website barkpark.cloud');
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.querySelector('#bw-working')?.hidden === true && document.querySelectorAll('.bw-user-message').length === 1, null, { timeout: 20000 });
  step('missing API authentication explains the next action', (await page.locator('.bw-error-line').last().innerText()).includes('Add a Claude API key'));
  step('missing authentication retains the original draft', (await page.locator('#bw-prompt').inputValue()).startsWith('Open the Interaction'));
  // Direct navigation remains available without any provider authentication.
  await page.evaluate(()=>{window.__barkdown.openTarget({kind:'doc',id:'interaction-notes',title:'Interaction notes'});window.__barkdown.openTarget({kind:'web',url:'https://barkpark.cloud',title:'barkpark.cloud'});});
  step('direct navigation opened work tabs without authentication', (await page.locator('#bw-tabs [data-tab]').count()) >= 2);
  step('chat title derived from first message', (await page.locator('#bw-chat-title').innerText()).startsWith('Open the Interaction'));
  await page.screenshot({ path: path.join(out, '02-missing-auth.png') });
  // Subsequent composer checks use the real API adapter with a controlled client.
  await app.evaluate(({app})=>{
    process.env.ANTHROPIC_API_KEY='synthetic-ui-key';
    const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/main/main.js');
    require('./agent').setClientFactory(()=>({messages:{stream(){const handlers={};return{on(name,fn){handlers[name]=fn;return this;},async finalMessage(){handlers.text?.('Controlled composer response.');return{stop_reason:'end_turn',content:[{type:'text',text:'Controlled composer response.'}],usage:{}};}};}}}));
  });

  // Image attachments: a pasted image shows as a thumbnail in the composer, is saved under userData, and
  // renders inside the sent message.
  await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#c62828'; g.fillRect(0, 0, 40, 30); const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'paste.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(file); document.querySelector('#bw-prompt').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await page.waitForSelector('#bw-attachments .bw-attachment img', { timeout: 10000 });
  step('pasted image shows as a composer thumbnail', (await page.locator('#bw-attachments .bw-attachment').count()) === 1);
  step('attachment saved under userData', fs.existsSync(path.join(userData, 'barkdown', 'attachments')) && fs.readdirSync(path.join(userData, 'barkdown', 'attachments')).some(f => f.endsWith('.png')));
  await page.locator('#bw-prompt').fill('What colour is this?');
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.querySelector('#bw-working')?.hidden === true && document.querySelectorAll('.bw-user-message').length === 2, null, { timeout: 20000 });
  step('sent message renders the image', (await page.locator('.bw-user-message').last().locator('.bw-user-images img').count()) === 1);
  step('composer strip cleared after sending', await page.locator('#bw-attachments').isHidden());
  await page.locator('.bw-user-images img').last().click();
  step('clicking the image opens the lightbox', await page.locator('#bw-lightbox').isVisible());
  await page.keyboard.press('Escape'); await page.locator('#bw-lightbox').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.screenshot({ path: path.join(out, '02b-image-message.png') });

  // Real document editing with autosave and revision.
  const docTab = page.locator('#bw-tabs [data-tab]').first();
  await docTab.click();
  await page.waitForSelector('.bw-doc-pane:not([hidden]) .ProseMirror', { timeout: 10000 });
  const editor = page.locator('.bw-doc-pane:not([hidden]) .ProseMirror');
  await editor.locator('p').first().click();
  await page.keyboard.press(DOC_END);
  await page.keyboard.press('Enter');
  await page.keyboard.type('A sentence added by the end-to-end test.');
  await page.waitForFunction(() => /Saved · rev \d+/.test(document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 8000 });
  step('document autosaved with a new revision', true);
  // Re-anchor the caret on the last paragraph before the slash command: after the autosave the editor
  // occasionally drops focus, which made this step flaky.
  await editor.locator('p').last().click();
  // Put the caret at the very end of the last paragraph (a click lands mid-text and End is a visual-line key).
  await page.evaluate(() => { const pm = document.querySelector('.bw-doc-pane:not([hidden]) .ProseMirror'); const p = [...pm.querySelectorAll('p')].pop(); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); });
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.closest('.bw-doc-pane:not([hidden]) .ProseMirror') != null, null, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.keyboard.type('/heading 2');
  try { await page.waitForSelector('.bw-doc-pane:not([hidden]) .bw-slash:not([hidden]) [data-slash="h2"][aria-selected="true"]', { timeout: 4000 }); } catch (error) { console.log('SLASH DEBUG', await page.evaluate(() => { const p = document.querySelector('.bw-doc-pane:not([hidden])'); return { slashHidden: p.querySelector('#slash').hidden, slash: p.querySelector('#slash').innerHTML.slice(0, 200), tail: p.querySelector('.ProseMirror').innerHTML.slice(-400), active: document.activeElement?.className }; })); throw error; }
  await page.keyboard.press('Enter');
  await page.keyboard.type('Slash heading');
  step('slash command created a heading', (await editor.locator('h2:has-text("Slash heading")').count()) === 1);
  await page.keyboard.press('Shift+Home');
  await page.waitForSelector('.bw-doc-pane:not([hidden]) .bw-bubble:not([hidden])', { timeout: 4000 });
  await page.locator('.bw-doc-pane:not([hidden]) .bw-bubble [data-types]').click();
  await page.locator('.bw-doc-pane:not([hidden]) .bw-bubble [data-type="quote"]').click();
  step('attached Types submenu changed the block', (await editor.locator('blockquote').count()) >= 1);
  await page.waitForFunction(() => /Saved · rev \d+/.test(document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 8000 });
  await page.screenshot({ path: path.join(out, '03-document-editing.png') });

  // Direct document mode hides the chat; linked documents open to the right.
  await page.locator('#bw-pages .bw-page-row:has-text("Interaction notes")').click();
  step('direct document mode hides chat', !(await page.locator('.bw-chat').isVisible()));
  await page.locator('.bw-doc-pane:not([hidden]) .ProseMirror a').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.bw-doc-pane:not([hidden]) .bw-path button').length >= 2, null, { timeout: 8000 });
  step('linked document extended the path', true);
  await page.screenshot({ path: path.join(out, '04-document-path.png') });

  // Quick open returns to the chat.
  await page.keyboard.press(`${MOD}+k`);
  await page.locator('#bw-palette-input').fill('open the interaction');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.bw-chat:visible', { timeout: 5000 });
  step('quick open switched back to the chat', true);

  // Working folder, project editor, file edit, save, and review diff.
  await page.evaluate(folder => window.__barkdown.setFolder(folder), repo);
  step('folder shown in composer chip', (await page.locator('#bw-folder-label').innerText()) === path.basename(repo));
  await page.evaluate(() => window.__barkdown.openProject(true));
  await page.waitForSelector('.bw-file-tree:not([hidden]) [data-file="src/app.js"]', { timeout: 8000 });
  step('expanded editor hides chat', !(await page.locator('.bw-chat').isVisible()));
  await page.locator('[data-file="src/app.js"]').click();
  await page.waitForSelector('.cm-content', { timeout: 8000 });
  await page.locator('.cm-content').click();
  await page.keyboard.press(DOC_END);
  await page.keyboard.type('\n// edited in the e2e test\n');
  step('unsaved marker on project tab', (await page.locator('.bw-dot-dirty').count()) === 1);
  await page.keyboard.press(`${MOD}+s`);
  await page.waitForFunction(() => (document.querySelector('.bw-editor-footer #status')?.textContent || '').includes('saved'), null, { timeout: 8000 });
  step('file saved to disk', fs.readFileSync(path.join(repo, 'src', 'app.js'), 'utf8').includes('edited in the e2e test'));
  await page.screenshot({ path: path.join(out, '05-project-editor.png') });
  await page.locator('[data-act="expand"]').click();
  step('back to chat restores conversation', await page.locator('.bw-chat').isVisible());
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'review' }));
  await page.waitForSelector('.bw-code .add', { timeout: 10000 });
  step('review shows the real diff', (await page.locator('.bw-code .add:has-text("edited in the e2e test")').count()) >= 1);
  await page.screenshot({ path: path.join(out, '06-review.png') });

  // Website tab loads a real page inside a webview.
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'web', url: 'https://example.com', title: 'example.com' }));
  await page.waitForFunction(() => document.querySelector('.bw-pane:not([hidden]) webview')?.getAttribute('src')?.includes('example.com'), null, { timeout: 8000 });
  step('website tab mounted a webview', true);

  // Favorites bookmark one tab and reopen it later, even after it was closed; tabs rename in place.
  await page.locator('#bw-tabs .bw-tab').first().hover();
  await page.locator('#bw-tabs [data-fav]').first().dispatchEvent('click');
  step('starring a tab records a favorite', (await page.evaluate(() => window.__barkdown.state.favorites.length)) === 1 && (await page.locator('#bw-tabs [data-fav].on').count()) === 1);
  const favTab = await page.locator('#bw-tabs [data-tab]').first().getAttribute('data-tab');
  const favLabel = await page.locator('#bw-tabs [data-tab]').first().locator('.bw-tab-label').innerText();
  await page.locator(`#bw-tabs [data-close="${favTab}"]`).dispatchEvent('click');
  await page.locator('#bw-favorites').click();
  const favRow = page.locator('#bw-fav-menu [data-open]').first();
  const favBox = await favRow.locator('.bw-fav-label').boundingBox();
  const removeBox = await page.locator('#bw-fav-menu [data-unfav]').first().boundingBox();
  step('the favorites menu shows the name, wider than its remove button', (await favRow.locator('.bw-fav-label').innerText()) === favLabel && favBox && removeBox && favBox.width > 60 && removeBox.width < 40);
  await favRow.click();
  step('a favorite reopens its tab after it was closed', (await page.locator('#bw-tabs .bw-tab.active .bw-tab-label').innerText()) === favLabel);
  await page.locator('#bw-tabs .bw-tab.active [data-tab]').dblclick();
  await page.locator('#bw-tabs .bw-tab-rename').fill('Renamed tab');
  await page.locator('#bw-tabs .bw-tab-rename').press('Enter');
  await page.waitForTimeout(400);
  step('double-clicking a tab renames it and its favorite', (await page.locator('#bw-tabs .bw-tab.active .bw-tab-label').innerText()) === 'Renamed tab' && (await page.evaluate(() => window.__barkdown.state.favorites[0].label)) === 'Renamed tab');
  await page.locator('#bw-plus').click();
  await page.locator('#bw-new-menu [data-new="chat"]').click();
  await page.waitForSelector('.bw-side-chat', { timeout: 5000 });
  await page.locator('#bw-tabs .bw-tab.active [data-tab]').dblclick();
  await page.locator('#bw-tabs .bw-tab-rename').fill('Brainstorm');
  await page.locator('#bw-tabs .bw-tab-rename').press('Enter');
  step('renaming a side chat tab names the side chat', (await page.evaluate(() => { const chat = window.__barkdown.state.chats[window.__barkdown.state.current]; const tab = chat.tabs.find(t => t.id === chat.active); return window.__barkdown.state.chats[tab.sideChatId]?.title; })) === 'Brainstorm' && (await page.locator('.bw-side-chat #title').innerText()) === 'Brainstorm');
  await page.locator('#bw-tabs .bw-tab.active').hover();
  await page.locator('#bw-tabs .bw-tab.active [data-fav]').dispatchEvent('click');
  const sideTab = await page.locator('#bw-tabs .bw-tab.active [data-tab]').getAttribute('data-tab');
  await page.locator(`#bw-tabs [data-close="${sideTab}"]`).dispatchEvent('click');
  await page.locator('#bw-favorites').click();
  await page.locator('#bw-fav-menu [data-open]').first().click();
  step('a favorited side chat comes back by name', (await page.locator('#bw-tabs .bw-tab.active .bw-tab-label').innerText()) === 'Brainstorm' && (await page.locator('.bw-side-chat #title').innerText()) === 'Brainstorm');
  await page.locator(`#bw-tabs [data-close="${sideTab}"]`).dispatchEvent('click').catch(() => {});
  await page.keyboard.press('Escape');
  // Verbose transcript: a reply with tool steps renders expandable steps with the command, its output and a
  // line diff, plus a change card with counts and View/Undo per file.
  await page.evaluate(() => { const chat = window.__barkdown.state.chats[window.__barkdown.state.current]; chat.messages.push({ role: 'assistant', text: 'Done.', at: new Date().toISOString(), streaming: true, provider: 'claude', tools: [
    { tool: 'Bash', input: { command: 'npm test -- --grep "smoke" | tail -n 3', description: 'Run the smoke tests' }, id: 't1', done: true, ok: true, output: 'All 3 checks passed.' },
    { tool: 'Edit', input: { file_path: 'src/app.js', old_string: 'const a = 1;', new_string: 'const a = 2;\nconst b = 3;' }, id: 't2', done: true, ok: true },
    { tool: 'Write', input: { file_path: 'src/new.js', content: 'export const x = 1;' }, id: 't3', done: true, ok: true },
    { tool: 'create_document', input: { title: 'Meeting notes', markdown: '# Meeting notes\n\n- decide the venue\n- book the room' }, id: 't4', done: true, ok: true, output: 'Created document meeting-notes' },
    { tool: 'read_document', input: { id: 'overview' }, id: 't5', done: false },
  ], parts: [{ kind: 'thinking', text: 'Let me run the tests first.', closed: true }, { kind: 'tool', id: 't1' }, { kind: 'text', text: 'Tests pass, so on to the edit.', closed: true }, { kind: 'tool', id: 't2' }, { kind: 'tool', id: 't3' }, { kind: 'tool', id: 't4' }, { kind: 'tool', id: 't5' }, { kind: 'text', text: 'Done.' }], usage: { cost: 0.061, durationMs: 140000, tokens: { input: 3000, output: 400 } }, events: [{ label: 'Proposed a change to Overview', target: { kind: 'doc', id: 'overview', title: 'Overview' }, at: new Date().toISOString() }], approvals: [] }); chat.workingLabel = 'Reading overview…'; chat.runId = 'fake'; chat.runProvider = 'codex'; window.__barkdown.render(); });
  step('the reply is a timeline: thinking, then the step, then the text, in order', await page.evaluate(() => { const nodes = [...document.querySelectorAll('#bw-transcript .bw-thought, #bw-transcript .bw-step, #bw-transcript .bw-agent-copy')].slice(-8).map(n => n.className.split(' ')[0]); return nodes[0] === 'bw-thought' && nodes[1] === 'bw-step' && nodes[2] === 'bw-agent-copy' && nodes[3] === 'bw-step'; }));
  step('a command step is labelled with its description and shows the coloured command', (await page.locator('.bw-step').nth(0).locator('summary').innerText()).includes('Run the smoke tests') && (await page.locator('.bw-step').nth(0).locator('.bw-cmd .c').first().innerText()) === 'npm' && (await page.locator('.bw-step').nth(0).locator('.bw-cmd .s').count()) === 1);
  step('the live footer shows elapsed time and what is happening, with the running provider mark', (await page.locator('.bw-reply-foot.live').innerText()).includes('Reading overview…') && (await page.locator('.bw-reply-foot.live .bw-mark-codex').count()) === 1 && (await page.locator('#bw-transcript .bw-agent-copy').last().innerText()).trim() === 'Done.');
  step('tool calls render as steps', (await page.locator('.bw-step').count()) === 5);
  step('a created page shows its title and a rendered preview', (await page.locator('.bw-step').nth(3).locator('summary').innerText()).includes('Created page “Meeting notes”') && (await page.locator('.bw-step').nth(3).locator('.bw-doc-preview li').count()) === 2);
  step('a running step and the working indicator say what is happening', (await page.locator('.bw-step').nth(4).locator('summary').innerText()).includes('Reading overview…') && (await page.locator('#bw-working').innerText()).includes('Reading overview…'));
  await page.evaluate(() => { const chat = window.__barkdown.state.chats[window.__barkdown.state.current]; chat.runId = null; chat.workingLabel = ''; chat.messages.at(-1).streaming = false; chat.messages.at(-1).tools.pop(); window.__barkdown.render(); });
  step('steps are open by default and show the command and its output', (await page.locator('.bw-step').nth(0).locator('.bw-cmd').innerText()).includes('npm test') && (await page.locator('.bw-step').nth(0).locator('.bw-out').innerText()).includes('All 3 checks passed'));
  await page.locator('.bw-step').nth(0).locator('summary').click();
  await page.evaluate(() => window.__barkdown.render());
  step('a step the person collapsed stays collapsed across re-renders', !(await page.locator('.bw-step').nth(0).evaluate(d => d.open)) && (await page.locator('.bw-step').nth(1).evaluate(d => d.open)));
  step('an immediate streaming render cannot race the queued disclosure toggle', await page.evaluate(() => {
    const first = () => document.querySelector('.bw-step');
    first().querySelector('summary').click(); window.__barkdown.render();
    if (!first().open) return false;
    first().querySelector('summary').click(); window.__barkdown.render();
    return !first().open;
  }));
  step('the finished footer shows time, tokens, cost and provider', (await page.locator('.bw-reply-foot').last().innerText()).includes('2m 20s · 3.4k tokens · $0.061 · Claude Code') && (await page.locator('.bw-reply-foot').last().locator('.bw-mark-claude').count()) === 1);
  step('an edit step shows a line diff', (await page.locator('.bw-step').nth(1).locator('.bw-diff .add').count()) === 2 && (await page.locator('.bw-step').nth(1).locator('.bw-diff .del').count()) === 1);
  step('the change card lists files and the document with counts', (await page.locator('.bw-changes-head').innerText()).includes('Edited 2 files · 1 document') && (await page.locator('.bw-change').count()) === 3 && (await page.locator('.bw-change').nth(0).innerText()).includes('+2') && (await page.locator('[data-undo-file]').count()) === 2);
  await page.screenshot({ path: path.join(out, '02c-verbose-reply.png') });

  // Model and effort chips set the chat's own choices.
  await page.locator('#bw-model').click();
  await page.locator('#bw-model-menu [data-choice="claude-sonnet-5"]').click();
  step('model chip stores the chat model', (await page.locator('#bw-model-label').innerText()) === 'Sonnet 5' && (await page.evaluate(() => window.__barkdown.state.chats[window.__barkdown.state.current].model)) === 'claude-sonnet-5');
  // Effort exists for the login providers only; the controlled run uses the API loop, so switch the chat to Claude Code for the chip.
  await page.evaluate(() => { const chat = window.__barkdown.state.chats[window.__barkdown.state.current]; chat.provider = 'claude'; chat.model = null; chat.effort = null; window.__barkdown.render(); });
  step('the chips name the defaults in force instead of saying Model and Effort', (await page.locator('#bw-model-label').innerText()).endsWith(' (default)') && /^(Low|Medium|High|Extra high|Max) [(]default[)]$/.test(await page.locator('#bw-effort-label').innerText()));
  await page.locator('#bw-effort').click();
  await page.locator('#bw-effort-menu [data-choice="high"]').click();
  step('effort chip stores the chat effort', (await page.evaluate(() => window.__barkdown.state.chats[window.__barkdown.state.current].effort)) === 'high');
  await page.evaluate(() => { const chat = window.__barkdown.state.chats[window.__barkdown.state.current]; chat.provider = 'api'; window.__barkdown.render(); });

  // Terminal work tab: a shell in the working folder that runs what is typed.
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.waitForSelector('.bw-terminal #in', { timeout: 10000 });
  await page.locator('.bw-terminal #in').fill('echo hello-from-terminal');
  await page.locator('.bw-terminal #in').press('Enter');
  await page.waitForFunction(() => (document.querySelector('.bw-terminal .bw-term-out')?.textContent || '').includes('hello-from-terminal\n'), null, { timeout: 20000 }).catch(() => {});
  const termText = await page.locator('.bw-terminal .bw-term-out').innerText();
  if (termText.split('hello-from-terminal').length < 3) console.log('TERM DEBUG', JSON.stringify(termText.slice(0, 400)));
  step('terminal tab runs a command and shows its output', termText.split('hello-from-terminal').length >= 3);
  await page.screenshot({ path: path.join(out, '02d-terminal.png') });

  // Ctrl+W is a menu accelerator that closes the active work tab, not the window.
  const tabsBeforeClose = await page.locator('#bw-tabs [data-tab]').count();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'close-tab'));
  await page.waitForFunction(n => document.querySelectorAll('#bw-tabs [data-tab]').length === n - 1, tabsBeforeClose, { timeout: 5000 });
  step('Close tab accelerator closes one tab and keeps the window', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBeforeClose - 1 && !page.isClosed());
  const tabsBefore = await page.locator('#bw-tabs [data-tab]').count();
  const previousChat = await page.evaluate(() => window.__barkdown.state.current);
  await page.evaluate(() => window.__barkdown.createChat());
  step('new chat starts with an empty workspace', (await page.locator('#bw-tabs [data-tab]').count()) === 0);
  step('an empty workspace collapses and the chat takes the width', await page.evaluate(() => document.getElementById('app').classList.contains('bw-nowork') && getComputedStyle(document.querySelector('.bw-workspace')).display === 'none' && getComputedStyle(document.getElementById('bw-open-work')).display !== 'none'));
  await page.locator('#bw-open-work').click();
  step('the open-work button offers the work tab menu', await page.locator('#bw-new-menu').isVisible());
  await page.keyboard.press('Escape'); await page.evaluate(() => document.body.click());
  await page.locator(`#bw-recent-chats [data-context="${previousChat}"]`).click();
  step('switching back restores the workspace', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBefore);
  await page.reload();
  await page.waitForSelector('#bw-documents .bw-nav', { timeout: 20000 });
  // The navigation appears before the tabs and the conversation have rendered.
  await page.waitForFunction(n => document.querySelectorAll('#bw-tabs [data-tab]').length === n && document.querySelectorAll('.bw-user-message').length === 2, tabsBefore, { timeout: 10000 }).catch(() => {});
  step('workspace persisted across reload', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBefore && (await page.locator('.bw-user-message').count()) === 2);
  await page.screenshot({ path: path.join(out, '07-after-reload.png') });

  // Menus open against the control that opened them, inside the window, and all close the same way.
  const box = sel => page.locator(sel).boundingBox();
  await page.locator('#bw-plus').click();
  { const m = await box('#bw-new-menu'), b = await box('#bw-plus');
    step('the new-tab menu hangs below its button with matching right edges', m && b && m.y >= b.y + b.height && Math.abs((m.x + m.width) - (b.x + b.width)) < 4 && m.x + m.width <= 1400); }
  await page.locator('#bw-transcript').click({ position: { x: 20, y: 20 } });
  step('clicking elsewhere closes the menu and resets its button', await page.locator('#bw-new-menu').isHidden() && (await page.locator('#bw-plus').getAttribute('aria-expanded')) === 'false');
  await page.locator('#bw-folder-context').click();
  { const m = await box('#bw-project-menu'), b = await box('#bw-folder-context');
    step('the working-folder menu opens above its chip, left-aligned', m && b && m.y + m.height <= b.y && Math.abs(m.x - b.x) < 4); }
  await page.keyboard.press('Escape');
  step('Escape closes a menu', await page.locator('#bw-project-menu').isHidden());
  await page.evaluate(() => { const s = window.__barkdown.state; s.chats[s.current].provider = 'claude'; s.chats[s.current].model = null; window.__barkdown.render(); });
  await page.locator('#bw-provider').click();
  step('the provider chip opens a menu instead of cycling', (await page.locator('#bw-provider-menu [data-choice]').count()) === 3 && (await page.locator('#bw-provider-menu [aria-selected="true"]').innerText()).includes('Claude Code'));
  await page.locator('#bw-provider-menu [data-choice="codex"]').click();
  step('choosing a provider updates the chip', (await page.locator('#bw-provider-label').innerText()).startsWith('Codex'));
  await page.evaluate(() => { const s = window.__barkdown.state; s.chats[s.current].provider = 'claude'; window.__barkdown.render(); });
  await page.locator('#bw-model').click();
  { const m = await box('#bw-model-menu'), b = await box('#bw-model'); step('the model menu opens above its chip', m && b && m.y + m.height <= b.y); }
  await page.locator('#bw-model-menu [data-custom]').click();
  await page.waitForSelector('.bw-ask input', { timeout: 5000 });
  step('"Other model id" asks in an app dialog (Electron has no prompt())', await page.locator('.bw-ask input').isVisible() && await page.locator('#bw-model-menu').isHidden());
  await page.locator('.bw-ask input').fill('claude-test-model');
  await page.locator('.bw-ask input').press('Enter');
  step('the typed model id lands on the chip', (await page.locator('#bw-model-label').innerText()).includes('claude-test-model'));
  await page.evaluate(() => { const s = window.__barkdown.state; s.chats[s.current].model = null; window.__barkdown.render(); });

  // New page goes through the same dialog.
  const pagesBefore = await page.locator('#bw-pages .bw-page-row').count();
  await page.locator('#bw-new-doc').click();
  await page.waitForSelector('.bw-ask input', { timeout: 5000 });
  await page.locator('.bw-ask input').fill('Dialog page');
  await page.locator('.bw-ask input').press('Enter');
  await page.waitForFunction(n => document.querySelectorAll('#bw-pages .bw-page-row').length === n + 1, pagesBefore, { timeout: 5000 });
  step('New document asks for a title in a dialog and creates the page', (await page.locator('#bw-pages .bw-page-row').count()) === pagesBefore + 1 && (await page.locator('#bw-tabs .bw-tab.active .bw-tab-label').innerText()) === 'Dialog page');
  const tableDoc = await page.evaluate(() => window.barkdown.docs.create({ title: 'Table page', markdown: '| Mode | What it does |\n| --- | --- |\n| Append | Adds blocks |\n| Replace | Rewrites |\n' }));
  await page.evaluate(id => window.__barkdown.openTarget({ kind: 'doc', id, source: 'local' }), tableDoc.id);
  await page.waitForSelector('.ProseMirror table', { timeout: 8000 });
  step('a Markdown table in a document renders as a table', (await page.locator('.ProseMirror table th').count()) === 2 && (await page.locator('.ProseMirror table td').count()) === 4);
  await page.locator('#bw-recent-chats [data-context]').first().click({ button: 'right' });
  await page.waitForSelector('.bw-ask[role="alertdialog"]', { timeout: 5000 });
  step('deleting a chat asks in an app dialog', (await page.locator('.bw-ask[role="alertdialog"] h2').innerText()) === 'Delete chat?');
  await page.locator('.bw-ask [data-cancel]').click();
  step('cancelling keeps the chat', await page.locator('.bw-ask').count() === 0 && (await page.locator('#bw-recent-chats [data-context]').count()) >= 2);

  // Settings: panes, live theme preview, cancel reverts, save persists.
  await page.keyboard.press('Control+,');
  await page.waitForSelector('.bw-settings', { timeout: 5000 });
  step('settings opens as a sheet with five panes and General first', (await page.locator('.bw-settings-nav [data-pane]').count()) === 5 && await page.locator('section[data-pane="general"]').isVisible() && await page.locator('#dirty').isHidden());
  await page.locator('#theme [data-value="dark"]').click();
  step('choosing a theme previews it and marks the sheet dirty', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark' && await page.locator('#dirty').isVisible());
  await page.locator('.bw-settings [data-act="cancel"]').click();
  step('cancel reverts the preview', (await page.evaluate(() => document.documentElement.dataset.theme || '')) === '' && (await page.locator('.bw-settings').count()) === 0);
  await page.locator('#bw-settings').click();
  await page.locator('.bw-settings-nav [data-pane="assistant"]').click();
  step('the Assistant pane shows the three providers with their status', await page.locator('section[data-pane="assistant"]').isVisible() && await page.locator('section[data-pane="general"]').isHidden() && (await page.locator('.bw-card').count()) === 3 && (await page.locator('.bw-card[data-provider="api"] .bw-badge').innerText()) === 'From ANTHROPIC_API_KEY');
  await page.locator('.bw-settings-nav [data-pane="shortcuts"]').click();
  step('the Shortcuts pane lists the app shortcuts', (await page.locator('section[data-pane="shortcuts"] .bw-keys tr').count()) >= 15);
  await page.locator('.bw-settings-nav [data-pane="general"]').click();
  await page.locator('#theme [data-value="dark"]').click();
  await page.locator('.bw-settings [data-act="save"]').click();
  await page.waitForFunction(() => !document.querySelector('.bw-settings'), null, { timeout: 5000 });
  step('save persists the theme', (await page.evaluate(() => window.__barkdown.state.settings.theme)) === 'dark' && (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.screenshot({ path: path.join(out, '08-settings-dark.png') });
  await page.keyboard.press('Control+,');
  await page.waitForSelector('.bw-settings', { timeout: 5000 });
  await page.locator('#theme [data-value="system"]').click();
  await page.locator('.bw-settings [data-act="save"]').click();
  await page.waitForFunction(() => !document.querySelector('.bw-settings'), null, { timeout: 5000 });

  const relevant = errors.filter(e => !/Autofill|devtools|ERR_BLOCKED_BY_RESPONSE|Electron Security Warning|CSP/i.test(e));
  step('no renderer errors', relevant.length === 0 || (console.error(relevant), false));
} finally {
  console.log(JSON.stringify({ results, errors: errors.slice(0, 10), screenshots: out }, null, 1));
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
}
if (results.some(r => !r.ok)) process.exit(1);
console.log(`All ${results.length} desktop checks passed.`);
