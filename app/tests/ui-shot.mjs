// Visual audit of the chrome: every popup menu, the ask dialog and each settings pane, light and
// dark, at desktop and narrow widths. Writes PNGs to test-results/ui for a human to look at; it
// asserts nothing. Uses a throwaway userData folder.
import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';
import { MOD } from './helpers/keys.mjs';
const require = createRequire(import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const out = path.join(appDir, 'test-results', 'ui');
fs.mkdirSync(out, { recursive: true });
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-ui-shot-'));
const app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--legacy', `--user-data=${userData}`], env: { ...process.env, ANTHROPIC_API_KEY: '', BARKDOWN_PROVIDER: 'api' } });
const page = await app.firstWindow();
await page.waitForSelector('#bw-documents .bw-nav', { timeout: 20000 });
await page.setViewportSize({ width: 1400, height: 880 });
const shot = async name => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png') }); console.log('shot', name); };
const esc = () => page.keyboard.press('Escape');

try {
  await page.locator('#bw-open-work').click(); await shot('menu-open-work');
  await page.locator('#bw-new-menu [data-new="chat"]').click(); await page.waitForTimeout(400);
  await page.locator('#bw-plus').click(); await shot('menu-plus'); await esc();
  await page.locator('#bw-favorites').click(); await shot('menu-favorites'); await esc();
  await page.locator('#bw-folder-context').click(); await shot('menu-project'); await esc();
  await page.evaluate(() => { const s = window.__barkdown.state; s.chats[s.current].provider = 'claude'; window.__barkdown.render(); });
  await page.locator('#bw-provider').click(); await shot('menu-provider'); await esc();
  await page.locator('#bw-model').click(); await shot('menu-model'); await esc();
  await page.locator('#bw-effort').click(); await shot('menu-effort'); await esc();
  await page.keyboard.press(`${MOD}+k`); await shot('palette'); await esc();
  await page.locator('#bw-new-doc').click(); await shot('ask-new-page'); await esc();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    await page.locator('#bw-settings').click();
    for (const pane of ['general', 'assistant', 'barkpark', 'shortcuts', 'about']) { await page.locator(`.bw-settings-nav [data-pane="${pane}"]`).click(); await shot(`settings-${pane}-${theme}`); }
    await page.locator('.bw-settings [data-act="cancel"]').click();
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = ''; });
  await page.setViewportSize({ width: 700, height: 600 });
  await page.locator('#bw-settings').click(); await shot('settings-narrow'); await esc();
  console.log('Screenshots in', out);
} finally {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
