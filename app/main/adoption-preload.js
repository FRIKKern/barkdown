const { ipcRenderer } = require('electron');
window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('button[data-action]').forEach(button => button.addEventListener('click', async () => {
    for (const item of document.querySelectorAll('button')) item.disabled = true;
    try { await ipcRenderer.invoke('adoption:choice', button.dataset.action); }
    catch { for (const item of document.querySelectorAll('button')) item.disabled = false; }
  }));
  const showLibrary = document.querySelector('[data-utility="show-library"]');
  showLibrary?.addEventListener('click', () => ipcRenderer.invoke('adoption:show-library').catch(() => { showLibrary.disabled = false; }));
});
