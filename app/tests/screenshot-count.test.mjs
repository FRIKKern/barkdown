// The chain's last step. Every chain script that takes pictures loads the screenshot check, which at exit prints
// "screenshots checked: N" and adds the same N to this run's record (tests/lib/screenshot-count.mjs). A script
// whose check looked at no picture, or that left no count, is named here. A script may say 0 only when every
// picture in it goes through failureShot (tests/lib/failure-shot.mjs), which always fails the run, read by name from
// the script itself (tests/lib/zero-read.mjs); there is no list.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appDir, RECORD, readRecord } from './lib/screenshot-count.mjs';
import { zeroProblem } from './lib/zero-read.mjs';

test('every chain script that takes pictures reported "screenshots checked: N" in this run, N above 0 unless all its pictures go through failureShot', () => {
  const chain = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).scripts.test;
  assert.match(chain, /^node tests\/lib\/screenshot-count\.mjs && /, 'the chain starts the record');
  assert.match(chain, / && node --test tests\/screenshot-count\.test\.mjs$/, 'the chain ends with this row');
  assert.ok(fs.existsSync(RECORD), 'this run has a record: run the whole chain (npm test)');
  const scripts = [...new Set(chain.match(/tests\/[^\s"&|;]+/g))].filter(file => fs.existsSync(path.join(appDir, file)));
  // This row names pictures only as text, in the cases below; it loads no screenshot check and leaves no count.
  const self = path.relative(appDir, fileURLToPath(import.meta.url)).split(path.sep).join('/');
  const shooting = scripts.filter(file => file !== self && /\.screenshot\(|\bfailureShot\b/.test(fs.readFileSync(path.join(appDir, file), 'utf8')));
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

// The read behind a 0, by name. profile-ui.live.mjs takes pictures only when a step times out or the run is stuck,
// each through failureShot. Each source below is read as if it were tests/case.mjs.
test('a script may say 0 only when every picture in it is a failureShot call by its imported name, and it names nothing that can change how the run ends', () => {
  const ui = fs.readFileSync(path.join(appDir, 'tests/profile-ui.live.mjs'), 'utf8');
  assert.equal(zeroProblem(ui, 'tests/profile-ui.live.mjs'), null, 'profile-ui.live.mjs takes pictures only through failureShot');
  assert.equal(ui.match(/\bfailureShot\(/g).length, 2, 'both of its pictures go through failureShot');
  const use = "import { failureShot } from './lib/failure-shot.mjs';\n";
  const cases = {
    [use + 'try { await go(); } catch (e) { await failureShot(page, "a.png", e); }']: null,
    [use + 'setTimeout(async () => { await failureShot(page, "stuck.png", "stuck"); }, 9).unref();\nconst x = a.process(); x.once("exit", done);']: null,
    [use + 'await page.screenshot();']: /takes a picture directly \(line 2\)/,
    [use + 'try { await go(); } catch (e) { await failureShot(page, "a.png", e); }\nawait page.locator("p").screenshot();']: /takes a picture directly \(line 3\)/,
    [use + 'const take = page.screenshot.bind(page); await take();']: /takes a picture directly/,
    [use + 'await page["screen" + "shot"]();']: /computed name/,
    [use + 'await page["screenshot"]();']: /names 'screenshot' as text/,
    ["import { failureShot as shot } from './lib/failure-shot.mjs';\nawait shot(page, 'a.png');"]: /under another name/,
    ["import * as f from './lib/failure-shot.mjs';\nawait f.failureShot(page, 'a.png');"]: /under another name/,
    [use + 'const shot = failureShot; await shot(page, "a.png");']: /other than by calling it/,
    ["import { failureShot } from './lib/shots.mjs';\nawait failureShot(page, 'a.png');"]: /comes from \.\/lib\/shots\.mjs/,
    ["async function failureShot(page) { await page.screenshot(); }\nawait failureShot(page);"]: /defines its own failureShot/,
    [use + '{ const failureShot = async p => p.go(); await failureShot(page); }']: /defines its own failureShot/,
    ['await failureShot(page, "a.png");']: /not imported from lib\/failure-shot\.mjs/,
    [use + 'process.on("exit", () => { process.exitCode = 0; });\nawait failureShot(page, "a.png");']: /names process \(line 2\)/,
    [use + 'process.exitCode = 0;\nawait failureShot(page, "a.png");']: /names process \(line 2\)/,
    [use + 'process.exit = () => {};\nawait failureShot(page, "a.png");']: /names process/,
    [use + 'globalThis.process.exitCode = 0;\nawait failureShot(page, "a.png");']: /names globalThis/,
    [use + 'global.process.exitCode = 0;\nawait failureShot(page, "a.png");']: /names global/,
    [use + "import { exit } from 'node:process';\nawait failureShot(page, 'a.png');"]: /loads node:process/,
    [use + "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nload('process').exitCode = 0;\nawait failureShot(page, 'a.png');"]: /names 'process' as text/,
    [use + "const name = 'pro' + 'cess';\nrequire(name).exitCode = 0;\nawait failureShot(page, 'a.png');"]: /computed name/,
    [use + "await import('data:text/javascript,process.exitCode=0');\nawait failureShot(page, 'a.png');"]: /from a URL/,
    [use + "(() => {}).constructor('return pro' + 'cess')().exitCode = 0;\nawait failureShot(page, 'a.png');"]: /reaches a constructor/,
    [use + "eval('pro' + 'cess').exitCode = 0;\nawait failureShot(page, 'a.png');"]: /names eval/,
    ["const s = 'page.screenshot(';"]: /finds no picture call/,
  };
  for (const [source, said] of Object.entries(cases)) {
    const why = zeroProblem(source, 'tests/case.mjs');
    if (said === null) assert.equal(why, null, source); else assert.match(why ?? '', said, source);
  }
});

// failureShot itself, in a child process with a stand-in page: whatever the picture call does, the run ends as failed.
const run = promisify(execFile);
const helper = pathToFileURL(path.join(appDir, 'tests/lib/failure-shot.mjs')).href;
const ending = async page => {
  const code = `import { failureShot } from ${JSON.stringify(helper)};\nconst calls = [];\n${page}\nawait failureShot(page, 'shot.png', 'why');\nconsole.log('went on');`;
  try { const { stdout } = await run(process.execPath, ['--input-type=module', '-e', code], { timeout: 20000 }); return { status: 0, stdout }; }
  catch (error) { return { status: error.code, stdout: error.stdout, stderr: error.stderr }; }
};
test('failureShot ends the run with exit 1 whether the picture is kept, refused, thrown, stuck or has no page', async () => {
  const pages = {
    kept: 'const page = { screenshot: async options => { calls.push(options); } };',
    refused: 'const page = { screenshot: async () => { throw new Error("refused: a temp-folder path"); } };',
    thrown: 'const page = { screenshot: () => { throw new Error("thrown at once"); } };',
    stuck: 'const page = { screenshot: () => new Promise(() => {}) };',
    'no page': 'const page = undefined;',
  };
  const ends = await Promise.all(Object.values(pages).map(ending));
  Object.keys(pages).forEach((name, i) => {
    assert.equal(ends[i].status, 1, `${name}: exit ${ends[i].status}`);
    assert.doesNotMatch(ends[i].stdout ?? '', /went on/, `${name}: the run went on past the picture`);
  });
});

test("failureShot takes its picture with the page's own screenshot call, the one the screenshot check watches, and loads nothing", async () => {
  const kept = await ending('const page = { screenshot: async options => { console.log(JSON.stringify(options)); } };');
  assert.equal(kept.status, 1);
  assert.deepEqual(JSON.parse(kept.stdout.trim()), { path: 'shot.png', timeout: 5000 });
  const source = fs.readFileSync(path.join(appDir, 'tests/lib/failure-shot.mjs'), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b|\bimport\(|\brequire\(/m, 'failure-shot.mjs loads no module');
});
