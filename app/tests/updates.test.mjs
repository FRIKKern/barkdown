import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUpdates, channelOf } = require('../main/updates');
import { EventEmitter } from 'node:events';
function fakeUpdater() { const u = new EventEmitter(); Object.assign(u, { feed: null, setFeedURL(f) { this.feed = f; }, checks: 0, downloads: 0, installs: 0, async checkForUpdates() { this.checks++; this.emit('checking-for-update'); this.emit('update-available', { version: '0.6.0-nightly.20261002.1' }); }, async downloadUpdate() { this.downloads++; this.emit('download-progress', { percent: 50 }); this.emit('update-downloaded', { version: '0.6.0-nightly.20261002.1' }); }, quitAndInstall() { this.installs++; } }); return u; }
assert.equal(channelOf('0.6.0-nightly.20261001.1'), 'nightly'); assert.equal(channelOf('0.6.0'), 'latest');
{
  // Not packaged, no feed: off, and every action is a no-op.
  const u = fakeUpdater(); const updates = createUpdates({ app: { isPackaged: false }, autoUpdater: u, version: '0.6.0', repository: { owner: 'o', repo: 'r' } });
  assert.equal(updates.status().phase, 'off'); await updates.check(); assert.equal(u.checks, 0);
}
{
  // Packaged on the nightly channel against GitHub: the feed is the prerelease channel; a check finds a version, nothing downloads by itself.
  const u = fakeUpdater(); const changes = [];
  const updates = createUpdates({ app: { isPackaged: true }, autoUpdater: u, version: '0.6.0-nightly.20261001.1', repository: { owner: 'FRIKKern', repo: 'barkdown' }, signed: false, onChange: s => changes.push(s.phase) });
  assert.deepEqual(u.feed, { provider: 'github', owner: 'FRIKKern', repo: 'barkdown', releaseType: 'prerelease', channel: 'nightly' });
  assert.equal(u.autoDownload, false); assert.equal(u.allowPrerelease, true);
  const after = await updates.check(); assert.equal(after.phase, 'available'); assert.equal(after.latest, '0.6.0-nightly.20261002.1'); assert.equal(u.downloads, 0);
  const got = await updates.download(); assert.equal(got.phase, 'downloaded'); assert.equal(got.percent, 100);
  // Ad hoc signed: the install is refused with the reason, and nothing restarts.
  const refused = updates.install(); assert.equal(u.installs, 0); assert.match(refused.message, /^This copy is signed ad hoc and cannot replace itself/);
  assert.deepEqual(changes, ['checking', 'available', 'downloading', 'downloading', 'downloaded', 'downloaded']);
}
{
  // Signed: the install proceeds. A rehearsal feed (generic provider) is used when given, even unpackaged.
  const u = fakeUpdater(); const updates = createUpdates({ app: { isPackaged: false }, autoUpdater: u, version: '0.6.0', feedUrl: 'http://127.0.0.1:9/feed', signed: true });
  assert.deepEqual(u.feed, { provider: 'generic', url: 'http://127.0.0.1:9/feed', channel: 'latest' }); assert.equal(u.forceDevUpdateConfig, true);
  await updates.check(); await updates.download(); updates.install(); assert.equal(u.installs, 1);
}
{
  // A failing check reports the error and stays usable; the timer starts only when enabled.
  const u = fakeUpdater(); u.checkForUpdates = async () => { throw new Error('ENOTFOUND feed.example'); };
  const timers = { calls: 0, setTimeout(fn, ms) { this.calls++; return { unref() {} }; }, clearTimeout() {} };
  const updates = createUpdates({ app: { isPackaged: true }, autoUpdater: u, version: '0.6.0', repository: { owner: 'o', repo: 'r' }, timers });
  assert.equal((await updates.check()).phase, 'error'); assert.match(updates.status().message, /ENOTFOUND/);
  updates.start(); assert.equal(timers.calls, 1); updates.stop();
}
console.log('Updates: off without a feed, GitHub channel feeds, check without download, download without install, ad hoc refusal, signed install, errors and the schedule passed.');
