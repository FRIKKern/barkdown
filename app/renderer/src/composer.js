import { el, esc, iconHtml, toast, basename, errorMessage } from './ui.js';
import { state, save } from './state.js';
import { sendMessage, cancelRun, PROVIDER_LABEL, providerFor } from './conversation.js';
import { CLAUDE_MODELS, CODEX_MODELS, EFFORT_LEVELS, defaultModelLabel, defaultModelId, modelName } from './models.js';
import { toggleMenu, hideMenus } from './menus.js';
import { askText } from './dialogs.js';
import { recallComposer, resetComposerHistory } from './composer-history.js';
const api = window.barkdown;
// Models and reasoning effort a chat can pick per provider. Empty value means the provider's own default.
// The default rows name what the provider would use on its own: Codex reads ~/.codex/config.toml.
function modelChoices(provider) {
  const codexDefault = state.settings?.providers?.codex?.model;
  const providers = state.settings?.providers || {};
  if (provider === 'claude') return [['', defaultModelLabel('claude', providers)], ...CLAUDE_MODELS.filter(([id]) => id !== defaultModelId('claude', providers).replace(/\[1m\]$/i, ''))];
  if (provider === 'codex') return [['', defaultModelLabel('codex', providers)], ...CODEX_MODELS.filter(([id]) => id !== codexDefault)];
  return [['', `Settings default${state.settings?.model ? ' (' + state.settings.model + ')' : ''}`], ...CLAUDE_MODELS];
}
// The default row names the effort the provider uses on its own: what its last run reported, else
// what its own config says (Claude Code: settings.json or high; Codex: config.toml or medium).
// The model a provider uses when the chat does not pick one: what its last run reported, else its own config.
function defaultModelInForce(provider) {
  const providers = state.settings?.providers || {};
  if (provider === 'claude' || provider === 'codex') { const id = defaultModelId(provider, providers); return id ? { id, label: modelName(id) } : { id: '', label: provider === 'claude' ? 'Claude Code model' : 'Codex model' }; }
  const id = state.settings?.model || 'claude-opus-5';
  return { id, label: modelName(id) };
}
function effortChoices(provider) {
  const levels = EFFORT_LEVELS[provider];
  if (!levels) return [];
  const p = state.settings?.providers?.[provider] || {};
  const current = p.effortSeen || p.effort;
  return [['', current ? `Default (${levels.find(([v]) => v === current)?.[1]?.toLowerCase() || current})` : 'Default'], ...levels];
}

let nextComposer = 0;
export function cloneComposer() {
  const form = document.getElementById('bw-compose').cloneNode(true);
  for (const node of form.querySelectorAll('[id]')) { node.dataset.composer ||= node.id.replace(/^bw-/, ''); node.removeAttribute('id'); }
  form.id = 'form'; form.classList.add('bw-side-compose');
  form.querySelector('textarea').id = 'input';
  return form;
}
export function mountComposer(form, getChat, hooks, main = false) {
  const currentChat = getChat;
  for (const node of form.querySelectorAll('[id^="bw-"]')) node.dataset.composer = node.id.slice(3);
  const menus = {};
  for (const name of ['model-menu','provider-menu','effort-menu','project-menu']) {
    menus[name] = main ? document.getElementById('bw-' + name) : el('<div class="bw-menu bw-menu-chip" hidden></div>');
    if (!main) { menus[name].id = 'composer-' + (++nextComposer); document.getElementById('app').append(menus[name]); }
  }
  const q = selector => { const name = selector.replace(/^#bw-/, ''); return name === 'compose' ? form : menus[name] || form.querySelector('[data-composer="' + name + '"]'); };
  const renderChat = () => hooks.render();
  const renderSidebar = () => hooks.changed?.();
  const render = () => { renderChat(); save(); };
  async function setFolder(chat, folder) {
    chat.folder = folder; chat.sessions = {}; chat.sessionSeen = {};
    if (folder) state.settings = await api.settings.set({recentFolder:folder}).catch(() => state.settings);
    hooks.folderChanged?.(chat); render();
  }
  async function chooseFolder() {
    const chat = currentChat();
    const folder = await api.app.pickFolder();
    if (folder && chat) { await setFolder(chat, folder); toast(`This chat's agent now works in ${basename(folder)}`); }
    return folder;
  }
// Composer attachments: thumbnails with a remove control, kept per chat as draftImages until sent.
function renderAttachments(chat) {
  const strip = q('#bw-attachments');
  const images = chat?.draftImages || [];
  strip.hidden = !images.length;
  strip.innerHTML = images.map(i => `<span class="bw-attachment" title="${esc(i.name)}"><img src="${esc(i.url)}" alt="${esc(i.name)}"><button type="button" data-remove="${esc(i.id)}" aria-label="Remove ${esc(i.name)}">×</button></span>`).join('');
}

// Reads each image, downsizes anything over 2400px on its long side (ordinary screenshots stay as
// they are), and saves it through the main process. Attaches to the current chat's draft.
async function attachImages(files) {
  const chat = currentChat();
  if (!chat) return;
  for (const file of files) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { toast(`${file.name || 'That file'} is not a supported image (PNG, JPEG, GIF or WebP).`, 'error'); continue; }
    try {
      const dataUrl = await imageDataUrl(file);
      const saved = await api.attachments.save({ name: file.name || 'pasted-image.png', mime: dataUrl.slice(5, dataUrl.indexOf(';')), dataUrl });
      chat.draftImages = [...(chat.draftImages || []), saved];
      if (currentChat()?.id === chat.id) renderAttachments(chat);
      save();
    } catch (error) { toast(errorMessage(error), 'error'); }
  }
  if (currentChat()?.id === chat.id && form.isConnected) q('#bw-prompt').focus();
}

function imageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const original = reader.result;
      if (file.type === 'image/gif') return resolve(original);
      const img = new Image();
      img.onerror = () => resolve(original);
      img.onload = () => {
        const max = 2400;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale === 1) return resolve(original);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

function renderProjectMenu() {
  const chat = currentChat();
  if (!chat) return;
  const menu = q('#bw-project-menu');
  const recent = (state.settings?.recentFolders || []).filter(f => f !== chat.folder).slice(0, 5);
  menu.innerHTML = `<h3>Agent working folder</h3><div class="bw-project-location"><b>${esc(chat.folder ? basename(chat.folder) : 'No working folder')}</b>${esc(chat.folder || 'File tools are unavailable until this chat has a folder.')}</div><button data-act="choose">${iconHtml('folder-open')}${chat.folder ? 'Change folder…' : 'Choose folder…'}</button>${chat.folder ? `<button data-act="open">${iconHtml('folder-code')}Open project in editor</button><button data-act="new-chat">${iconHtml('message-circle-plus')}New chat with this folder</button><button data-act="clear">${iconHtml('x')}Remove folder from this chat</button>` : ''}${recent.length ? `<h3>Recent folders</h3>${recent.map(f => `<button data-folder="${esc(f)}" title="${esc(f)}">${iconHtml('folder-open')}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(basename(f))}</span></button>`).join('')}` : ''}`;
  menu.querySelector('[data-act="choose"]').onclick = () => { hideMenus(); chooseFolder(); };
  menu.querySelector('[data-act="open"]') && (menu.querySelector('[data-act="open"]').onclick = () => { hideMenus(); hooks.openProject(chat); });
  menu.querySelector('[data-act="new-chat"]') && (menu.querySelector('[data-act="new-chat"]').onclick = () => { hideMenus(); hooks.startFolderChat(chat.folder); });
  menu.querySelector('[data-act="clear"]') && (menu.querySelector('[data-act="clear"]').onclick = () => { hideMenus(); setFolder(chat, null); });
  menu.querySelectorAll('[data-folder]').forEach(b => { b.onclick = () => { hideMenus(); setFolder(chat, b.dataset.folder); }; });
}


  function renderControls() { const chat = currentChat(); if (!chat) return;
  q('#bw-prompt').value = chat.draft || '';
  renderAttachments(chat);
  q('#bw-folder-label').textContent = chat.folder ? basename(chat.folder) : 'No working folder';
  q('#bw-folder-context').title = chat.folder || 'Choose an agent working folder for this chat';
  const provider = providerFor(chat);
  const available = state.settings?.providers || {};
  const ready = provider === 'claude' ? available.claude?.loggedIn : provider === 'codex' ? available.codex?.loggedIn : available.api?.hasKey;
  q('#bw-provider-label').textContent = (PROVIDER_LABEL[provider] || provider) + (ready ? '' : ' · not signed in');
  q('#bw-provider').classList.toggle('off', !ready);
  q('#bw-provider').title = ready ? `Runs on ${PROVIDER_LABEL[provider]} using your local login. Click to switch.` : `${PROVIDER_LABEL[provider]} is not available. Click to switch or open Settings.`;
  // The chips always name the value in force; a provider default is shown as such, never as a blank word.
  const modelLabel = (modelChoices(provider)).find(([v]) => v === (chat.model || ''))?.[1] || chat.model;
  const defaultModel = defaultModelInForce(provider);
  q('#bw-model-label').textContent = chat.model ? modelLabel : `${defaultModel.label} (default)`;
  q('#bw-model').title = chat.model ? `Model for this chat: ${chat.model}` : `Model for this chat: the provider default${defaultModel.id ? ', ' + defaultModel.id : ''}. Click to choose another.`;
  const efforts = effortChoices(provider);
  q('#bw-effort').hidden = !efforts.length;
  const p = state.settings?.providers?.[provider] || {};
  const defaultEffort = p.effortSeen || p.effort;
  const effortName = v => (EFFORT_LEVELS[provider] || []).find(([id]) => id === v)?.[1] || v;
  q('#bw-effort-label').textContent = chat.effort ? effortName(chat.effort) : defaultEffort ? `${effortName(defaultEffort)} (default)` : 'Effort';
  q('#bw-effort').title = chat.effort ? `Reasoning effort for this chat: ${chat.effort}` : `Reasoning effort for this chat: the provider default${defaultEffort ? ', ' + defaultEffort : ''}. Click to choose another.`;
  q('#bw-working').hidden = !chat.runId;
  q('#bw-working').innerHTML = `<span class="bw-pulse"></span>${esc(chat.workingLabel || 'Working…')}`;

  q('#bw-stop').hidden = !chat.runId;
  }
  q('#bw-folder-context').onclick = () => { renderProjectMenu(); toggleMenu(q('#bw-project-menu'), q('#bw-folder-context'), { side: 'above' }); };
  const chipMenu = (chipId, menuId, choices, current, apply, customLabel) => {
    const menu = q(menuId);
    menu.innerHTML = `<h3>${esc(customLabel.title)}</h3>` + choices.map(([value, label]) => `<button data-choice="${esc(value)}" aria-selected="${value === (current || '')}" role="menuitemradio">${value === (current || '') ? iconHtml('check', 12) : '<i class="bw-menu-blank"></i>'}${esc(label)}</button>`).join('') + (customLabel.custom ? `<button data-custom>${iconHtml('square-pen', 12)}${esc(customLabel.custom)}</button>` : '');
    menu.querySelectorAll('[data-choice]').forEach(b => { b.onclick = () => { apply(b.dataset.choice || null); hideMenus(); renderChat(); save(); }; });
    menu.querySelector('[data-custom]') && (menu.querySelector('[data-custom]').onclick = async () => { hideMenus(); const v = await askText({ title: customLabel.custom.replace(/…$/, ''), label: customLabel.prompt, value: current || '', placeholder: 'model id' }); if (v != null) { apply(v || null); renderChat(); save(); } });
    toggleMenu(q(menuId), q(chipId), { side: 'above' });
  };
  q('#bw-model').onclick = () => { const chat = currentChat(); const provider = providerFor(chat); chipMenu('#bw-model', '#bw-model-menu', modelChoices(provider), chat.model, v => { chat.model = v; }, { title: 'Model for this chat', custom: 'Other model id…', prompt: 'Model id (as the provider names it)' }); };
  q('#bw-effort').onclick = () => { const chat = currentChat(); const provider = providerFor(chat); chipMenu('#bw-effort', '#bw-effort-menu', effortChoices(provider), chat.effort, v => { chat.effort = v; }, { title: 'Reasoning effort' }); };
  q('#bw-provider').onclick = () => { const chat = currentChat(); const p = state.settings?.providers || {}; const ready = { claude: p.claude?.loggedIn, codex: p.codex?.loggedIn, api: p.api?.hasKey }; const choices = ['claude', 'codex', 'api'].map(id => [id, `${PROVIDER_LABEL[id]}${ready[id] ? '' : ' · not signed in'}`]); chipMenu('#bw-provider', '#bw-provider-menu', choices, providerFor(chat), v => { chat.provider = v; chat.sessions = {}; }, { title: 'Provider for this chat' }); };
  q('#bw-stop').onclick = () => cancelRun(currentChat());
  q('#bw-compose').onsubmit = e => { e.preventDefault(); const chat = currentChat(); const text = q('#bw-prompt').value; const images = chat.draftImages || []; if (!text.trim() && !images.length) return; if (chat.runId) { toast('Wait for the current run to finish, or stop it.'); return; } resetComposerHistory(chat); chat.draft = ''; chat.draftImages = []; q('#bw-prompt').value = ''; renderAttachments(chat); sendMessage(chat, text, { render: () => { renderChat(); renderSidebar(); }, runChanged: () => { renderChat(); renderSidebar(); } }, images); };
  // Images: paste into the prompt, drop on the composer, or pick with the attach button. Each is saved
  // under userData/attachments right away so the chat only keeps a path.
  q('#bw-prompt').addEventListener('paste', e => { const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); attachImages(files); } });
  const composer = q('#bw-compose');
  composer.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); composer.classList.add('drop'); } });
  composer.addEventListener('dragleave', () => composer.classList.remove('drop'));
  composer.addEventListener('drop', e => { composer.classList.remove('drop'); const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (files.length) { e.preventDefault(); attachImages(files); } });
  q('#bw-attach').onclick = () => q('#bw-attach-input').click();
  q('#bw-attach-input').onchange = () => { attachImages([...q('#bw-attach-input').files]); q('#bw-attach-input').value = ''; };
  q('#bw-attachments').addEventListener('click', e => { const remove = e.target.closest('[data-remove]'); if (!remove) return; const chat = currentChat(); chat.draftImages = (chat.draftImages || []).filter(i => i.id !== remove.dataset.remove); renderAttachments(chat); save(); q('#bw-prompt').focus(); });
  q('#bw-prompt').addEventListener('keydown', e => { if (recallComposer(e, q('#bw-prompt'), currentChat(), save)) return; if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); q('#bw-compose').requestSubmit(); } });
  q('#bw-prompt').addEventListener('input', () => { const chat = currentChat(); if (chat) { chat.draft = q('#bw-prompt').value; save(); } });
  return {render:renderControls,attachImages,chooseFolder,renderProjectMenu,destroy(){if(Object.values(menus).some(menu => !menu.hidden)) hideMenus(); for(const menu of Object.values(menus)) if(!main) menu.remove();}};
}
