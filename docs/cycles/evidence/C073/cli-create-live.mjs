// Run through app/tests/status-shots-isolated.mjs with C073_BP_CLI pointing
// to a CLI built from the same upstream source. Uses only the private server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

assert.equal(process.env.BARKDOWN_SHOTS_ISOLATED, '1');
assert.ok(process.env.C073_BP_CLI);
const out = path.dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, BARKPARK_INGEST_TOKEN: process.env.BARKPARK_API_TOKEN };
const run = (args, expected = 0) => {
  const r = spawnSync(process.env.C073_BP_CLI, [...args, '-o', 'json'], {
    env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  assert.equal(r.status, expected, `${args.slice(0, 3).join(' ')}: ${r.stdout} ${r.stderr}`);
  return JSON.parse(r.stdout);
};
for (const tag of ['barkdown', 'scratch']) {
  run(['doc', 'create-or-replace', 'tag', '--set', `_id=${tag}`, '--set', `title=${tag}`, '--yes']);
  run(['doc', 'publish', 'tag', tag, '--yes']);
}
const slug = 'c073-native-cli-insert';
const payload = {
  title: 'Native CLI insert boundary', description: 'Disposable CLI contract evidence.',
  tags: [{ tag: 'barkdown', strength: 90, rationale: 'owned by the Barkdown integration suite' },
    { tag: 'scratch', strength: 40, rationale: 'disposable test fixture, rewritten on every run' }],
  blocks: [{ id: 'heading', type: 'heading', level: 1, text: 'Native CLI insert boundary' },
    { id: 'body', type: 'paragraph', text: 'Preserve this original note.' }],
};
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'c073-cli-payload-'));
const file = path.join(data, 'paper.json');
fs.writeFileSync(file, JSON.stringify(payload));
const created = run(['bulldocs', 'create', slug, '--file', file, '--yes']);
assert.equal(created.slug, slug);
assert.equal(typeof created.rev, 'string');
const before = run(['doc', 'get', 'paper', slug, '--perspective', 'raw']);
fs.writeFileSync(file, JSON.stringify({ ...payload, title: 'Unwanted replacement' }));
const collision = run(['bulldocs', 'create', slug, '--file', file, '--yes'], 6);
assert.equal(collision.error.code, 'paper_exists');
const after = run(['doc', 'get', 'paper', slug, '--perspective', 'raw']);
assert.deepEqual(after, before);
fs.writeFileSync(path.join(out, 'cli-create-live.json'), JSON.stringify({
  capturedAt: new Date().toISOString(), host: process.env.BARKDOWN_SHOTS_HOST_COMMIT,
  upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, cliSource: process.env.C073_CLI_SOURCE,
  buildFingerprint: process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,
  cliSha256: createHash('sha256').update(fs.readFileSync(process.env.C073_BP_CLI)).digest('hex'),
  checks: ['Native JSON file creates through the live capabilities manifest',
    'Collision emits paper_exists and process exit 6', 'Original server document is unchanged'],
  created, collision, original: before,
}, null, 2) + '\n');
console.log('PASS: live CLI create, conflict exit 6, and original-note preservation.');
