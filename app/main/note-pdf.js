// Print an exported note's HTML (main/note-export.js) to PDF in a hidden window that loads nothing remote
// and runs no script: its own in-memory session answers only the one page and refuses every other request,
// JavaScript is off, and the page's CSP allows embedded (data:) pictures only.
const { BrowserWindow, session } = require('electron');
const crypto = require('crypto');

async function printHtmlToPdf(html) {
  const page = `https://note-export.invalid/${crypto.randomUUID()}`;
  const ses = session.fromPartition('note-export-' + crypto.randomUUID(), { cache: false });
  const refuse = () => new Response('', { status: 403 });
  ses.protocol.handle('https', request => request.url === page ? new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }) : refuse());
  ses.protocol.handle('http', refuse);
  ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !(details.url === page || details.url.startsWith('data:')) }));
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const win = new BrowserWindow({ show: false, width: 820, height: 1160, webPreferences: { session: ses, javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await win.loadURL(page);
    return await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
  } finally {
    if (!win.isDestroyed()) win.destroy();
    try { ses.protocol.unhandle('https'); ses.protocol.unhandle('http'); } catch {}
  }
}

module.exports = { printHtmlToPdf };
