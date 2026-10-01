import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../main/store');
const { createDocuments } = require('../main/documents');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-seed-'));
// An assistant run or the MCP server reading an empty legacy store writes nothing into it.
const quiet = createDocuments(createStore(path.join(root, 'quiet')), { seed: false });
assert.deepEqual(quiet.list(), []); assert.equal(fs.existsSync(path.join(root, 'quiet', 'documents')) && fs.readdirSync(path.join(root, 'quiet', 'documents')).length > 0, false);
// The legacy launch keeps its welcome notes for a brand-new library.
const legacy = createDocuments(createStore(path.join(root, 'legacy')));
assert.deepEqual(legacy.list().map(d => d.title).sort(), ['Interaction notes', 'Overview']);
fs.rmSync(root, { recursive: true, force: true });
console.log('Documents seed: an assistant run or the MCP server never seeds the legacy store; the legacy launch still does.');
