import assert from 'node:assert/strict';
import { planRelease, nextPatch, isNightlyTag, isStableTag } from './release-plan.mjs';
const tags = ['v0.6.0-nightly.20261001.2', 'v0.6.0-nightly.20261001.1', 'v0.5.0', 'v0.5.0-nightly.20260930.1', 'archive/old'];
// The first nightly of a day is .1; the third of a day that already has two is .3; notes compare to the newest nightly.
assert.deepEqual(planRelease({ channel: 'nightly', tags: [], manifestVersion: '0.6.0', date: '20261001' }), { channel: 'nightly', version: '0.6.0-nightly.20261001.1', tag: 'v0.6.0-nightly.20261001.1', previousTag: null, fromTag: null, prerelease: true });
const third = planRelease({ channel: 'nightly', tags, manifestVersion: '0.6.0', date: '20261001' });
assert.equal(third.tag, 'v0.6.0-nightly.20261001.3'); assert.equal(third.previousTag, 'v0.6.0-nightly.20261001.2');
assert.equal(planRelease({ channel: 'nightly', tags, manifestVersion: '0.6.0', date: '20261002' }).tag, 'v0.6.0-nightly.20261002.1');
assert.throws(() => planRelease({ channel: 'nightly', tags, manifestVersion: '0.6.0-rc', date: '20261002' }), /X\.Y\.Z/);
// A stable promotes the newest nightly by default, takes its version, and compares to the previous stable.
assert.deepEqual(planRelease({ channel: 'stable', tags, manifestVersion: '0.6.0' }), { channel: 'stable', version: '0.6.0', tag: 'v0.6.0', previousTag: 'v0.5.0', fromTag: 'v0.6.0-nightly.20261001.2', prerelease: false });
assert.equal(planRelease({ channel: 'stable', tags, manifestVersion: '0.6.0', from: 'v0.6.0-nightly.20261001.1' }).fromTag, 'v0.6.0-nightly.20261001.1');
assert.equal(planRelease({ channel: 'stable', tags, manifestVersion: '0.6.0', version: '0.7.0' }).tag, 'v0.7.0');
assert.throws(() => planRelease({ channel: 'stable', tags: ['v0.5.0'], manifestVersion: '0.6.0' }), /no nightly/);
assert.throws(() => planRelease({ channel: 'stable', tags, manifestVersion: '0.6.0', from: 'v0.5.0' }), /not a nightly/);
assert.throws(() => planRelease({ channel: 'stable', tags, manifestVersion: '0.6.0', version: '7' }), /X\.Y\.Z/);
assert.throws(() => planRelease({ channel: 'beta', tags, manifestVersion: '0.6.0' }), /nightly or stable/);
assert.equal(nextPatch('0.6.0'), '0.6.1'); assert.ok(isNightlyTag('v1.2.3-nightly.20260101.9')); assert.ok(!isStableTag('v1.2.3-rc.1')); assert.ok(isStableTag('v1.2.3'));
console.log('Release plan: nightly numbering per day, stable promotion of a nightly, previous tag per channel and the refusals passed.');
{
  const { nightlyDue, NIGHTLY_GAP_MS } = await import('./release-plan.mjs');
  const now = Date.parse('2026-10-02T12:00:00Z');
  const last = { tag: 'v0.6.0-nightly.20261002.1', sha: 'a'.repeat(40), at: new Date(now - NIGHTLY_GAP_MS - 1000).toISOString() };
  assert.equal(nightlyDue({ lastNightly: null, headSha: 'b'.repeat(40), isAncestor: () => true, now }).due, true);
  assert.equal(nightlyDue({ lastNightly: last, headSha: 'b'.repeat(40), isAncestor: () => true, now }).due, true);
  assert.match(nightlyDue({ lastNightly: { ...last, at: new Date(now - 60000).toISOString() }, headSha: 'b'.repeat(40), isAncestor: () => true, now }).reason, /six hours/);
  assert.match(nightlyDue({ lastNightly: last, headSha: last.sha, isAncestor: () => true, now }).reason, /already shipped/);
  assert.match(nightlyDue({ lastNightly: last, headSha: 'c'.repeat(40), isAncestor: () => false, now }).reason, /not behind/);
  console.log('Nightly due: none yet, gap, same commit, not an ancestor, and new commits passed.');
}
