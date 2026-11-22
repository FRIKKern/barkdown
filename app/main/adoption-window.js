const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const labels = { prepare: 'Adopt existing library', later: 'Not now, start empty', activate: 'Use verified profile', resume: 'Resume preparation', rollback: 'Restore legacy authority', 'repair-writer': 'Repair and open library', cancel: 'Keep current library', quit: 'Quit' };
function createAdoptionWindow({ parent, showLibrary = folder => shell.showItemInFolder(folder) } = {}) {
  let window = null, pending = null, busy = false;
  function ensureWindow() {
    if (window && !window.isDestroyed()) return window;
    window = new BrowserWindow({ width: 760, height: 540, minWidth: 400, minHeight: 380, title: 'Barkdown library recovery', autoHideMenuBar: true, parent, modal: Boolean(parent),
      webPreferences: { preload: path.join(__dirname, 'adoption-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.on('close', event => { if (busy) event.preventDefault(); });
    window.on('closed', () => { pending?.resolve('quit'); pending = null; window = null; });
    return window;
  }
  ipcMain.handle('adoption:choice', (event, action) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !pending?.actions.includes(action)) throw new Error('Invalid adoption recovery choice');
    const resolve = pending.resolve; pending = null; resolve(action); return true;
  });
  ipcMain.handle('adoption:show-library', event => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !pending) throw new Error('Invalid library folder request');
    showLibrary(app.getPath('userData'));
    return true;
  });
  async function show(state) {
    busy = state.status === 'busy';
    const view = ensureWindow();
    const prepare = state.actions?.includes('prepare');
    const title = prepare ? 'Move this library into a profile' : state.status === 'busy' ? 'Preparing your library' : state.status === 'repairable' ? 'Repair this library' : 'Library recovery';
    const description = state.status === 'active' && state.actions?.includes('rollback')
      ? 'Restore the retained legacy library as the startup authority. Changes made inside the adopted profile remain in its retained copy and are not merged into the old library. Close older Barkdown windows and stop the owned library server cleanly before continuing.'
      : prepare
      ? (state.actions.includes('later') ? 'Barkdown found your existing library. It stays intact while a verified profile copy is prepared; you can also start with an empty profile now and adopt it at a later launch. Close every older Barkdown window before continuing.' : 'Your existing library stays intact while a verified profile copy is prepared. Close every older Barkdown window before continuing. Any local library server must be stopped cleanly.')
      : state.status === 'busy' ? 'Barkdown is verifying the library and its recovery record. Keep this window open until the operation finishes.'
      : state.status === 'repairable' ? 'Barkdown identified the same library in the same folder, but macOS gave its disk a different device number after restart. Barkdown can save a copy of the ownership records, update the disk binding, and open the library.'
      : state.status === 'blocked' ? 'Keep your library files and recovery records together. Use Show library folder to find them. The message below explains what stopped startup.'
      : 'Follow the available recovery step to open your library.';
    const actions = state.actions || [];
    const utility = state.status === 'blocked' ? '<button type="button" data-utility="show-library">Show library folder</button>' : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      :root{color-scheme:light dark;font:15px/1.6 system-ui;color:light-dark(#242a20,#e7ebdf);background:light-dark(#fffdf8,#191b18)}body{margin:0;padding:clamp(24px,6vw,48px);max-width:760px;box-sizing:border-box}h1{font:600 27px/1.2 system-ui;margin:8px 0 24px}p{overflow-wrap:anywhere}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:light-dark(#67715c,#a0ab93)}.detail{white-space:pre-wrap;padding:14px;border:1px solid light-dark(#dcdfd2,#373b30);border-radius:8px;font-size:13px;max-height:130px;overflow:auto}footer{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}button{font:inherit;color:inherit;background:transparent;border:1px solid light-dark(#dcdfd2,#373b30);border-radius:8px;padding:9px 15px;cursor:pointer}button.primary{background:light-dark(#46662b,#b8d595);color:light-dark(#fffdf8,#191b18)}button:focus-visible{outline:3px solid #94ab77;outline-offset:3px}button:disabled{opacity:.55}::-webkit-scrollbar{width:0;height:0}</style></head><body><div class="eyebrow">Barkdown · library ownership</div><h1>${esc(title)}</h1><p>${esc(description)}</p>${state.error ? `<p class="detail">${esc(state.error)}</p>` : ''}<footer>${actions.map((action, index) => `<button type="button" data-action="${esc(action)}"${index === 0 && actions.length > 1 ? ' class="primary"' : ''}>${esc(labels[action])}</button>`).join('')}${utility}</footer></body></html>`;
    await view.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    view.show();
  }
  return {
    async choose(state) {
      if (pending) throw new Error('A recovery choice is already pending');
      const result = new Promise(resolve => { pending = { actions: state.actions, resolve }; });
      try { await show(state); } catch (error) { pending = null; throw error; }
      const action = await result;
      if (action !== 'quit' && action !== 'cancel') await show({ status: 'busy' });
      return action;
    },
    close() { ipcMain.removeHandler('adoption:choice'); ipcMain.removeHandler('adoption:show-library'); if (window && !window.isDestroyed()) window.destroy(); window = null; },
  };
}
module.exports = { createAdoptionWindow };
