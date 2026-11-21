// The chain's last step. Every chain script that takes pictures loads the screenshot check, which at exit prints
// "screenshots checked: N" and adds the same N to this run's record (tests/lib/screenshot-count.mjs). A script
// whose check looked at no picture, or that left no count, is named here. A script may say 0 only when every
// picture in it sits on a failure path, read from the script itself (tests/lib/failure-path.mjs); there is no list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDir, RECORD, readRecord } from './lib/screenshot-count.mjs';
import { screenshotPaths, zeroProblem } from './lib/failure-path.mjs';

test('every chain script that takes pictures reported "screenshots checked: N" in this run, N above 0 unless all its pictures are on failure paths', () => {
  const chain = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).scripts.test;
  assert.match(chain, /^node tests\/lib\/screenshot-count\.mjs && /, 'the chain starts the record');
  assert.match(chain, / && node --test tests\/screenshot-count\.test\.mjs$/, 'the chain ends with this row');
  assert.ok(fs.existsSync(RECORD), 'this run has a record: run the whole chain (npm test)');
  const scripts = [...new Set(chain.match(/tests\/[^\s"&|;]+/g))].filter(file => fs.existsSync(path.join(appDir, file)));
  // This row names pictures only as text, in the read's cases below; it loads no screenshot check and leaves no count.
  const self = path.relative(appDir, fileURLToPath(import.meta.url)).split(path.sep).join('/');
  const shooting = scripts.filter(file => file !== self && /\.screenshot\(/.test(fs.readFileSync(path.join(appDir, file), 'utf8')));
  assert.ok(shooting.length >= 20, `found ${shooting.length} screenshot scripts in the chain`);
  const record = readRecord();
  const problems = shooting.flatMap(file => {
    const counts = record.filter(line => line.script === file).map(line => line.screenshots);
    if (!counts.length) return [`${file}: no count line`];
    if (counts.every(n => n > 0)) return [];
    if (counts.some(n => !(n > 0) && n !== 0)) return [`${file}: screenshots checked: ${counts.join(', ')}`];
    const why = zeroProblem(fs.readFileSync(path.join(appDir, file), 'utf8'), file);
    return why ? [`${file}: screenshots checked: 0, but ${why}`] : [];
  });
  assert.deepEqual(problems, []);
});

// The read behind a 0: each form, by the script that has it. profile-ui.live.mjs takes pictures only when a step
// times out (a catch that rethrows) or the run is stuck (a timer that ends in process.exit(1)).
test('a picture is on a failure path only in a catch that fails the run or a function that ends in process.exit(n), n not 0', () => {
  const ui = fs.readFileSync(path.join(appDir, 'tests/profile-ui.live.mjs'), 'utf8');
  assert.equal(zeroProblem(ui, 'tests/profile-ui.live.mjs'), null, 'profile-ui.live.mjs takes pictures only on failure paths');
  assert.equal(screenshotPaths(ui).failure.length, 2, 'both of its pictures are read as failure paths');
  const cases = {
    'try { await go(); } catch (e) { await page.screenshot(); throw e; }': null,
    'try { await go(); } catch { await page.screenshot(); process.exit(2); }': null,
    "setTimeout(async () => { await page.screenshot(); process.exit(1); }, 9).unref();": null,
    'await page.screenshot();': /passing path \(line 1\)/,
    'try { await go(); } catch { await page.screenshot(); }': /passing path/,
    'try { await go(); } catch { await page.screenshot(); process.exit(0); }': /passing path/,
    "setTimeout(async () => { await page.screenshot(); process.exit(0); }, 9);": /cannot tell .* line 1/,
    "page.on('close', () => page.screenshot());": /cannot tell .* line 1/,
    'const shot = async () => page.screenshot();': /passing path/,
    'async function shoot() { await page.screenshot(); if (ok) return; process.exit(1); }': /cannot tell .* line 1/,
    'try { await go(); } catch (e) { await page.screenshot(); if (/expected/.test(e.message)) return; throw e; }': /cannot tell .* line 1/,
    'for (;;) { try { await go(); } catch (e) { await page.screenshot(); if (retry) continue; throw e; } }': /cannot tell .* line 1/,
    'try { await go(); } catch (e) { await page.screenshot(); for (const x of xs) { if (x) break; } throw e; }': null,
    'try { await go(); } catch (e) { await page.screenshot(); xs.forEach(x => { return x; }); throw e; }': null,
    "const s = 'page.screenshot(';": /finds no screenshot call/,
  };
  for (const [source, said] of Object.entries(cases)) {
    const why = zeroProblem(source);
    if (said === null) assert.equal(why, null, source); else assert.match(why ?? '', said, source);
  }
});
