// End-to-end checks against the real Electron app, driven by Playwright.
// Uses a throwaway userData folder and a throwaway git repository, so nothing on the machine is touched.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { createRequire } from 'module';
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

const app = await electron.launch({ executablePath: require('electron'), args: [appDir, `--user-data=${userData}`], env: { ...process.env, ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', BARKDOWN_PROVIDER: 'api' } });
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
  await page.screenshot({ path: path.join(out, '01-start.png') });

  // Offline assistant run: message sent with Enter, reply arrives, and the named document opens beside the chat.
  await page.locator('#bw-prompt').fill('Open the Interaction notes and the website barkpark.cloud');
  await page.locator('#bw-prompt').press('Enter');
  await page.waitForFunction(() => document.querySelector('#bw-working')?.hidden === true && document.querySelectorAll('.bw-user-message').length === 1, null, { timeout: 20000 });
  step('offline reply rendered', (await page.locator('.bw-agent-copy').last().innerText()).includes('No Claude API key'));
  step('activity opened a document tab', (await page.locator('#bw-tabs [data-tab]').count()) >= 2);
  step('chat title derived from first message', (await page.locator('#bw-chat-title').innerText()).startsWith('Open the Interaction'));
  await page.screenshot({ path: path.join(out, '02-offline-run.png') });

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
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A sentence added by the end-to-end test.');
  await page.waitForFunction(() => /Saved · rev \d+/.test(document.querySelector('.bw-doc-pane:not([hidden]) #save-state')?.textContent || ''), null, { timeout: 8000 });
  step('document autosaved with a new revision', true);
  // Re-anchor the caret on the last paragraph before the slash command: after the autosave the editor
  // occasionally drops focus, which made this step flaky.
  await editor.locator('p').last().click();
  await page.keyboard.press('End');
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
  await page.keyboard.press('Control+k');
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
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n// edited in the e2e test\n');
  step('unsaved marker on project tab', (await page.locator('.bw-dot-dirty').count()) === 1);
  await page.keyboard.press('Control+s');
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

  // Pins restore navigation; per-chat workspaces are independent; state survives reload.
  await page.locator('#bw-tabs .bw-tab').first().hover();
  await page.locator('#bw-tabs [data-pin]').first().dispatchEvent('click');
  step('pin recorded', (await page.locator('#bw-pin-menu [data-restore]').count()) === 1);
  await page.keyboard.press('Escape');
  // Ctrl+W is a menu accelerator that closes the active work tab, not the window.
  const tabsBeforeClose = await page.locator('#bw-tabs [data-tab]').count();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'close-tab'));
  await page.waitForFunction(n => document.querySelectorAll('#bw-tabs [data-tab]').length === n - 1, tabsBeforeClose, { timeout: 5000 });
  step('Close tab accelerator closes one tab and keeps the window', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBeforeClose - 1 && !page.isClosed());
  const tabsBefore = await page.locator('#bw-tabs [data-tab]').count();
  await page.evaluate(() => window.__barkdown.createChat());
  step('new chat starts with an empty workspace', (await page.locator('#bw-tabs [data-tab]').count()) === 0);
  await page.locator('#bw-recent-chats [data-context]').nth(1).click();
  step('switching back restores the workspace', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBefore);
  await page.reload();
  await page.waitForSelector('#bw-documents .bw-nav', { timeout: 20000 });
  step('workspace persisted across reload', (await page.locator('#bw-tabs [data-tab]').count()) === tabsBefore && (await page.locator('.bw-user-message').count()) === 2);
  await page.screenshot({ path: path.join(out, '07-after-reload.png') });

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
