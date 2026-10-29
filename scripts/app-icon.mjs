// Barkdown's application icon, drawn from the app's own mark (the moss square with a lowercase b in the sidebar).
// Renders app/build/icon.html in Chromium at 1024 px, then writes what electron-builder reads from app/build:
// icon.png (1024, also used by the download page) and icon.icns (every macOS size). Run on a Mac after changing
// the drawing; the outputs are committed, so builds need neither the font nor this script.
//   node scripts/app-icon.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const build = path.join(root, 'app', 'build');
const { chromium } = createRequire(path.join(root, 'app', 'package.json'))('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(build, 'icon.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => document.fonts.check('900 600px "Schibsted Grotesk"'));
await page.screenshot({ path: path.join(build, 'icon.png'), omitBackground: true });
await browser.close();
const set = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-icon-')) + '/icon.iconset';
fs.mkdirSync(set);
for (const size of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) {
  const px = size * scale, name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
  execFileSync('sips', ['-z', String(px), String(px), path.join(build, 'icon.png'), '--out', path.join(set, name)], { stdio: 'ignore' });
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(build, 'icon.icns')]);
fs.rmSync(path.dirname(set), { recursive: true, force: true });
console.log('app-icon: wrote app/build/icon.png and app/build/icon.icns');
