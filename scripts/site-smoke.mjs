// The download page's smoke test, run on the built site before .github/workflows/site.yml publishes it (and by
// hand: node scripts/site-smoke.mjs <built-site-folder>). Serves the folder, opens it in Chromium and refuses a
// page that would greet people broken: console errors, a download that does not answer, a scene that does not
// come up for its turn, quick open or Undo that do nothing, recordings loaded before anyone asked, more than
// 300 KB of the page's own files before the first scroll, or a phone layout that scrolls sideways.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dir = path.resolve(process.argv[2] || '.site');
const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  const file = path.join(dir, name.endsWith('/') ? name + 'index.html' : name);
  if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'content-length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const passed = [];
try {
  const latest = JSON.parse(fs.readFileSync(path.join(dir, 'latest.json'), 'utf8'));
  for (const arch of ['arm64', 'x64']) {
    const answer = await fetch(latest[arch].url, { method: 'HEAD', redirect: 'follow' });
    assert.equal(answer.status, 200, `${latest[arch].name} answers`);
    assert.ok(Number(answer.headers.get('content-length')) > 100 * 1024 * 1024, `${latest[arch].name} is a whole disk image`);
  }
  passed.push(`Both downloads of ${latest.tag} answer`);

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], own = new Map();
  page.on('pageerror', error => errors.push(String(error)));
  // GitHub's API may refuse an anonymous runner (rate limit); the page then keeps latest.json, which is the point.
  page.on('console', message => { if (message.type() === 'error' && !/api\.github\.com|403|rate limit/i.test(message.text())) errors.push(message.text()); });
  page.on('response', async response => { if (response.url().startsWith(url)) own.set(response.url(), Number(response.headers()['content-length'] || 0)); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const firstLoad = [...own.values()].reduce((a, b) => a + b, 0);
  const media = [...own.keys()].filter(u => /\/media\/.+\.(webm|mp4)$/.test(u));
  assert.deepEqual(media, [], 'no recording loads before someone asks for it');
  assert.ok(firstLoad < 300 * 1024, `first load is ${Math.round(firstLoad / 1024)} KB, over 300 KB`);
  passed.push(`First load: ${Math.round(firstLoad / 1024)} KB of the page's own files, no recordings`);

  await page.waitForFunction(() => document.getElementById('download').href.endsWith('.dmg'), null, { timeout: 15000 });
  assert.match(await page.locator('#download').getAttribute('href'), /\/releases\/download\/v[^/]+\/Barkdown-[^/]+-(arm64|x64)\.dmg$/);
  passed.push('The download button points at a release disk image');

  await page.locator('#edit.shown').waitFor({ timeout: 10000 });
  await page.click('#undo');
  assert.equal(await page.locator('#live').textContent(), 'A notes app where an agent helps you write.');
  await page.click('#undo');
  assert.equal(await page.locator('#live').textContent(), 'Notes your agent can edit.');
  passed.push('The headline edit plays; Undo and Redo work');

  const turns = await page.$$eval('.turn', list => list.map(t => [t.id, t.dataset.scene]));
  for (const [id, scene] of turns) {
    await page.evaluate(id => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
    await page.waitForFunction(scene => document.querySelector('#stage .scene.on')?.dataset.scene === scene, scene, { timeout: 5000 });
  }
  passed.push(`Each of the ${turns.length} turns brings up its scene`);

  await page.keyboard.press('Control+k');
  await page.locator('.palette:not([hidden])').waitFor({ timeout: 3000 });
  await page.keyboard.type('get started');
  assert.match(await page.locator('#qo-list').innerText(), /Get started/);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.palette[hidden]').count(), 'Esc closes quick open');
  passed.push('Quick open opens with Ctrl+K, searches the page and closes with Esc');

  assert.deepEqual(errors, [], 'no errors in the console');
  passed.push('No console errors');

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'the phone layout does not scroll sideways');
  passed.push('At 390 px nothing scrolls sideways');
  console.log(passed.map(line => 'site-smoke: ' + line).join('\n'));
} finally { await browser.close(); server.close(); }
