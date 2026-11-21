import { openFixturePaper } from './lib/paper-fixture.mjs';
import { ownedRuntime } from './lib/bp-runner.mjs';
// Screenshot helper: open the scratch paper in the real window (light and dark) for a visual check.
// Usage: node tests/paper-shot.mjs [slug]. Not part of `npm test`.
import { _electron as electron } from './lib/playwright.mjs';
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { fixtureFolder } from './lib/fixture-folder.mjs';
const require = createRequire(import.meta.url);
const SLUG = process.argv[2] || 'barkdown-editor-test';
// The app below reads through the Barkpark CLI: refuse unless this run started its own Barkpark, and pin the CLI to it.
ownedRuntime();
const userData = fixtureFolder('bd-shot-');
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--legacy', `--user-data=${userData}`], env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' } });
const page = await app.firstWindow();
await page.waitForSelector('#bw-pages .bw-page-row');
await page.setViewportSize({ width: 1400, height: 900 });
await page.evaluate(async () => { window.__barkdown.state.settings = await window.barkdown.settings.set({ barkpark: { enabled: true, viaCli: true, writes: true } }); await window.__barkdown.refreshLibrary(); });
await page.waitForFunction(() => window.__barkdown.state.barkparkDocs.length > 0, null, { timeout: 90000 });
await openFixturePaper(page, SLUG);
await page.waitForSelector('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror', { timeout: 60000 });
await page.waitForTimeout(800);
const pm = page.locator('.bw-paper-pane:not([hidden]) bp-paper-canvas .ProseMirror');
await pm.locator('p').first().hover();
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/20-paper-light.png' });
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/21-paper-dark.png' });
await app.close(); fs.rmSync(userData, { recursive: true, force: true });
console.log('shots written');
