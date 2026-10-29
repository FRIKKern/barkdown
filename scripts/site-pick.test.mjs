import assert from 'node:assert/strict';
import { pickRelease } from '../site/pick.mjs';
const asset = name => ({ name, size: 197191872, browser_download_url: `https://example.test/${name}` });
const release = (tag, published, { notarized = true, arches = ['arm64', 'x64'], extra = [] } = {}) => ({ tag_name: tag, draft: false, published_at: published, html_url: `https://example.test/${tag}`,
  body: notarized ? 'It is signed with a Developer ID and notarized by Apple, so it opens like any downloaded app.' : 'It is signed ad hoc.',
  assets: [...arches.map(a => asset(`Barkdown-${tag.slice(1)}-${a}.dmg`)), asset('SHA256SUMS'), ...extra] });
const adHoc = release('v0.6.0-nightly.20261005.2', '2026-10-05T18:37:14Z', { notarized: false });
const signed = release('v0.6.0-nightly.20261029.1', '2026-10-29T07:05:13Z');
const runtime = { ...release('runtime-1482fb675', '2026-10-30T00:00:00Z'), tag_name: 'runtime-1482fb675' };
const oneArch = release('v0.6.0-nightly.20261030.1', '2026-10-30T07:00:00Z', { arches: ['arm64'] });
// Until a stable exists: the newest notarized nightly with both images; ad hoc, one-architecture and runtime releases are passed over.
const nightly = pickRelease([adHoc, oneArch, runtime, signed]);
assert.equal(nightly.tag, 'v0.6.0-nightly.20261029.1'); assert.equal(nightly.channel, 'nightly');
assert.equal(nightly.arm64.name, 'Barkdown-0.6.0-nightly.20261029.1-arm64.dmg'); assert.equal(nightly.x64.mb, 188); assert.match(nightly.sums, /SHA256SUMS$/);
// A stable wins over a newer nightly, and its version-free copies are not the ones offered.
const stable = release('v0.6.0', '2026-10-31T10:00:00Z', { extra: [asset('Barkdown-arm64.dmg'), asset('Barkdown-x64.dmg')] });
const newer = release('v0.6.1-nightly.20261101.1', '2026-11-01T07:00:00Z');
const offered = pickRelease([newer, stable, signed]);
assert.equal(offered.tag, 'v0.6.0'); assert.equal(offered.channel, 'stable'); assert.equal(offered.arm64.name, 'Barkdown-0.6.0-arm64.dmg');
assert.equal(pickRelease([adHoc, runtime]), null);
console.log('Download page: newest notarized stable, else nightly, with both Mac images; ad hoc and partial releases passed over.');
