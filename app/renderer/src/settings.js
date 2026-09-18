// Settings dialog: Claude API key and model, appearance, and the Barkpark connection.
import { el, esc, toast } from './ui.js';
import { state } from './state.js';

const api = window.barkdown;

export function openSettings(onChange) {
  const backdrop = document.getElementById('bw-dialog');
  const s = state.settings;
  backdrop.innerHTML = '';
  const dialog = el(`<div class="bw-dialog" role="dialog" aria-label="Settings">
    <h2>Settings</h2>
    <p class="note">Stored locally in ${esc(s.userData)}. Secrets are encrypted with the operating system keychain when available.</p>
    <h3>Assistant</h3>
    <p class="note">Barkdown runs on the sign-ins already on this computer, like T3 Code: Claude Code (<code>claude</code> login) or Codex (<code>codex login</code>). An API key is the fallback.</p>
    <label for="provider">Default provider</label>
    <select id="provider">
      <option value="claude">Claude Code · ${s.providers?.claude?.loggedIn ? 'signed in' : 'not signed in (run claude in a terminal)'}</option>
      <option value="codex">Codex · ${s.providers?.codex?.loggedIn ? 'signed in' + (s.providers.codex.model ? ' · ' + esc(s.providers.codex.model) : '') : 'not signed in (run codex login)'}</option>
      <option value="api">Claude API key · ${s.providers?.api?.hasKey ? 'configured' : 'no key'}</option>
    </select>
    <div class="row" style="margin-top:8px"><label for="claude-model" style="margin:0">Claude Code model</label><input id="claude-model" type="text" placeholder="default (Claude Code's own)" style="width:220px"><label for="codex-model" style="margin:0">Codex model</label><input id="codex-model" type="text" placeholder="default (~/.codex/config.toml)" style="width:200px"></div>
    <p class="note">Claude Code asks you in the chat before editing files or running commands. Codex applies edits inside the working folder's sandbox and shows them as a review. Each chat can override the provider from the composer.</p>
    <label for="api-key">Claude API key ${s.hasApiKey ? `<span class="bw-positive">· configured${s.apiKeyFromEnv ? ' from ANTHROPIC_API_KEY' : ''}</span>` : '<span class="bw-negative">· missing (offline mode)</span>'}</label>
    <div class="row"><input id="api-key" type="password" placeholder="${s.hasApiKey ? 'Leave blank to keep the current key' : 'sk-ant-…'}" style="flex:1"><button data-act="clear-key" title="Remove the stored key">Clear</button></div>
    <label for="model">Model</label>
    <select id="model"><option value="claude-opus-5">Claude Opus 5 (default)</option><option value="claude-sonnet-5">Claude Sonnet 5</option><option value="claude-opus-4-8">Claude Opus 4.8</option><option value="claude-haiku-4-5">Claude Haiku 4.5</option></select>
    <h3>Appearance</h3>
    <div class="row"><label for="theme">Theme</label><select id="theme" style="width:auto"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select><label for="width">Conversation width</label><input id="width" type="range" min="40" max="70" step="5"><span id="width-value"></span></div>
    <h3>Barkpark</h3>
    <div class="row"><label><input id="bp-enabled" type="checkbox"> Show Barkpark papers in the library</label></div>
    <div class="row"><label><input id="bp-cli" type="checkbox"> Read through the installed <code>bp</code> CLI (uses its saved server and token)</label><button data-act="import-cli">Detect from bp</button></div>
    <label for="bp-server">Server URL (direct HTTP)</label>
    <input id="bp-server" type="text" placeholder="https://your-instance.barkpark.cloud">
    <label for="bp-token">Bearer token ${s.barkpark.hasToken ? '<span class="bw-positive">· stored</span>' : ''}</label>
    <input id="bp-token" type="password" placeholder="${s.barkpark.hasToken ? 'Leave blank to keep the current token' : 'token'}">
    <div class="row" style="margin-top:8px"><label for="bp-dataset">Dataset</label><input id="bp-dataset" type="text" style="width:160px"><label><input id="bp-writes" type="checkbox"> Allow fenced writes to Barkpark (off by default)</label></div>
    <div class="row" style="margin-top:8px"><button data-act="test">Test connection</button><span class="status" id="bp-status"></span></div>
    <div class="actions"><button data-act="cancel">Cancel</button><button class="primary" data-act="save">Save</button></div>
  </div>`);
  backdrop.appendChild(dialog);
  backdrop.hidden = false;
  const q = sel => dialog.querySelector(sel);
  q('#model').value = s.model || 'claude-opus-5';
  q('#provider').value = s.provider || 'claude';
  q('#claude-model').value = s.claudeModel || '';
  q('#codex-model').value = s.codexModel || '';
  q('#theme').value = s.theme || 'system';
  q('#width').value = s.chatWidth || 60;
  q('#width-value').textContent = (s.chatWidth || 60) + '%';
  q('#width').oninput = () => { q('#width-value').textContent = q('#width').value + '%'; onChange({ chatWidth: Number(q('#width').value) }, true); };
  q('#bp-enabled').checked = Boolean(s.barkpark.enabled);
  q('#bp-cli').checked = Boolean(s.barkpark.viaCli);
  q('#bp-server').value = s.barkpark.server || '';
  q('#bp-dataset').value = s.barkpark.dataset || 'production';
  q('#bp-writes').checked = Boolean(s.barkpark.writes);
  let clearKey = false;
  q('[data-act="clear-key"]').onclick = () => { clearKey = true; q('#api-key').value = ''; q('#api-key').placeholder = 'Key will be removed on save'; };
  q('[data-act="import-cli"]').onclick = async () => {
    const status = q('#bp-status');
    status.textContent = 'Asking bp…'; status.className = 'status';
    try { const r = await api.barkpark.importCli(); if (!r.ok) throw new Error(r.error); q('#bp-server').value = r.server; q('#bp-dataset').value = r.dataset; q('#bp-cli').checked = true; q('#bp-enabled').checked = true; status.textContent = `Found ${r.name} (${r.server}, ${r.tier} tier). Reads will go through bp.`; status.className = 'status ok'; }
    catch (error) { status.textContent = error.message; status.className = 'status err'; }
  };
  q('[data-act="test"]').onclick = async () => {
    const status = q('#bp-status');
    status.textContent = 'Testing…'; status.className = 'status';
    try {
      if (q('#bp-cli').checked) { const list = await api.barkpark.list(); status.textContent = `bp answered with ${list.length} paper(s).`; status.className = 'status ok'; return; }
      const r = await api.barkpark.test({ server: q('#bp-server').value, token: q('#bp-token').value || undefined, dataset: q('#bp-dataset').value });
      status.textContent = `Connected to ${r.server} (${r.dataset}).`; status.className = 'status ok';
    } catch (error) { status.textContent = error.message; status.className = 'status err'; }
  };
  const close = () => { backdrop.hidden = true; backdrop.innerHTML = ''; };
  q('[data-act="cancel"]').onclick = close;
  backdrop.onclick = e => { if (e.target === backdrop) close(); };
  q('[data-act="save"]').onclick = async () => {
    const patch = { model: q('#model').value, provider: q('#provider').value, claudeModel: q('#claude-model').value.trim(), codexModel: q('#codex-model').value.trim(), theme: q('#theme').value, chatWidth: Number(q('#width').value), barkpark: { enabled: q('#bp-enabled').checked, viaCli: q('#bp-cli').checked, server: q('#bp-server').value.trim(), dataset: q('#bp-dataset').value.trim() || 'production', writes: q('#bp-writes').checked } };
    if (q('#api-key').value.trim()) patch.apiKey = q('#api-key').value.trim(); else if (clearKey) patch.apiKey = '';
    if (q('#bp-token').value.trim()) patch.barkpark.token = q('#bp-token').value.trim();
    try { state.settings = await api.settings.set(patch); onChange(patch, false); toast('Settings saved'); close(); } catch (error) { toast(error.message, 'error'); }
  };
  setTimeout(() => q(s.hasApiKey ? '#model' : '#api-key').focus(), 30);
}
