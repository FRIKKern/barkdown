// One reader of the "[code] text" form (shared/error-code.js). Electron's context bridge keeps only an error's
// message, so main writes the code into it; a second hand-written parse drifts (one read only [A-Z_], another
// needed a space after the bracket). This finds readers by what they match, not by file name: every regular
// expression literal in the app's own source is run against the wire form, and one that reads it is a reader.
// Writers build the form with a template (main/preload.js keeps its own copy of wireMessage, since the preload
// may require only electron); they hold no such expression and are not counted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OWNER = 'shared/error-code.js';
const sources = execFileSync('git', ['ls-files', 'main', 'renderer', 'shared'], { cwd: app, encoding: 'utf8' })
  .split('\n').filter(f => /\.[cm]?js$/.test(f) && !f.startsWith('renderer/vendor/'));

// Regular expression literals: a slash where an expression may start (after an operator, bracket, comma, keyword
// or line start), then the body (escapes and classes may hold a slash) and its flags. Anything that does not
// compile as a RegExp is not one and is skipped.
const LITERAL = /(?:^|[=(,:;!&|?{}[+\-*%<>~^]|\breturn|\btypeof|\bcase)\s*\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])*)\/([dgimsuyv]*)/gm;
function expressions(text) {
  const out = [];
  for (const m of text.matchAll(LITERAL)) {
    try { out.push({ source: m[0].trim(), re: new RegExp(m[1], m[2].replace(/[gy]/g, '')) }); } catch {}
  }
  return out;
}

// Reads the form: on some wire message it matches at the start, covering the bracketed code (a narrower reader,
// say uppercase codes only, still counts), and it does not match the same words with the bracket elsewhere, so a
// general bracket or link pattern is not taken for a reader.
const WIRE = ['[ENOENT] File gone', '[validation_failed refused] Title is required', '[draft_identity] Not yours'];
const reads = re => WIRE.some(text => {
  const m = re.exec(text), code = text.slice(1, text.indexOf(']')).split(' ')[0];
  return m && m.index === 0 && m[0].includes(`[${code}`) && !re.test('see ' + text);
});

test('the reader finder knows a reader when it sees one', () => {
  const found = src => expressions(src).filter(e => reads(e.re)).length;
  assert.equal(found("const code = /^\\[([A-Z_]+)\\]/.exec(error.message || '')?.[1];"), 1, 'a capture of the code');
  assert.equal(found("const text = String(error.message).replace(/^\\[[\\w-]+\\]\\s*/, '');"), 1, 'a strip of the prefix');
  assert.equal(found("const PREFIX = /^\\[([\\w-]+)( refused)?\\]\\s*/;"), 1, "the owner's own");
  assert.equal(found("const link = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g; const any = /\\[([^\\]]+)\\]/;"), 0, 'a link or any bracket is not one');
  assert.equal(found("const wire = ({ code, message }) => code ? `[${code}] ${message}` : String(message);"), 0, 'a writer is not one');
});

test('only shared/error-code.js reads the "[code] text" form; everything else asks it', () => {
  const readers = [];
  for (const file of sources) {
    for (const e of expressions(fs.readFileSync(path.join(app, file), 'utf8'))) if (reads(e.re)) readers.push(`${file}: ${e.source}`);
  }
  assert.ok(sources.includes(OWNER) && sources.includes('main/preload.js') && sources.length > 100, 'the scan covers the app');
  assert.ok(readers.some(r => r.startsWith(OWNER + ':')), 'the owner is found, so the finder works on real source');
  assert.deepEqual(readers.filter(r => !r.startsWith(OWNER + ':')), [], 'read the code with errorCode/errorText instead');
});
