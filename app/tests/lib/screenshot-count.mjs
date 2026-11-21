// The chain's record of the screenshot check's count. The chain starts it empty (`node tests/lib/screenshot-count.mjs`,
// its first step); every process that loads tests/lib/playwright.mjs adds one line at exit, the same count it prints;
// tests/screenshot-count.test.mjs, the chain's last step, reads it. Outside a chain run there is no record and
// nothing is added.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RECORD = path.join(appDir, 'test-results', 'screenshots-checked.jsonl');

export function startRecord() {
  fs.mkdirSync(path.dirname(RECORD), { recursive: true });
  fs.writeFileSync(RECORD, '');
}

// The script is the one this process runs, named as the chain names it: relative to app/, with forward slashes.
// The screenshot check itself never reads which script it is in (tests/capture-hook.test.mjs pins that).
export function addToRecord(screenshots) {
  if (!fs.existsSync(RECORD) || !process.argv[1]) return;
  const name = path.relative(appDir, path.resolve(process.argv[1])).split(path.sep).join('/');
  fs.appendFileSync(RECORD, JSON.stringify({ script: name, screenshots }) + '\n');
}

export function readRecord() {
  return fs.readFileSync(RECORD, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) startRecord();
