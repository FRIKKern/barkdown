const crypto = require('node:crypto');

// A renderer acknowledgement is permission to close only while its input
// freeze remains held. Refusal and timeout release that exact request.
function createQuitSettlement({ getWindow, timeoutMs = 9000, log = message => console.error(message) }) {
  let active = null;
  function release(error = new Error('Note settlement was cancelled. Keep the window open.')) {
    const request = active;
    if (!request) return;
    active = null;
    clearTimeout(request.timer);
    try { if (!request.window.isDestroyed()) request.window.webContents.send('app:settle-release', request.id); } catch {}
    request.reject(error);
  }
  function settle() {
    if (active) return Promise.reject(new Error('Note settlement is already in progress.'));
    const window = getWindow();
    if (!window || window.isDestroyed()) return Promise.resolve([]);
    if (window.webContents.isDestroyed()) return Promise.reject(new Error('The note window cannot verify its words.'));
    return new Promise((resolve, reject) => {
      const request = { id: crypto.randomUUID(), window, resolve, reject };
      active = request;
      request.timer = setTimeout(() => {
        if (active !== request) return;
        release(new Error('The window did not verify its notes in time. Keep it open and retry.'));
      }, timeoutMs);
      try { window.webContents.send('app:settle', request.id); }
      catch (error) { release(error); }
    });
  }
  function reply(id, result) {
    const request = active;
    if (!request || request.id !== id || request.answered) return false;
    clearTimeout(request.timer);
    if (!Array.isArray(result) || result.some(note => !note || typeof note !== 'object' ||
      !(note.saved === true || note.saved === false && note.kept === true))) {
      const detail = Array.isArray(result) ? result.find(note => note?.error)?.error : null;
      request.reject(new Error(typeof detail === 'string' ? detail : 'Some notes are neither saved nor retained. Keep the window open.'));
      release();
      return false;
    }
    request.answered = true;
    const retained = result.filter(note => note.saved === false).length;
    if (retained) log(`[quit] ${retained} note${retained === 1 ? '' : 's'} not saved at quit: ${retained} kept as retained drafts`);
    request.resolve(result);
    return true;
  }
  return { settle, reply, release };
}
module.exports = { createQuitSettlement };
