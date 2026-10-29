// The download page's link preview (og:image, 1200 x 630): its headline on Barkdown's dark paper with the line an
// agent's edit leaves under it. Rendered in Chromium so the page's own typeface is used; the PNG is committed.
//   node scripts/site-social.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(path.join(root, 'app', 'package.json'))('playwright');
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'app', 'build', 'icon.png')).toString('base64');
const html = `<!doctype html><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600&display=block" rel="stylesheet">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; background: #191b18; color: #e7ebdf; font-family: "Schibsted Grotesk", sans-serif; }
  .card { box-sizing: border-box; height: 100%; padding: 64px 80px; display: grid; grid-template-rows: auto 1fr auto; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 600; }
  .brand img { width: 60px; height: 60px; margin: -6px; }
  h1 { align-self: center; margin: 0; font-weight: 500; font-size: 112px; line-height: .98; letter-spacing: -.045em; max-width: 9.5em; text-wrap: balance; }
  .edit { display: flex; align-items: center; gap: 14px; font-size: 26px; color: #9aa48e; }
  .edit::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: #b8d595; }
  .edit u { color: #b8d595; text-decoration-thickness: 2px; text-underline-offset: 6px; }
</style>
<div class="card"><div class="brand"><img src="${icon}" alt="">Barkdown for Mac</div><h1>Notes your agent can edit.</h1><p class="edit">Claude Code rewrote this headline. <u>Undo</u></p></div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(root, 'site', 'social.png') });
await browser.close();
console.log('site-social: wrote site/social.png');
