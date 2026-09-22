// Electron 38 on Windows stores the DPAPI-wrapped OSCrypt key in Local State.
// A successful encryptString can precede that file's delayed write. Do not save
// dependent ciphertext until the actual key file has been observed and synced.
const fs = require('fs');
const path = require('path');

function createCredentialDurability({ safeStorage, sessionData, platform = process.platform, io = fs, timeoutMs = 30000, delay = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => performance.now() }) {
  let preparing = null, ready = false;
  function syncKey() {
    const file = path.join(sessionData(), 'Local State');
    let fd;
    try {
      fd = io.openSync(file, 'r+');
      const before = io.fstatSync(fd);
      if (!before.isFile() || before.size > 16 * 1024 * 1024) throw new Error('Invalid credential key storage');
      const data = JSON.parse(io.readFileSync(fd, 'utf8'));
      const protectedKey = data?.os_crypt?.encrypted_key;
      const blob = typeof protectedKey === 'string' && protectedKey.length <= 16384 ? Buffer.from(protectedKey, 'base64') : null;
      // Structural sanity only: this observes the tagged protected blob, not
      // a cryptographic DPAPI unprotect. Actual restart tests prove roundtrip.
      if (!blob || blob.length < 32 || blob.toString('base64') !== protectedKey || !blob.subarray(0, 5).equals(Buffer.from('DPAPI'))) {
        throw new Error('Credential key storage is missing its protected key');
      }
      io.fsyncSync(fd);
      const current = io.statSync(file);
      // Chromium may replace its preferences atomically while we flush. Retry
      // against the current file instead of acknowledging an unlinked handle.
      // Node 22 on Windows reports dev=0 from stat but a volume ID from fstat;
      // its file index remains consistent for this fixed path on one volume.
      if ((platform !== 'win32' && current.dev !== before.dev) || current.ino !== before.ino) return false;
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    } finally { if (fd !== undefined) io.closeSync(fd); }
  }
  function assertReady() {
    if (platform === 'win32' && (!ready || !safeStorage.isEncryptionAvailable())) throw new Error('Secure credential storage is not ready; save again after initialization.');
  }
  async function prepare() {
    if (platform !== 'win32') return;
    if (preparing) return preparing;
    preparing = (async () => {
      ready = false;
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure credential encryption is unavailable; credentials were not saved.');
      const deadline = now() + timeoutMs;
      while (true) {
        if (syncKey()) { ready = true; return; }
        if (now() >= deadline) throw new Error('Secure credential key has not reached disk; credentials were not saved. Try again.');
        await delay(50);
      }
    })();
    try { await preparing; } finally { preparing = null; }
  }
  return Object.freeze({ prepare, assertReady });
}
module.exports = { createCredentialDurability };
