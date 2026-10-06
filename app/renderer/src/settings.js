import { mountProviderLogin } from './provider-login.js';
import { openOriginalHistory } from './original-history.js';
import { openRetainedDrafts } from './retained-drafts.js';
// Settings sheet: a navigation column and one pane at a time, in the app's own controls.
// General (appearance, storage), Assistant (providers and models), Barkpark (connection),
// Shortcuts (reference) and About. Appearance changes preview live and are reverted on Cancel;
// everything else lands on Save.
import { el, esc, iconHtml, toast } from './ui.js';
const errorMessage = error => String(error?.message || error).replace(/^Error invoking remote method '[^']+': /, '');
import { state } from './state.js';
import { modelsFor, defaultModelLabel } from './models.js';
import { openDialog, askConfirm } from './dialogs.js';
import { ensureCanvasBundle, describeCanvasBundle, refreshCanvasBundleAfterSettings } from './canvas-bundle.js';

const api = window.barkdown;

const PANES = [
  ['general', 'sliders-horizontal', 'General'],
  ['assistant', 'sparkles', 'Assistant'],
  ['barkpark', 'library', 'Barkpark'],
  ['browser', 'globe', 'Browser'],
  ['shortcuts', 'keyboard', 'Shortcuts'],
  ['about', 'info', 'About'],
];

const SHORTCUTS = [
  ['Everywhere', [['Ctrl', 'K'], 'Quick open: tabs, documents, chats, files, actions'], [['Ctrl', ','], 'Settings'], [['Ctrl', 'N'], 'New chat'], [['Ctrl', 'Shift', 'N'], 'New document'], [['Esc'], 'Close a menu or dialog']],
  ['Work tabs', [['Alt', 'N'], 'Open a work tab (menu)'], [['Alt', '1–9'], 'Switch to tab 1–9 (9 is the last)'], [['Ctrl', 'W'], 'Close the active tab'], [['Alt', 'W'], 'Close the active tab'], [['Double-click'], 'Rename a tab in place']],
  ['Composer', [['↑'], 'Previous message from the first line (up to 100)'], [['↓'], 'Next message from the last line; return to your draft'], [['Enter'], 'Send'], [['Shift', 'Enter'], 'New line'], [['Ctrl', 'V'], 'Paste an image from the clipboard']],
  ['Paper editor', [['/'], 'Slash menu'], [['Ctrl', 'Shift', '↑ / ↓'], 'Move the block'], [['Ctrl', 'D'], 'Duplicate the block'], [['Ctrl', 'K'], 'Link the selection'], [['Ctrl', 'U'], 'Underline'], [['Ctrl', 'Shift', '0–8'], 'Turn into text, headings, lists, code']],
  ['Project editor', [['Ctrl', 'S'], 'Save the file']],
  // The terminal's keys differ by platform, and the label map above turns Ctrl into ⌘ on a Mac: there the
  // interrupt key is the Control key itself, so it is spelled out.
  /Mac/i.test(navigator.platform || '')
    ? ['Terminal', [['Ctrl', 'F'], 'Find in the terminal'], [['Ctrl', 'K'], 'Clear the screen'], [['Control', 'C'], 'Interrupt the running command']]
    : ['Terminal', [['Ctrl', 'F'], 'Find in the terminal'], [['Ctrl', 'V'], 'Paste'], [['Ctrl', 'C'], 'Copy the selection; with nothing selected, interrupt the running command'], [['Ctrl', 'Shift', 'C'], 'Copy the selection']],
];

// The app accepts Ctrl or Cmd everywhere; the pane shows the chord the host expects.
const MAC = /Mac/.test(navigator.platform);
const keyLabel = k => MAC ? ({ Ctrl: '⌘', Alt: '⌥' }[k] || k) : k;
const keys = combo => combo.map(k => `<kbd>${esc(keyLabel(k))}</kbd>`).join('<i>+</i>');

const badge = (ok, okText, badText) => `<span class="bw-badge ${ok ? 'ok' : 'off'}">${esc(ok ? okText : badText)}</span>`;
const modelOptions = (provider, s) => [`<option value="">${esc(defaultModelLabel(provider, s.providers))}</option>`, ...modelsFor(provider).map(([id, label]) => `<option value="${id}">${esc(label)} · ${id}</option>`), '<option value="custom">Other model id…</option>'].join('');
const selectHtml = (id, options, extra = '') => `<span class="bw-select"><select id="${id}" ${extra}>${options}</select>${iconHtml('chevron-down', 12)}</span>`;
const switchHtml = (id, label, help = '') => `<label class="bw-set bw-set-switch" for="${id}"><span class="bw-set-text"><b>${esc(label)}</b>${help ? `<small>${help}</small>` : ''}</span><span class="bw-switch"><input type="checkbox" id="${id}" role="switch"><i></i></span></label>`;
const setting = (title, help, control, opts = {}) => `<div class="bw-set ${opts.stack ? 'bw-set-stack' : ''}"><div class="bw-set-text"><b>${esc(title)}</b>${help ? `<small>${help}</small>` : ''}</div><div class="bw-set-ctl">${control}</div></div>`;

export function openSettings(onChange, { pane = 'general', beforeProfileSwitch = async () => true } = {}) {
  const s = state.settings;
  const p = s.providers || {};
  const original = { theme: s.theme || 'system', chatWidth: s.chatWidth || 60 };
  const dialog = el(`<div class="bw-sheet bw-settings" role="dialog" aria-label="Settings">
    <nav class="bw-settings-nav" aria-label="Settings sections">
      <h2>Settings</h2>
      ${PANES.map(([id, icon, label]) => `<button type="button" data-pane="${id}" aria-selected="${id === pane}">${iconHtml(icon, 14)}${esc(label)}</button>`).join('')}
    </nav>
    <div class="bw-settings-body">
      <section data-pane="general" ${pane !== 'general' ? 'hidden' : ''}>
        <h3>Appearance</h3>
        ${setting('Theme', 'Follow the system, or pick one. Previews as you choose.', `<div class="bw-seg" id="theme" role="radiogroup" aria-label="Theme"><button type="button" data-value="system">${iconHtml('monitor', 13)}System</button><button type="button" data-value="light">${iconHtml('sun', 13)}Light</button><button type="button" data-value="dark">${iconHtml('moon', 13)}Dark</button></div>`)}
        ${setting('Conversation width', 'How much of the window the chat takes when a work tab is open. Drag the divider between them for the same thing.', `<div class="bw-range"><input id="width" type="range" min="40" max="70" step="5" aria-label="Conversation width"><output id="width-value"></output></div>`)}
        <h3>Storage</h3>
        <div id="profile-settings" hidden></div>
        ${setting('Original history', 'Read notes, revisions and agent changes kept in a migration backup.', `<button type="button" class="bw-btn" data-act="original-history">${iconHtml('history', 13)}View originals</button>`)}
        ${state.profileId ? setting('Retained drafts', 'Read or copy local drafts kept before profile preparation. Opening a copy does not replace a Paper.', '<button type="button" class="bw-btn" data-act="retained-drafts">View drafts</button>') : ''}
        ${setting('Local data', `Chats, documents, attachments and these settings live in <code>${esc(s.userData)}</code>. Secrets are encrypted with the operating system keychain when it is available.`, `<button type="button" class="bw-btn" data-act="open-data">${iconHtml('folder-open', 13)}Open folder</button>`)}
      </section>
      <section data-pane="assistant" ${pane !== 'assistant' ? 'hidden' : ''}>
        <h3>Approvals</h3>
        ${setting('Approvals', 'Whether the assistant asks before it writes files, runs commands or uses a tool that changes something. The chip under the composer switches the same setting. The browser\'s pauses on purchases, passwords and similar are separate: Settings › Browser.', `<div class="bw-seg" id="approvals" role="radiogroup" aria-label="Approvals"><button type="button" data-value="none" aria-checked="${s.approvals !== 'ask'}">No approvals</button><button type="button" data-value="ask" aria-checked="${s.approvals === 'ask'}">Ask first</button></div>`)}
        <h3>Barkdown controls itself</h3>
        <p class="bw-sheet-note">Assistants (their <code>app</code> tool) and the <code>barkdown</code> command do what you do all day: start chats, send messages, write notes, open tabs, run the terminal.</p>
        ${switchHtml('full-yolo', 'Full YOLO', 'They can also change settings, switch profiles and delete chats. Only this switch turns it on or off: no command can, and none can quit or restart Barkdown.')}
        ${s.control?.command ? setting('Command line', 'Barkdown\'s terminal tabs have it on their path as <code>barkdown</code>. Elsewhere, run this file. Start with <code>barkdown commands</code>.', `<code class="bw-path" id="control-command">${esc(s.control.command)}</code>`, { stack: true }) : ''}
        <h3>Providers</h3>
        <p class="bw-sheet-note">Barkdown runs on the sign-ins already on this computer: Claude Code (<code>claude</code> login) or Codex (<code>codex login</code>). A Claude API key is the fallback. Pick the default here; the chips under the composer change provider, model and effort per chat.</p>
        <div class="bw-cards" id="providers">
          <article class="bw-card" data-provider="claude">
            <header><label><input type="radio" name="provider" value="claude"><span class="bw-card-title">${iconHtml('sparkles', 14)}Claude Code</span></label>${badge(p.claude?.loggedIn, 'Signed in', 'Not signed in')}</header>
            <div class="bw-card-body">
              ${setting('Model', 'Leave on the default to use what Claude Code itself is set to.', `<div class="bw-model">${selectHtml('claude-model', modelOptions('claude', s))}<input id="claude-model-custom" type="text" placeholder="model id" aria-label="Claude model id" hidden></div>`)}
              ${setting('Reasoning effort', `Claude Code's own default is <b>${esc(p.claude?.effort || 'high')}</b>${p.claude?.effortSeen && p.claude.effortSeen !== p.claude.effort ? ` (the last run reported ${esc(p.claude.effortSeen)})` : ''}. Change it per chat from the Effort chip.`, '')}
              ${setting('Tool', `<span data-tool-status="claude">Looking for <code>claude</code>…</span>`, `<input id="claude-binary" type="text" value="${esc(s.providerBinary?.claude || '')}" placeholder="claude on the PATH" aria-label="Claude Code path" spellcheck="false">`)}
              <div data-login-provider="claude"></div>
            </div>
          </article>
          <article class="bw-card" data-provider="codex">
            <header><label><input type="radio" name="provider" value="codex"><span class="bw-card-title">${iconHtml('bot', 14)}Codex</span></label>${badge(p.codex?.loggedIn, 'Signed in', 'Not signed in')}</header>
            <div class="bw-card-body">
              ${setting('Model', 'Leave on the default to use <code>~/.codex/config.toml</code>.', `<div class="bw-model">${selectHtml('codex-model', modelOptions('codex', s))}<input id="codex-model-custom" type="text" placeholder="model id" aria-label="Codex model id" hidden></div>`)}
              ${setting('Reasoning effort', `Codex's own default is <b>${esc(p.codex?.effort || 'medium')}</b>. Change it per chat from the Effort chip.`, '')}
              ${setting('Tool', `<span data-tool-status="codex">Looking for <code>codex</code>…</span>`, `<input id="codex-binary" type="text" value="${esc(s.providerBinary?.codex || '')}" placeholder="codex on the PATH" aria-label="Codex path" spellcheck="false">`)}
              <div data-login-provider="codex"></div>
            </div>
          </article>
          <article class="bw-card" data-provider="api">
            <header><label><input type="radio" name="provider" value="api"><span class="bw-card-title">${iconHtml('key-round', 14)}Claude API key</span></label>${badge(s.hasApiKey, s.apiKeyFromEnv ? 'From ANTHROPIC_API_KEY' : 'Configured', 'No key')}</header>
            <div class="bw-card-body">
              ${setting('API key', 'Stored encrypted. Leave blank to keep the current key.', `<div class="bw-inline"><input id="api-key" type="password" placeholder="${s.hasApiKey ? '••••••••' : 'sk-ant-…'}" aria-label="Claude API key"><button type="button" class="bw-btn" data-act="clear-key" ${s.hasApiKey ? '' : 'disabled'}>Clear</button></div>`)}
              ${setting('Model', 'Used when this chat runs on the API key.', selectHtml('model', modelsFor('claude').map(([id, label]) => `<option value="${id}">Claude ${esc(label)} · ${id}</option>`).join('')))}
            </div>
          </article>
        </div>
        <h3>How edits happen</h3>
        <p class="bw-sheet-note">Claude Code asks in the chat before it edits files or runs commands. Codex applies edits inside the working folder's sandbox and shows them as a review. Both edit documents directly, with Undo available in the document.</p>
      </section>
      <section data-pane="barkpark" ${pane !== 'barkpark' ? 'hidden' : ''}>
        <h3>Library</h3>
        ${switchHtml('bp-enabled', 'Show Barkpark papers in the library', 'Papers from the connected server appear beside local documents and open on the paper canvas.')}
        <h3>Connection</h3>
        ${setting('Read through', 'The <code>bp</code> CLI uses its own saved server and token. Direct HTTP needs a server URL and a bearer token.', `<div class="bw-seg" id="bp-mode" role="radiogroup" aria-label="Connection"><button type="button" data-value="cli">${iconHtml('terminal', 13)}bp CLI</button><button type="button" data-value="http">${iconHtml('globe', 13)}Direct HTTP</button><button type="button" data-value="local">${iconHtml('hard-drive', 13)}Local Barkpark</button></div>`)}
        <div id="bp-local-fields">
          ${setting('Barkpark checkout', 'Uses a built Windows checkout and the installed Scoop toolchain. Its database and media stay in Barkdown’s private local data folder.', `<input id="bp-source" type="text" aria-label="Barkpark checkout"><button type="button" class="bw-btn" data-act="local-source">Choose folder…</button>`, { stack: true })}
          <div class="bw-set"><div class="bw-set-text"><span class="bw-status" id="bp-local-status" aria-live="polite">Stopped</span></div><div class="bw-set-ctl"><button type="button" class="bw-btn" data-act="local-retry">Retry startup</button><button type="button" class="bw-btn" data-act="local-logs">Open data and logs</button></div></div>
          <p class="bw-sheet-hint">Starts with Barkdown and stops on quit. Save to activate. Existing local notes are kept in their current store until migration is ready.</p>
        </div>
        <div id="bp-cli-fields">
          ${setting('Detect', 'Ask the installed CLI which server and dataset it is pointed at.', `<button type="button" class="bw-btn" data-act="import-cli">${iconHtml('scan-search', 13)}Detect from bp</button>`)}
        </div>
        <div id="bp-http-fields">
          ${setting('Server URL', '', `<input id="bp-server" type="text" placeholder="https://your-instance.barkpark.cloud" aria-label="Server URL">`, { stack: true })}
          ${setting('Bearer token', s.barkpark.hasToken ? 'A token is stored. Leave blank to keep it.' : 'Optional for reading published papers; drafts and writes need one.', `<input id="bp-token" type="password" placeholder="${s.barkpark.hasToken ? '••••••••' : 'token'}" aria-label="Bearer token">`, { stack: true })}
        </div>
        ${setting('Dataset', '', `<input id="bp-dataset" type="text" aria-label="Dataset" style="width:180px">`)}
        <div class="bw-set"><div class="bw-set-text"><span class="bw-status" id="bp-bundle">${esc(describeCanvasBundle())}</span></div></div>
        <div class="bw-set"><div class="bw-set-text"><span class="bw-status" id="bp-status" aria-live="polite"></span></div><div class="bw-set-ctl"><button type="button" class="bw-btn" data-act="test">${iconHtml('plug-zap', 13)}Test connection</button></div></div>
        <h3>Writing</h3>
        ${switchHtml('bp-writes', 'Allow fenced writes to Barkpark', 'Off by default. When on, you and the assistant can edit papers directly, with revision checks and Undo for assistant edits.')}
        ${`<h3>Library switch</h3>
        ${setting('Move this library to Paper', 'Prepares the profile (agent turns stop, drafts are kept), backs up the legacy notes, stages them as Papers, compares the library while the runtime is held, then selects Paper. Legacy notes stay retained and read-only. Labels are generated at the switch and reviewed on Paper afterwards. The window reloads when it is done.', `<div class="bw-inline"><span class="bw-status" id="bp-switch-status" aria-live="polite">Checking…</span><button type="button" class="bw-btn" data-act="switch-paper" disabled>${iconHtml('file-plus', 13)}Switch to Paper</button><button type="button" class="bw-btn" data-act="switch-rollback" hidden>Roll back</button><button type="button" class="bw-btn" data-act="switch-retained" hidden>Open retained files</button></div><div class="bw-inline" id="bp-switch-changed" hidden></div><div class="bw-compare" id="bp-switch-compare" hidden></div>`, { stack: true })}`}
      </section>
      <section data-pane="browser" ${pane !== 'browser' ? 'hidden' : ''}>
        <h3>Browser</h3>
        ${setting('Import from Chrome', 'Copies the bookmarks and the history of a supported Chromium browser profile on this computer into this Barkdown profile: the bookmarks bar becomes Favorites, everything else feeds the address bar. A copy, when you ask; nothing in the other browser changes. Signing in is done once, in a Barkdown tab.', '<div class="bw-sources" id="browser-sources">Looking for browsers…</div><div class="bw-status bw-set-note" id="browser-import-status"></div>', { stack: true })}
        ${setting('Site permissions', 'Sites you answered about your camera, microphone, notifications or location. Forget one to be asked again.', '<div class="bw-sites" id="browser-sites">…</div>', { stack: true })}
        ${setting('Ads and trackers', 'Blocked on every page with Ghostery\'s lists (EasyList and friends), the way a content blocker does. Allow them on a site from the shield in its address bar, or here, one host per line.', `<label class="bw-check"><input type="checkbox" id="browser-blocking" ${s.browser?.blocking?.enabled === false ? '' : 'checked'}> Block ads and trackers</label><textarea id="browser-blocking-allow" rows="2" placeholder="sites where ads are allowed, one per line">${esc((s.browser?.blocking?.allow || []).join('\n'))}</textarea><small id="browser-blocking-status"></small>`, { stack: true })}
        <h3>When the assistant browses</h3>
        ${setting('Pauses', 'The assistant always pauses before a purchase or payment, sending or publishing, a password, a deletion or an account change, and asks you in this window. Ask-before-every-action pauses on every click, keystroke and address too.', `<div class="bw-seg" id="browser-mode" role="radiogroup" aria-label="When the assistant browses"><button type="button" data-value="auto" aria-checked="${(s.browser?.mode || 'auto') === 'auto'}">Automatic with pauses</button><button type="button" data-value="ask" aria-checked="${s.browser?.mode === 'ask'}">Ask before every action</button></div>`)}
        ${setting('Logged-out tabs', 'Tabs the assistant opens carry none of your sessions: a private partition that forgets everything when the tab closes.', `<label class="bw-check"><input type="checkbox" id="browser-logged-out" ${s.browser?.loggedOut ? 'checked' : ''}> Start the assistant's tabs logged out</label>`)}
        ${setting('Sites the assistant may open', 'Any site, or only the hosts listed (one per line; a host includes its subdomains). Anything else pauses for your answer.', `<div class="bw-seg" id="browser-sites-mode" role="radiogroup" aria-label="Sites the assistant may open"><button type="button" data-value="all" aria-checked="${(s.browser?.sites?.mode || 'all') === 'all'}">Any site</button><button type="button" data-value="list" aria-checked="${s.browser?.sites?.mode === 'list'}">Only these</button></div><textarea id="browser-sites-list" rows="3" placeholder="github.com&#10;docs.example.org" ${s.browser?.sites?.mode === 'list' ? '' : 'hidden'}>${esc((s.browser?.sites?.list || []).join('\n'))}</textarea>`, { stack: true })}
      </section>
      <section data-pane="shortcuts" ${pane !== 'shortcuts' ? 'hidden' : ''}>
        ${SHORTCUTS.map(([group, ...rows]) => `<h3>${esc(group)}</h3><table class="bw-keys">${rows.map(([combo, what]) => `<tr><td>${keys(combo)}</td><td>${esc(what)}</td></tr>`).join('')}</table>`).join('')}
      </section>
      <section data-pane="about" ${pane !== 'about' ? 'hidden' : ''}>
        <div class="bw-about"><span class="bw-mark">b</span><div><b>Barkdown</b><small id="about-version">…</small></div></div>
        ${setting('Updates', '<span id="about-updates">…</span>', '<div class="bw-inline"><button type="button" class="bw-btn" data-act="update-check">Check for updates</button><button type="button" class="bw-btn" data-act="update-download" hidden>Download</button><button type="button" class="bw-btn bw-primary" data-act="update-install" hidden>Restart to update</button><button type="button" class="bw-btn" data-act="snapshot-open" hidden>Open the copy from before the update</button></div>')}
        <h3>Runtime</h3>
        <table class="bw-keys" id="about-runtime"><tr><td>Loading…</td></tr></table>
        <h3>Data</h3>
        <p class="bw-sheet-note"><code>${esc(s.userData)}</code></p>
      </section>
    </div>
    <footer class="bw-settings-foot"><span class="bw-dirty" id="dirty" hidden>${iconHtml('circle-dot', 12)}Unsaved changes</span><span class="bw-spacer"></span><button type="button" data-act="cancel">Cancel</button><button type="button" class="primary" data-act="save">Save</button></footer>
  </div>`);
  const q = sel => dialog.querySelector(sel);
  const qa = sel => [...dialog.querySelectorAll(sel)];

  // What was found for each tool: filled in after the sheet opens, so opening never waits on a process.
  const describeTool = t => !t ? 'Not checked.' : t.ok ? `Found <code>${esc(t.path)}</code>${t.version ? ` · ${esc(t.version)}` : ''}${t.source === 'settings' ? ' (from this setting)' : ''}.${t.advice ? ` <span class="bw-warn" data-tool-fit="${esc(t.fit)}">${esc(t.advice)}</span>` : ''}` : `<span class="bw-warn">${esc(t.problem || 'Not found.')}</span>${t.path && !t.ok && t.source === 'settings' ? ` <code>${esc(t.path)}</code>` : ''}${t.install ? ` <a href="${esc(t.install)}" data-external>Install</a>, then run <code>${esc(t.login)}</code>.` : ''}`;
  // Install links open in the browser, never in this window.
  q('#providers')?.addEventListener('click', e => { const a = e.target.closest('a[data-external]'); if (a) { e.preventDefault(); api.app.openExternal(a.href); } });
  api.providers.tools().then(tools => { for (const name of ['claude', 'codex']) { const el = q(`[data-tool-status="${name}"]`); if (el) el.innerHTML = describeTool(tools[name]); } }).catch(() => {});
  // Updates: what the checker knows, and the one action that fits it. Nothing starts on its own.
  // The copy of the profile taken before the last update (main/updates.js), kept until the next one replaces it.
  const snapshotNote = u => !u.snapshot ? '' : ` ${u.version === u.snapshot.to ? `Updated from ${esc(u.snapshot.from)}.` : `The update to ${esc(u.snapshot.to)} did not install.`} A copy of the profile from before it is kept; import it from Settings › Profile if anything is missing.`;
  const describeUpdates = u => { const when = u.checkedAt ? ` Checked ${new Date(u.checkedAt).toLocaleTimeString()}.` : ''; return (({ off: u.message, idle: `Version ${esc(u.version)} on the ${esc(u.channel)} channel. Not checked yet.`, checking: 'Checking…', snapshotting: 'Taking a copy of the profile before the update…', current: `Version ${esc(u.version)} is the newest on the ${esc(u.channel)} channel.${when}`, available: `Barkdown ${esc(u.latest)} is available.${when}`, downloading: `Downloading Barkdown ${esc(u.latest)}… ${u.percent}%`, downloaded: `Barkdown ${esc(u.latest)} is downloaded.${u.message ? ' <span class="bw-warn">' + esc(u.message) + '</span>' : ''}`, error: `<span class="bw-warn">${esc(u.message || 'The update check failed.')}</span>` })[u.phase] || esc(u.phase)) + snapshotNote(u); };
  const renderUpdates = u => { const el = q('#about-updates'); if (!el) return; el.innerHTML = describeUpdates(u); const show = (sel, on) => { const b = q(sel); if (b) b.hidden = !on; }; show('[data-act="update-check"]', ['idle', 'current', 'error', 'available'].includes(u.phase)); show('[data-act="update-download"]', u.phase === 'available' || (u.phase === 'error' && u.latest)); show('[data-act="update-install"]', u.phase === 'downloaded' && u.signed); show('[data-act="snapshot-open"]', Boolean(u.snapshot)); };
  api.updates.status().then(renderUpdates).catch(() => {});
  const stopUpdates = api.updates.onChange(renderUpdates);
  q('[data-act="update-check"]').onclick = () => api.updates.check().then(renderUpdates).catch(error => toast(errorMessage(error), 'error'));
  q('[data-act="update-download"]').onclick = () => api.updates.download().then(renderUpdates).catch(error => toast(errorMessage(error), 'error'));
  // With a local runtime the profile is prepared first (editors frozen, as for an export): the install takes its copy from that.
  q('[data-act="update-install"]').onclick = async () => { try { const u = await api.updates.status(); if (u.snapshots) await window.__barkdown.prepareProfile(); renderUpdates(await api.updates.install()); } catch (error) { toast(errorMessage(error), 'error'); } };
  q('[data-act="snapshot-open"]').onclick = () => api.updates.status().then(u => u.snapshot && api.app.openPath(u.snapshot.folder)).catch(error => toast(errorMessage(error), 'error'));
  const loginDisposers = qa('[data-login-provider]').map(host => mountProviderLogin(host, host.dataset.loginProvider, result => { const badge = host.closest('[data-provider]').querySelector('.bw-badge'); const ok = result.state === 'signed-in'; badge.textContent = ok ? 'Signed in' : 'Not signed in'; badge.classList.toggle('ok', ok); badge.classList.toggle('off', !ok); }));

  // navigation
  const showPane = id => { qa('[data-pane]').forEach(n => { if (n.tagName === 'BUTTON') n.setAttribute('aria-selected', String(n.dataset.pane === id)); else n.hidden = n.dataset.pane !== id; }); q('.bw-settings-body').scrollTop = 0; };
  qa('nav [data-pane]').forEach(b => { b.onclick = () => showPane(b.dataset.pane); });

  // segmented controls
  const seg = (sel, value, onPick) => {
    const box = q(sel);
    const set = v => { box.dataset.value = v; box.querySelectorAll('button').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.value === v)); b.setAttribute('role', 'radio'); }); };
    set(value);
    box.querySelectorAll('button').forEach(b => { b.onclick = () => { set(b.dataset.value); onPick?.(b.dataset.value); markDirty(); }; });
    return () => box.dataset.value;
  };
  const theme = seg('#theme', original.theme, v => onChange({ theme: v }, true));
  q('#width').value = original.chatWidth; q('#width-value').value = original.chatWidth + '%';
  q('#width').oninput = () => { q('#width-value').value = q('#width').value + '%'; onChange({ chatWidth: Number(q('#width').value) }, true); markDirty(); };
  q('[data-act="open-data"]').onclick = () => api.app.openPath(s.userData);

  // providers
  q(`input[name="provider"][value="${s.provider || 'claude'}"]`).checked = true;
  const syncCards = () => qa('.bw-card').forEach(c => c.classList.toggle('on', c.querySelector('input[name="provider"]').checked));
  syncCards();
  qa('input[name="provider"]').forEach(r => { r.onchange = () => { syncCards(); markDirty(); }; });
  for (const id of ['claude-binary', 'codex-binary']) { const el = q('#' + id); if (el) el.oninput = markDirty; }
  for (const [provider, key] of [['claude', 'claudeModel'], ['codex', 'codexModel']]) {
    const select = q(`#${provider}-model`), custom = q(`#${provider}-model-custom`);
    const value = s[key] || '';
    const listed = value === '' || modelsFor(provider).some(([id]) => id === value);
    select.value = listed ? value : 'custom';
    custom.hidden = listed;
    custom.value = listed ? '' : value;
    select.onchange = () => { custom.hidden = select.value !== 'custom'; if (select.value === 'custom') custom.focus(); markDirty(); };
    custom.oninput = markDirty;
  }
  const modelValue = provider => { const select = q(`#${provider}-model`); return select.value === 'custom' ? q(`#${provider}-model-custom`).value.trim() : select.value; };
  q('#model').value = s.model || 'claude-opus-5';
  let clearKey = false;
  q('[data-act="clear-key"]').onclick = () => { clearKey = true; q('#api-key').value = ''; q('#api-key').placeholder = 'Removed on save'; q('[data-act="clear-key"]').disabled = true; markDirty(); };

  // barkpark
  q('#bp-enabled').checked = Boolean(s.barkpark.enabled);
  const bpMode = seg('#bp-mode', s.barkpark.local?.enabled ? 'local' : s.barkpark.viaCli ? 'cli' : 'http', v => syncBp(v));
  const syncBp = v => { q('#bp-cli-fields').hidden = v !== 'cli'; q('#bp-http-fields').hidden = v !== 'http'; q('#bp-local-fields').hidden = v !== 'local'; q('#bp-dataset').disabled = v === 'local'; };
  syncBp(bpMode());
  q('#bp-source').value = s.barkpark.local?.source || '';
  let localDataDir;
  const showLocal = value => {
    localDataDir = value.dataDir;
    q('#bp-local-status').textContent = value.phase + (value.error ? ' · ' + value.error : '') + (value.server ? ' · ' + value.server : '');
    q('[data-act="local-retry"]').disabled = ['starting', 'recovering', 'stopping'].includes(value.phase) || !s.barkpark.local?.enabled;
  };
  api.barkpark.localStatus().then(showLocal).catch(() => {});
  const unsubscribeLocal = api.barkpark.onLocalStatus(showLocal);
  q('[data-act="local-source"]').onclick = async () => { const folder = await api.app.pickFolder(); if (folder) { q('#bp-source').value = folder; markDirty(); } };
  q('[data-act="local-logs"]').onclick = () => api.app.openPath(localDataDir || s.userData);
  {
    const label = { none: 'Legacy notes, not switched', selected: 'Notes live on Paper since the switch', 'rolled-back': 'Switched back to legacy notes; Paper edits stay on Paper', intent: 'Switch interrupted before replacement', replacing: 'Switch interrupted during replacement', 'rolling-back': 'Rollback interrupted', blocked: 'Switch journal needs inspection' };
    const switchStatus = q('#bp-switch-status'), switchBtn = q('[data-act="switch-paper"]'), rollbackBtn = q('[data-act="switch-rollback"]'), retainedBtn = q('[data-act="switch-retained"]');
    const showSwitch = value => {
      if (!value) { switchStatus.textContent = 'Needs an owned profile and its local runtime'; switchBtn.disabled = true; rollbackBtn.hidden = retainedBtn.hidden = true; return; }
      const st = value?.selection?.status || 'none';
      const changed = value?.selection?.divergence?.details;
      const diverged = Array.isArray(changed) && changed.length ? ` · ${changed.length} Paper${changed.length === 1 ? '' : 's'} changed after the switch (${changed.slice(0, 3).map(c => c.title || c.id).join(', ')}${changed.length > 3 ? ', …' : ''})${value?.selection?.divergence?.reconciled ? '; every change has a decision' : '; reconcile before switching again'}`
        : value?.selection?.reconciliationRequired ? ' · Paper changed after the switch; reconcile before switching again' : '';
      switchStatus.textContent = (label[st] || st) + diverged
        + (value?.selection?.retainedPaperWorkspace ? ' · chats, tabs and page changes from the Paper period are retained, not restored' : '') + (st === 'none' && !s.barkpark.local?.enabled ? ' · needs the local runtime' : '');
      // Retained copies (the legacy navigation, the Paper-era one, a recorded divergence) are files the person can open.
      retainedBtn.hidden = !(value?.retainedDir && (st === 'rolled-back' || value?.selection?.reconciliationRequired));
      retainedBtn.onclick = () => api.app.openPath(value.retainedDir);
      // Each changed Paper opens from here: the reconciliation starts by reading what changed.
      const changedBox = q('#bp-switch-changed'); changedBox.innerHTML = ''; changedBox.hidden = !(Array.isArray(changed) && changed.length);
      for (const c of (Array.isArray(changed) ? changed : []).slice(0, 12)) {
        const b = el(`<button type="button" class="bw-btn" data-changed="${esc(c.id)}" title="${esc(c.kind + ' Paper, ' + c.what)}">${iconHtml('file-text', 13)}${esc(c.title || c.id)}</button>`);
        b.onclick = () => { cancel(); const owner = window.__barkdown.state.barkparkDocs.find(d => d.id === c.id)?.paperOwner || null; window.__barkdown.openTarget({ kind: 'doc', id: c.id, source: 'barkpark', paperOwner: owner, title: c.title || undefined }); };
        const cmp = el(`<button type="button" class="bw-btn" data-compare="${esc(c.id)}">${iconHtml('columns-2', 13)}Compare</button>`);
        cmp.onclick = async () => { cmp.disabled = true; try { showComparison(await api.migration.changed(c.id)); } catch (error) { toast(error.message, 'error'); } finally { cmp.disabled = false; } };
        changedBox.append(b, cmp);
        // The decision for this Paper: keep what is on Paper, or restore the text the switch staged.
        if (c.reconciled) changedBox.append(el(`<span class="bw-status" data-reconciled="${esc(c.id)}">${esc(c.reconciled.action === 'restore' ? 'staged text restored' + (c.reconciled.rev != null ? ' · rev ' + c.reconciled.rev : '') : 'kept as on Paper')}</span>`));
        else {
          const decide = async action => {
            try { showSwitch(await api.migration.reconcile(c.id, action)); toast(action === 'restore' ? 'Staged text restored on Paper.' : 'Kept as on Paper.'); } catch (error) { toast(error.message, 'error'); }
          };
          const keep = el(`<button type="button" class="bw-btn" data-keep="${esc(c.id)}">Keep on Paper</button>`); keep.onclick = () => decide('keep');
          // Restore replaces the Paper's blocks as a new revision: it asks twice, in place (a sheet would replace this one).
          const restore = el(`<button type="button" class="bw-btn" data-restore="${esc(c.id)}" title="Replace the Paper's current blocks with the text the switch staged, as a new revision. Later edits stay in the Paper's history; the legacy notes are untouched.">Restore staged text</button>`);
          restore.onclick = () => { if (restore.dataset.armed) { restore.disabled = true; decide('restore'); } else { restore.dataset.armed = '1'; restore.textContent = 'Confirm: replace the Paper with the staged text'; restore.classList.add('danger'); } };
          changedBox.append(keep, restore);
        }
      }
      switchBtn.disabled = st === 'blocked' || st === 'rolling-back' || (st === 'none' && !s.barkpark.local?.enabled);
      switchBtn.hidden = st === 'selected' || st === 'rolled-back';
      switchBtn.textContent = ['intent', 'replacing'].includes(st) ? 'Resume switch' : 'Switch to Paper';
      rollbackBtn.hidden = !['selected', 'intent', 'replacing', 'rolling-back'].includes(st);
    };
    api.migration.status().then(showSwitch).catch(error => { switchStatus.textContent = error.message; });
    const run = async (action, confirm) => {
      if (!await askConfirm(confirm.message, { title: confirm.title, confirm: confirm.confirm, danger: action === 'rollback' })) return;
      switchBtn.disabled = rollbackBtn.disabled = true; switchStatus.textContent = action === 'switch' ? 'Preparing, backing up, staging and comparing under the hold…' : 'Rolling back under the hold…';
      try { await window.__barkdown.prepareProfile(); const value = action === 'switch' ? await api.migration.switch() : await api.migration.rollback(); showSwitch(value); toast(action === 'switch' ? 'Notes now live on Paper. Reloading.' : 'Back on legacy notes. Reloading.'); setTimeout(() => window.location.reload(), 800); }
      catch (error) { switchStatus.textContent = error.message; toast(error.message, 'error'); switchBtn.disabled = rollbackBtn.disabled = false; api.migration.status().then(showSwitch).catch(() => {}); }
    };
    switchBtn.onclick = () => run('switch', { title: 'Switch this library to Paper?', message: 'Every legacy note is backed up, staged as a Paper and compared while the runtime refuses other writers. Legacy notes stay retained and read-only. You can roll back afterwards.', confirm: 'Switch' });
    rollbackBtn.onclick = () => run('rollback', { title: 'Roll back to legacy notes?', message: 'The legacy navigation is restored exactly. Papers and any edits made on them stay on Paper; nothing is converted back. Chats, tabs and page changes made while on Paper are retained beside the backup, not restored.', confirm: 'Roll back' });
  }
  q('[data-act="local-retry"]').onclick = async () => { try { showLocal(await api.barkpark.localRetry()); } catch (error) { q('#bp-local-status').textContent = error.message; } };
  // Side by side, inside the sheet: the Paper as the switch staged it (or the baseline held it) and as it is now. Read-only.
  function showComparison(view) {
    const box = q('#bp-switch-compare');
    box.innerHTML = `<h4>${esc(view.after.title || view.before.title || view.id)}</h4>
      <p class="bw-muted">${esc(view.kind === 'staged' ? 'Left: as the switch staged it. Right: on Paper now' + (view.after.rev != null ? ' (rev ' + view.after.rev + ')' : '') + '.' : 'Left: in the pre-switch baseline. Right: on Paper now.')} Nothing here changes either side.</p>
      <div class="bw-compare-columns"><pre data-side="before">${esc(view.before.markdown ?? '(no readable content)')}</pre><pre data-side="after">${esc(view.after.markdown ?? '(no readable content)')}</pre></div>
      <div class="bw-inline"><button type="button" class="bw-btn" data-close>Close comparison</button></div>`;
    box.hidden = false; box.querySelector('[data-close]').onclick = () => { box.hidden = true; box.innerHTML = ''; };
    box.scrollIntoView({ block: 'nearest' });
  }

  q('#bp-server').value = s.barkpark.server || '';
  q('#bp-dataset').value = s.barkpark.dataset || 'production';
  q('#bp-writes').checked = Boolean(s.barkpark.writes);
  const status = (text, kind = '') => { const n = q('#bp-status'); n.textContent = text; n.className = 'bw-status ' + kind; };
  ensureCanvasBundle().then(info => { const n = q('#bp-bundle'); if (n) n.textContent = describeCanvasBundle(info); }).catch(e => { const n = q('#bp-bundle'); if (n) n.textContent = 'Editor bundle failed to load: ' + (e?.message || e); });
  q('[data-act="import-cli"]').onclick = async () => {
    status('Asking bp…');
    try { const r = await api.barkpark.importCli(); if (!r.ok) throw new Error(r.error); q('#bp-server').value = r.server; q('#bp-dataset').value = r.dataset; q('#bp-enabled').checked = true; status(`Found ${r.name} (${r.server}, ${r.tier} tier). Reads will go through bp.`, 'ok'); markDirty(); }
    catch (error) { status(error.message, 'err'); }
  };
  q('[data-act="test"]').onclick = async () => {
    status('Testing…');
    try {
      if (bpMode() === 'local') { const value = await api.barkpark.localStatus(); showLocal(value); status(value.phase === 'ready' ? 'Local Barkpark is ready.' : 'Local Barkpark: ' + value.phase, value.phase === 'ready' ? 'ok' : 'err'); return; }
      if (bpMode() === 'cli') { const list = await api.barkpark.list(); status(`bp answered with ${list.length} paper(s).`, 'ok'); return; }
      const r = await api.barkpark.test({ server: q('#bp-server').value, token: q('#bp-token').value || undefined, dataset: q('#bp-dataset').value });
      status(`Connected to ${r.server} (${r.dataset}) · ${r.papers} published paper${r.papers === 1 ? '' : 's'}.`, 'ok');
    } catch (error) { status(error.message, 'err'); }
  };

  // about
  const phases = { 'hold:begin': 'Pausing other writers…', 'hold:held': 'Writing the database…', 'after-dump': 'Copying pictures…', 'after-media': 'Copying profile files…', 'after-store': 'Sealing the export…', 'hold:reopened': 'Finishing…',
    'after-restoring': 'Restoring the database…', 'after-restored': 'Copying profile files…', 'after-imported': 'Finishing…' };
  const stopProgress = api.portable?.onProgress?.(event => { const n = q(event.action === 'export' ? '#profile-export-status' : '#profile-import-status'); if (n && phases[event.phase]) n.textContent = phases[event.phase]; else if (!n) stopProgress?.(); });
  // Refusal reasons are read by a person: the internal code stays in the log.
  const plain = error => String(error?.message || error).replace(/^\[[\w-]+\]\s*/, '');
  const loadProfiles = () => api.profiles.status().then(showProfiles);
  const showProfiles = status => {
    if (!status.enabled) return;
    const unfinished = status.profiles.filter(profile => profile.interruptedImport);
    const box = q('#profile-settings'); box.hidden = false;
    box.innerHTML = setting('Library profile', 'Each profile keeps its own pages, conversations, drafts and connections. Working folders still belong to individual chats.',
      `${selectHtml('profile-choice', status.profiles.map(profile => `<option value="${esc(profile.id)}" ${profile.id === status.profileId ? 'selected' : ''} ${profile.interruptedImport ? 'disabled' : ''}>${esc(profile.name)}${profile.interruptedImport ? ' (import did not finish)' : ''}</option>`).join(''))}<button type="button" class="bw-btn" id="profile-switch">Switch</button>`) +
      setting('New profile', 'Start with an empty library. Your existing profiles stay available.', '<input type="text" id="profile-name" aria-label="New profile name" placeholder="Profile name"><button type="button" class="bw-btn" id="profile-create">Create</button>') +
      setting('Export this profile', 'Writes the library, its pictures, conversations and retained originals to a new folder you choose. Agent turns stop and editing pauses while it runs; Barkdown restarts afterwards. Keys and passwords stay on this machine.<span class="bw-status bw-set-note" id="profile-export-status" role="status"></span>', `<button type="button" class="bw-btn" id="profile-export">${iconHtml('folder-output', 13)}Export…</button>`) +
      setting('Import a profile', 'Reads an export folder and creates a new profile with its own database. The export and your existing profiles are not changed. An export from this Barkdown version or an earlier one can be imported.<span class="bw-status bw-set-note" id="profile-import-status" role="status"></span>', `<button type="button" class="bw-btn" id="profile-import">${iconHtml('folder-input', 13)}Import…</button>`) +
      unfinished.map(profile => setting(`Unfinished import: ${profile.name}`, `This import stopped while ${profile.interruptedImport.phase === 'restoring' ? 'its database was being restored' : profile.interruptedImport.phase === 'restored' ? 'its profile files were being copied' : 'it was being written'}. It cannot be opened. ${profile.interruptedImport.exportAvailable ? 'Run it again from its export folder, or discard it.' : 'Its export folder is no longer there; discard it and import the export again.'} A discarded import goes to the trash; no other profile is touched.<span class="bw-status bw-set-note" data-unfinished-status="${esc(profile.id)}" role="status"></span>`,
        `<div class="bw-inline">${profile.interruptedImport.exportAvailable ? `<button type="button" class="bw-btn" data-import-again="${esc(profile.id)}">Import again</button>` : ''}<button type="button" class="bw-btn" data-import-discard="${esc(profile.id)}">Discard</button></div>`)).join('');
    for (const profile of unfinished) {
      const note = box.querySelector(`[data-unfinished-status="${profile.id}"]`), act = async (run, saying, done) => {
        for (const b of box.querySelectorAll('button')) b.disabled = true; note.className = 'bw-status bw-set-note'; note.textContent = saying;
        try { const result = await run(); toast(done(result)); await loadProfiles(); if (result?.profile) { q('#profile-choice').value = result.profile.id; const said = q('#profile-import-status'); said.textContent = done(result) + ' Choose it above and press Switch to open it.'; said.className = 'bw-status bw-set-note ok'; } }
        catch (error) { await loadProfiles().catch(() => {}); const n = box.querySelector(`[data-unfinished-status="${profile.id}"]`) || q('#profile-import-status'); n.textContent = plain(error); n.className = 'bw-status bw-set-note err'; toast(plain(error), 'error'); }
      };
      const again = box.querySelector(`[data-import-again="${profile.id}"]`);
      if (again) again.onclick = () => act(() => api.portable.importAgain(profile.id), 'Importing again…', result => `Imported “${result.profile.name}” with ${result.papers} Paper${result.papers === 1 ? '' : 's'}.`);
      box.querySelector(`[data-import-discard="${profile.id}"]`).onclick = () => act(() => api.portable.discardImport(profile.id), 'Discarding…', () => `Discarded the unfinished import “${profile.name}”.`);
    }
    const busy = on => { for (const id of ['#profile-export', '#profile-import', '#profile-switch', '#profile-create']) { const n = q(id); if (n) n.disabled = on; } };
    q('#profile-export').onclick = async () => {
      const note = q('#profile-export-status'); note.className = 'bw-status bw-set-note';
      if (dirty) { toast('Save or cancel Settings changes before exporting.', 'error'); return; }
      busy(true);
      try {
        const chosen = await api.portable.chooseExport();
        if (!chosen) { note.textContent = ''; return; }
        note.textContent = 'Preparing the profile…';
        await window.__barkdown.prepareProfile();
        const done = await api.portable.export();
        note.textContent = `Exported ${done.papers} Paper${done.papers === 1 ? '' : 's'} to ${done.folder}`; note.className = 'bw-status bw-set-note ok';
        toast('Export completed. Restart Barkdown to continue editing.');
      } catch (error) { note.textContent = plain(error); note.className = 'bw-status bw-set-note err'; toast(plain(error), 'error'); }
      finally { busy(false); await window.__barkdown.preparationStatus?.().catch(() => {}); }
    };
    q('#profile-import').onclick = async () => {
      const note = q('#profile-import-status'); note.className = 'bw-status bw-set-note';
      busy(true);
      try {
        note.textContent = 'Choose the export folder…';
        const done = await api.portable.import();
        if (!done) { note.textContent = ''; return; }
        const option = document.createElement('option'); option.value = done.profile.id; option.textContent = done.profile.name;
        q('#profile-choice').append(option); q('#profile-choice').value = done.profile.id;
        note.textContent = `Imported “${done.profile.name}” with ${done.papers} Paper${done.papers === 1 ? '' : 's'}. Choose it above and press Switch to open it.`; note.className = 'bw-status bw-set-note ok';
        toast('Profile imported.');
      } catch (error) { note.textContent = plain(error); note.className = 'bw-status bw-set-note err'; toast(plain(error), 'error'); }
      finally { busy(false); }
    };
    q('#profile-switch').onclick = async () => {
      try {
        if (q('#profile-choice').value === status.profileId) return;
        if (dirty) { toast('Save or cancel Settings changes before switching profiles.', 'error'); return; }
        if (!await beforeProfileSwitch()) return;
        await api.profiles.select(q('#profile-choice').value);
        window.location.reload();
      } catch (error) { toast(plain(error), 'error'); }
    };
    q('#profile-create').onclick = async () => {
      try {
        const profile = await api.profiles.create(q('#profile-name').value.trim());
        const option = document.createElement('option'); option.value = profile.id; option.textContent = profile.name;
        q('#profile-choice').append(option); q('#profile-choice').value = profile.id; q('#profile-name').value = '';
      } catch (error) { toast(plain(error), 'error'); }
    };
  };
  api.profiles?.status().then(showProfiles).catch(error => toast(error.message, 'error'));
  api.app.info?.().then(info => {
    q('#about-version').textContent = `Version ${info.version} · ${info.platform} ${info.arch}`;
    q('#about-runtime').innerHTML = [['Electron', info.electron], ['Chromium', info.chrome], ['Node', info.node]].map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
  }).catch(() => { q('#about-version').textContent = ''; });

  // dirty tracking and close
  let dirty = false, saving = false;
  function markDirty() { dirty = true; q('#dirty').hidden = false; }
  qa('input[type=text], input[type=password], input[type=checkbox]:not(#full-yolo), select').forEach(n => n.addEventListener('input', markDirty));
  // Full YOLO is not part of Save: the switch itself is the act, and only a person reaches it (C094).
  const yolo = q('#full-yolo'); if (yolo) { yolo.checked = Boolean(s.control?.fullYolo); yolo.onchange = async () => { try { const result = await api.control.setFullYolo(yolo.checked); state.settings = { ...state.settings, control: { ...(state.settings.control || {}), fullYolo: result.fullYolo } }; yolo.checked = result.fullYolo; toast(result.fullYolo ? (result.kept ? 'Full YOLO is on' : 'Full YOLO is on until Barkdown closes (the system keychain is unavailable)') : 'Full YOLO is off'); } catch (error) { yolo.checked = !yolo.checked; toast(error.message, 'error'); } }; }
  const dismiss = openDialog(dialog, { onDismiss: () => cancel() });
  const close = () => { loginDisposers.forEach(dispose => dispose()); stopUpdates(); unsubscribeLocal(); dismiss(); };
  const cancel = () => { if (saving) return; onChange({ theme: original.theme, chatWidth: original.chatWidth }, true); close(); };
  q('[data-act="cancel"]').onclick = cancel;
  // The Browser pane: sources to import from, the last import, remembered site permissions.
  const plainError = error => String(error?.message || error).replace(/^\[[\w-]+\]\s*/, '');
  const renderBrowserPane = async () => {
    const box = q('#browser-sources'), note = q('#browser-import-status'), sites = q('#browser-sites');
    if (!box) return;
    const working = on => box.querySelectorAll('[data-import]').forEach(b => { b.disabled = on; });
    try {
      const [sources, places] = await Promise.all([api.browser.sources(), api.browser.places()]);
      box.innerHTML = sources.length ? sources.map((s, i) => `<div class="bw-source"><b>${esc(s.browserName)}</b><span>${esc(s.name)}</span><small>${s.has.bookmarks ? 'bookmarks' : ''}${s.has.bookmarks && s.has.history ? ' · ' : ''}${s.has.history ? 'history' : ''}</small><span class="bw-spacer"></span><button type="button" class="bw-btn" data-import="${i}">Import</button></div>`).join('') : '<small>No Chromium browser profile was found under this account.</small>';
      note.textContent = places ? `Last import: ${places.counts.bookmarks} bookmarks (${places.counts.bar} on the bar) and ${places.counts.history} history entries from ${places.source.browserName} “${places.source.profileDir}” on ${new Date(places.importedAt).toLocaleString()}.` : '';
      box.querySelectorAll('[data-import]').forEach(b => { b.onclick = async () => {
        const s = sources[Number(b.dataset.import)]; working(true); note.className = 'bw-status bw-set-note'; note.textContent = `Importing from ${s.browserName}…`;
        try { const result = await api.browser.import({ browser: s.browser, profileDir: s.profileDir }); const added = window.__barkdown?.addFavorites?.(result.bar) || 0; note.className = 'bw-status bw-set-note ok'; note.textContent = `Imported ${result.counts.bookmarks} bookmarks and ${result.counts.history} history entries; ${added} new Favorite${added === 1 ? '' : 's'} from the bookmarks bar. The address bar suggests them now.`; }
        catch (error) { note.className = 'bw-status bw-set-note err'; note.textContent = plainError(error); }
        finally { working(false); }
      }; });
    } catch (error) { box.innerHTML = `<small>${esc(plainError(error))}</small>`; }
    try {
      const list = await api.browser.permissions();
      sites.innerHTML = list.length ? list.map(site => `<div class="bw-site"><code>${esc(site.origin)}</code><span>${['media', 'notifications', 'geolocation'].filter(k => site[k]).map(k => `${k === 'media' ? 'camera/microphone' : k}: ${esc(site[k])}`).join(', ')}</span><span class="bw-spacer"></span><button type="button" class="bw-btn" data-forget="${esc(site.origin)}">Forget</button></div>`).join('') : '<small>No site has asked yet.</small>';
      sites.querySelectorAll('[data-forget]').forEach(b => { b.onclick = async () => { await api.browser.forgetPermission(b.dataset.forget); renderBrowserPane(); }; });
    } catch (error) { sites.innerHTML = `<small>${esc(plainError(error))}</small>`; }
  };
  renderBrowserPane();
  // The assistant's browsing policy: segmented choices and the host list, saved with the rest.
  const segPick = (id, onPick) => qa(`${id} button`).forEach(b => { b.onclick = () => { qa(`${id} button`).forEach(x => x.setAttribute('aria-checked', String(x === b))); onPick?.(b.dataset.value); markDirty(); }; });
  segPick('#approvals'); segPick('#browser-mode'); segPick('#browser-sites-mode', v => { const list = q('#browser-sites-list'); if (list) list.hidden = v !== 'list'; });
  q('#browser-logged-out').onchange = markDirty; q('#browser-sites-list').oninput = markDirty; q('#browser-blocking').onchange = markDirty; q('#browser-blocking-allow').oninput = markDirty;
  api.browser.blocking().then(b => { const n = q('#browser-blocking-status'); if (n) n.textContent = !b.enabled ? 'Off.' : b.ready ? `Lists ${b.source === 'list' ? 'from a file' : 'from Ghostery'}, loaded ${new Date(b.updatedAt).toLocaleString()}.` : b.error ? `The lists could not be loaded: ${b.error}` : 'Loading the lists…'; }).catch(() => {});
  const browserPatch = () => ({ mode: q('#browser-mode [aria-checked="true"]')?.dataset.value || 'auto', loggedOut: q('#browser-logged-out').checked, sites: { mode: q('#browser-sites-mode [aria-checked="true"]')?.dataset.value || 'all', list: q('#browser-sites-list').value.split(/\n+/).map(v => v.trim().toLowerCase()).filter(Boolean) }, blocking: { enabled: q('#browser-blocking').checked, allow: q('#browser-blocking-allow').value.split(/\n+/).map(v => v.trim().toLowerCase()).filter(Boolean) } });
  q('[data-act="original-history"]').onclick = () => {
    if (dirty || saving) { toast('Save or cancel Settings changes before opening original history.', 'error'); return; }
    close(); openOriginalHistory();
  };
  const draftsButton = q('[data-act="retained-drafts"]');
  if (draftsButton) draftsButton.onclick = () => {
    if (dirty || saving) { toast('Save or cancel Settings changes before opening retained drafts.', 'error'); return; }
    close(); openRetainedDrafts({ api, owner: { profileId: state.profileId, generation: state.generation },
      isCurrent: owner => owner.profileId === state.profileId && owner.generation === state.generation });
  };
  q('[data-act="save"]').onclick = async () => {
    if (saving) return;
    const patch = { model: q('#model').value, provider: q('input[name="provider"]:checked').value, claudeModel: modelValue('claude'), codexModel: modelValue('codex'), theme: theme(), chatWidth: Number(q('#width').value), barkpark: { enabled: q('#bp-enabled').checked, viaCli: bpMode() === 'cli', server: q('#bp-server').value.trim(), dataset: q('#bp-dataset').value.trim() || 'production', writes: q('#bp-writes').checked, local: { ...s.barkpark.local, enabled: bpMode() === 'local', source: q('#bp-source').value.trim() } } };
    if (q('#api-key').value.trim()) patch.apiKey = q('#api-key').value.trim(); else if (clearKey) patch.apiKey = '';
    patch.browser = browserPatch(); patch.approvals = q('#approvals [aria-checked="true"]')?.dataset.value === 'ask' ? 'ask' : 'none';
    const binaries = { claude: q('#claude-binary')?.value.trim() ?? '', codex: q('#codex-binary')?.value.trim() ?? '' };
    if (binaries.claude !== (s.providerBinary?.claude || '') || binaries.codex !== (s.providerBinary?.codex || '')) patch.providerBinary = binaries;
    if (q('#bp-token').value.trim()) patch.barkpark.token = q('#bp-token').value.trim();
    saving = true; dialog.setAttribute('aria-busy', 'true');
    const controls = qa('input, select, button').map(control => ({ control, disabled: control.disabled }));
    for (const { control } of controls) control.disabled = true;
    q('[data-act="save"]').textContent = 'Saving…';
    try {
      state.settings = await api.settings.set(patch); window.dispatchEvent(new Event('barkdown:approvals')); onChange(patch, false); toast('Settings saved'); close();
      // A (re)connected Barkpark: fetch its editor bundle now; if a different build is already running, say so.
      refreshCanvasBundleAfterSettings().then(info => { if (state.canvasBundle?.next) toast(`Barkpark's editor bundle (sha1 ${info.sha.slice(0, 8)}) is fetched — restart Barkdown to use it`); });
    } catch (error) { toast(error.message, 'error'); }
    finally {
      saving = false; dialog.removeAttribute('aria-busy');
      for (const { control, disabled } of controls) control.disabled = disabled;
      q('[data-act="save"]').textContent = 'Save';
    }
  };
  setTimeout(() => q('nav [aria-selected="true"]')?.focus(), 30);
}
