import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-width-'));
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal(await page.evaluate(() => window.__barkdown.state.settings.chatWidth), 60);
  await page.evaluate(() => window.barkdown.settings.set({ chatWidth: 43 }));
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal(await page.evaluate(() => window.__barkdown.state.settings.chatWidth), 43);
  await page.locator('#bw-pages .bw-page-row').first().dblclick();
  // Keyboard dispatch tests the actual splitter Home handler without requiring the current mode to expose it.
  await page.locator('#bw-splitter').dispatchEvent('keydown', { key: 'Home', bubbles: true });
  await page.waitForFunction(() => window.__barkdown.state.settings.chatWidth === 60);
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(async () => (await window.barkdown.settings.get()).chatWidth === 60)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(await page.evaluate(async () => (await window.barkdown.settings.get()).chatWidth), 60);
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal(await page.evaluate(() => window.__barkdown.state.settings.chatWidth), 60);
  await page.evaluate(() => window.__barkdown.openPalette());
  await page.locator('#bw-palette-input').fill('Reset conversation width');
  assert.match(await page.locator('#bw-palette').innerText(), /Reset conversation width to 60%/);
  console.log('PASS new default 60, saved 43 retained, Home resets and persists 60');
} finally { await app.close(); }
