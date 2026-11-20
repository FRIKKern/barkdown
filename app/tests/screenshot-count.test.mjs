// The chain's last step. Every chain script that takes pictures loads the screenshot check, which at exit prints
// "screenshots checked: N" and adds the same N to this run's record (tests/lib/screenshot-count.mjs). A script
// whose check looked at no picture, or that left no count, is named here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { appDir, RECORD, readRecord } from './lib/screenshot-count.mjs';

test('every chain script that takes pictures reported "screenshots checked: N" with N above 0 in this run', () => {
  const chain = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8')).scripts.test;
  assert.match(chain, /^node tests\/lib\/screenshot-count\.mjs && /, 'the chain starts the record');
  assert.match(chain, / && node --test tests\/screenshot-count\.test\.mjs$/, 'the chain ends with this row');
  assert.ok(fs.existsSync(RECORD), 'this run has a record: run the whole chain (npm test)');
  const scripts = [...new Set(chain.match(/tests\/[^\s"&|;]+/g))].filter(file => fs.existsSync(path.join(appDir, file)));
  const shooting = scripts.filter(file => /\.screenshot\(/.test(fs.readFileSync(path.join(appDir, file), 'utf8')));
  assert.ok(shooting.length >= 20, `found ${shooting.length} screenshot scripts in the chain`);
  const record = readRecord();
  const problems = shooting.flatMap(file => {
    const counts = record.filter(line => line.script === file).map(line => line.screenshots);
    if (!counts.length) return [`${file}: no count line`];
    return counts.some(n => !(n > 0)) ? [`${file}: screenshots checked: ${counts.join(', ')}`] : [];
  });
  assert.deepEqual(problems, []);
});
