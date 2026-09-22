const fs = require('node:fs');

// Ordinary-chat pre-dispatch check only. Do not substitute a scratch/previous
// folder, create the missing path, or classify later provider failures as refusal.
function assertProviderFolder(provider, folder) {
  if (!['claude', 'codex'].includes(provider) || !folder) return;
  try {
    if (!fs.statSync(folder).isDirectory()) throw Object.assign(new Error('Selected path is not a directory'), { code: 'ENOTDIR' });
  } catch (error) {
    if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
    throw Object.assign(new Error(`Selected working folder "${folder}" is unavailable. Choose an available folder or clear it, then send.`), {
      code: 'BARKDOWN_SEND_NOT_STARTED', diagnostic: `${error.code}: ${error.message}`,
    });
  }
}

module.exports = { assertProviderFolder };
