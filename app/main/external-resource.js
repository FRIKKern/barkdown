const path = require('node:path');
const allowed = new Set(['goal-worker-host.ps1', 'local-barkpark-launch.ps1', 'local-barkpark-boot.exs']);
// External interpreters cannot read Electron's virtual ASAR filesystem.
function externalResource(name, mainDir = __dirname) {
  if (!allowed.has(name)) throw new Error('Unknown external runtime resource');
  const physical = mainDir.replace(/([\\/]app\.asar)(?=[\\/]|$)/, '$1.unpacked');
  return path.join(physical, name);
}
module.exports = { externalResource };
