const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');
const { pathToFileURL } = require('url');
const assert = require('assert/strict');
const repository = 'C:/Users/Frikk/.codex/worktrees/windows-installer/barkdown';
const { chromium } = createRequire(repository + '/package.json')('playwright');
const out = repository + '/docs/cycles/evidence/C106/roadmap-10';
assert(!fs.existsSync(out));
fs.mkdirSync(out);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const externalRequests = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1760, height: 1130 }, deviceScaleFactor: 1, colorScheme: 'dark' });
    await page.route(/^https?:/, route => { externalRequests.push(route.request().url()); return route.abort(); });
    await page.goto(pathToFileURL(repository + '/docs/images/roadmap.svg').href);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() => [...document.querySelectorAll('text')].map(t => ({ text: t.textContent, ...(() => { const b = t.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; })() })));
    await page.screenshot({ path: out + '/roadmap.png', animations: 'disabled' });
    assert.equal(externalRequests.length, 0);
    fs.writeFileSync(out + '/capture.json', JSON.stringify({ at: new Date().toISOString(), viewport: { width: 1760, height: 1130 }, theme: 'dark', svgSha256: sha(repository + '/docs/images/roadmap.svg'), generatorSha256: sha(repository + '/scripts/generate-roadmap.mjs'), imageSha256: sha(out + '/roadmap.png'), externalRequests, geometry, status: 'captured; actual image inspection pending', scope: 'Generated root documentation roadmap only. App/capture-map inputs unchanged; no formal app approval or stage grant.' }, null, 2) + '\n');
    fs.copyFileSync(__filename, out + '/producer.cjs');
    console.log({ file: out + '/roadmap.png', textItems: geometry.length, externalRequests: externalRequests.length });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
