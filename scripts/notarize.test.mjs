// scripts/notarize.mjs against a stand-in xcrun: a failed upload is tried again, a dropped connection while
// polling is not a verdict, Accepted returns the id, and a rejection carries Apple's log. No network, no Apple.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { notarize } from './notarize.mjs';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-notarize-'));
const script = path.join(dir, 'replies.json');
fs.writeFileSync(path.join(dir, 'xcrun'), `#!/usr/bin/env node
const fs = require('fs'); const file = ${JSON.stringify(script)};
const replies = JSON.parse(fs.readFileSync(file, 'utf8')); const verb = process.argv[3];
const next = replies[verb].shift(); fs.writeFileSync(file, JSON.stringify(replies));
if (next === 'offline') { process.stderr.write('Error: The Internet connection appears to be offline.'); process.exit(1); }
process.stdout.write(typeof next === 'string' ? next : JSON.stringify(next));
`, { mode: 0o755 });
const quiet = { poll: 1, retry: 1, log: () => {} };
process.env.PATH = dir + path.delimiter + process.env.PATH;
fs.writeFileSync(script, JSON.stringify({ submit: ['offline', { id: 'sub-1' }], info: ['offline', { status: 'In Progress' }, 'offline', { status: 'Accepted' }] }));
assert.equal(await notarize('/tmp/Barkdown.dmg', quiet), 'sub-1');
fs.writeFileSync(script, JSON.stringify({ submit: [{ id: 'sub-2' }], info: [{ status: 'Invalid' }], log: ['{"issues":[{"message":"The binary is not signed."}]}'] }));
await assert.rejects(notarize('/tmp/Barkdown.dmg', quiet), /did not accept Barkdown\.dmg \(Invalid, sub-2\)[\s\S]*not signed/);
fs.writeFileSync(script, JSON.stringify({ submit: ['offline', 'offline', 'offline'], info: [] }));
await assert.rejects(notarize('/tmp/Barkdown.dmg', quiet), /could not submit Barkdown\.dmg/);
fs.writeFileSync(script, JSON.stringify({ submit: [{ id: 'sub-3' }], info: Array(50).fill({ status: 'In Progress' }) }));
await assert.rejects(notarize('/tmp/Barkdown.dmg', { ...quiet, minutes: 0.0005, poll: 5 }), /had not finished Barkdown\.dmg \(sub-3\)/);
fs.rmSync(dir, { recursive: true, force: true });
console.log('Notarize: a failed upload retried, a dropped connection outlasted, a rejection with its log, and the time limit passed.');
