// Native IPC endpoints: Windows uses named pipes, POSIX uses filesystem sockets.
const path = require('node:path');
const crypto = require('node:crypto');
function ipcPath(directory, name, platform = process.platform) {
  return platform === 'win32'
    ? `\\\\.\\pipe\\barkdown-${name}-${process.pid}-${crypto.randomBytes(16).toString('hex')}`
    : path.join(directory, `${name}.sock`);
}
function browserRoot(browser, { home, platform, env = {} }) {
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', ...browser.dir);
  if (platform === 'win32') {
    const dirs = { chrome: ['Google', 'Chrome', 'User Data'], edge: ['Microsoft', 'Edge', 'User Data'], brave: ['BraveSoftware', 'Brave-Browser', 'User Data'], vivaldi: ['Vivaldi', 'User Data'], chromium: ['Chromium', 'User Data'] };
    return dirs[browser.id] ? path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), ...dirs[browser.id]) : null;
  }
  if (platform === 'linux') {
    const dirs = { chrome: 'google-chrome', edge: 'microsoft-edge', brave: 'BraveSoftware/Brave-Browser', vivaldi: 'vivaldi', chromium: 'chromium' };
    return dirs[browser.id] ? path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), dirs[browser.id]) : null;
  }
  return null;
}
module.exports = { ipcPath, browserRoot };
