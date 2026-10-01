// Updates (docs/RELEASE.md, phase 3): a background check against the channel feed a release carries,
// a download only when asked, a restart only when asked. Nothing happens on its own. The feed is the
// GitHub release of the running channel, or BARKDOWN_UPDATE_URL for a rehearsal against a local one.
// The last step, installing, needs an application signed with a Developer ID; until then a download
// completes and the install is refused with the reason, so a person is never left guessing.
const CHECK_DELAY_MS = 60 * 1000, CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
function channelOf(version) { return /-nightly\.\d{8}\.\d+$/.test(version) ? 'nightly' : 'latest'; }
function createUpdates({ app, autoUpdater, version, feedUrl = process.env.BARKDOWN_UPDATE_URL || '', repository = null, signed = false, configDir = null, log = () => {}, onChange = () => {}, timers = { setTimeout, clearTimeout } }) {
  const channel = channelOf(version);
  const enabled = Boolean(feedUrl) || (app.isPackaged && Boolean(repository));
  let state = { phase: enabled ? 'idle' : 'off', channel, version, latest: null, percent: 0, message: enabled ? null : 'Updates run in the installed application.', checkedAt: null, signed };
  let timer = null, pending = null;
  const set = patch => { state = { ...state, ...patch }; onChange(status()); };
  function status() { return { ...state }; }
  if (enabled) {
    autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = false; autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = channel === 'nightly'; autoUpdater.channel = channel;
    if (!app.isPackaged) {
      // Unpackaged, the updater reads its provider from a file, not from setFeedURL: write the rehearsal feed there.
      autoUpdater.forceDevUpdateConfig = true;
      if (feedUrl && configDir) { const fs = require('node:fs'), path = require('node:path'); const file = path.join(configDir, 'dev-app-update.yml'); fs.mkdirSync(configDir, { recursive: true }); fs.writeFileSync(file, `provider: generic\nurl: ${feedUrl}\nchannel: ${channel}\n`); autoUpdater.updateConfigPath = file; }
    }
    autoUpdater.setFeedURL(feedUrl ? { provider: 'generic', url: feedUrl, channel } : { provider: 'github', owner: repository.owner, repo: repository.repo, releaseType: channel === 'nightly' ? 'prerelease' : 'release', ...(channel === 'nightly' ? { channel } : {}) });
    autoUpdater.logger = { info: m => log('[updates] ' + m), warn: m => log('[updates] ' + m), error: m => log('[updates] ' + m), debug: () => {} };
    autoUpdater.on('checking-for-update', () => set({ phase: 'checking', message: null }));
    autoUpdater.on('update-available', info => set({ phase: 'available', latest: info.version, checkedAt: new Date().toISOString(), message: null }));
    autoUpdater.on('update-not-available', () => set({ phase: 'current', latest: null, checkedAt: new Date().toISOString(), message: null }));
    autoUpdater.on('download-progress', p => set({ phase: 'downloading', percent: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', info => set({ phase: 'downloaded', latest: info.version, percent: 100, message: null }));
    autoUpdater.on('error', error => set({ phase: state.phase === 'checking' || state.phase === 'downloading' ? 'error' : state.phase, message: String(error?.message || error).split('\n')[0].slice(0, 200) }));
  }
  async function check() {
    if (!enabled) return status();
    if (pending) return pending;
    pending = autoUpdater.checkForUpdates().then(() => status(), error => { set({ phase: 'error', message: String(error?.message || error).split('\n')[0].slice(0, 200) }); return status(); }).finally(() => { pending = null; });
    return pending;
  }
  async function download() {
    if (!enabled || !['available', 'error'].includes(state.phase)) return status();
    try { set({ phase: 'downloading', percent: 0, message: null }); await autoUpdater.downloadUpdate(); } catch (error) { set({ phase: 'error', message: String(error?.message || error).split('\n')[0].slice(0, 200) }); }
    return status();
  }
  function install() {
    if (state.phase !== 'downloaded') return status();
    // Squirrel.Mac validates the new bundle's signature against the running one; ad hoc fails that.
    if (process.platform === 'darwin' && !signed) { set({ message: 'This copy is signed ad hoc and cannot replace itself. Install the new disk image from the release page; your notes and profiles are kept.' }); return status(); }
    autoUpdater.quitAndInstall(false, true); return status();
  }
  function start() { if (!enabled) return; timer = timers.setTimeout(() => { check().catch(() => {}); timer = timers.setTimeout(function again() { check().catch(() => {}); timer = timers.setTimeout(again, CHECK_EVERY_MS); }, CHECK_EVERY_MS); }, CHECK_DELAY_MS); timer.unref?.(); }
  function stop() { if (timer) timers.clearTimeout(timer); timer = null; }
  return Object.freeze({ status, check, download, install, start, stop, channel, enabled });
}
module.exports = { createUpdates, channelOf, CHECK_DELAY_MS, CHECK_EVERY_MS };
