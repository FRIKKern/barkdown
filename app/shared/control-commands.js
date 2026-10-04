// The command catalogue of Barkdown's control surface (C094): what the `barkdown` CLI and the assistant's
// `app` tool can ask the running app to do. One list, read by the main process (which decides whether a
// command may run) and by the renderer (which carries most of them out through the same functions a
// person's click reaches).
//
// tier   read   look, change nothing
//        act    what a person does all day: chats, messages, notes, tabs, the terminal
//        admin  settings, profiles, the library's switches, deletions: needs Full YOLO, which only a person
//               can turn on in Settings
// where  main | renderer: which process carries it out
// args   name -> { type, required?, positional?, help }; a positional arg may be given without its flag
const arg = (type, help, extra = {}) => ({ type, help, ...extra });

const COMMANDS = [
  // ── the app ──────────────────────────────────────────────────────────────────────────────────────────
  { name: 'status', tier: 'read', where: 'main', summary: 'What is running: version, profile, Full YOLO, the library, the current chat', args: {}, example: 'barkdown status' },
  { name: 'commands', tier: 'read', where: 'main', summary: 'Every command, with what it needs and whether it may run now', args: { group: arg('string', 'only this group, e.g. chat', { positional: true }) }, example: 'barkdown commands chat' },
  { name: 'log', tier: 'read', where: 'main', summary: 'The last commands this control surface carried out', args: { limit: arg('number', 'how many, newest last (default 20)') }, example: 'barkdown log --limit 5' },

  // ── chats: every chat is an agent with its own folder, provider, model and tabs ──────────────────────
  { name: 'chat.list', tier: 'read', where: 'renderer', summary: 'The chats, newest first, with folder, provider and whether a run is in flight', args: {}, example: 'barkdown chat list' },
  { name: 'chat.read', tier: 'read', where: 'renderer', summary: 'A chat\'s messages as text', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }), last: arg('number', 'only the last N messages') }, example: 'barkdown chat read --last 4' },
  { name: 'chat.new', tier: 'act', where: 'renderer', aliases: ['agent.add'], summary: 'Start a chat (an agent): optionally with a folder, a provider, a model, an effort and a first message', args: { title: arg('string', 'its title', { positional: true }), folder: arg('path', 'working folder for the agent'), provider: arg('string', 'claude | codex | api'), model: arg('string', 'model id'), effort: arg('string', 'reasoning effort'), message: arg('text', 'send this as the first message'), wait: arg('boolean', 'with --message: wait for the reply and print it') }, example: 'barkdown agent add "Refactor the parser" --folder ~/code/parser --message "Read src/ and propose a plan"', timeoutMs: 15 * 60 * 1000 },
  { name: 'chat.open', tier: 'act', where: 'renderer', summary: 'Switch to a chat', args: { chat: arg('string', 'chat id or title', { required: true, positional: true }) }, example: 'barkdown chat open "Refactor the parser"' },
  { name: 'chat.rename', tier: 'act', where: 'renderer', summary: 'Rename a chat', args: { chat: arg('string', 'chat id or title', { required: true, positional: true }), title: arg('string', 'the new title', { required: true, positional: true }) }, example: 'barkdown chat rename "New chat" "Release notes"' },
  { name: 'chat.set', tier: 'act', where: 'renderer', summary: 'Change a chat\'s working folder, provider, model or effort', args: { chat: arg('string', 'chat id or title (default: the current chat)'), folder: arg('path', 'working folder; "none" clears it'), provider: arg('string', 'claude | codex | api'), model: arg('string', 'model id; "default" clears it'), effort: arg('string', 'effort; "default" clears it') }, example: 'barkdown chat set --model claude-sonnet-5-5 --effort low' },
  { name: 'chat.send', tier: 'act', where: 'renderer', summary: 'Send a message in a chat, as typing it and pressing Enter does', args: { message: arg('text', 'the message ("-" reads standard input)', { required: true, positional: true }), chat: arg('string', 'chat id or title (default: the current chat)'), wait: arg('boolean', 'wait for the reply and print it') }, example: 'barkdown chat send "Summarise the open tabs" --wait', timeoutMs: 15 * 60 * 1000 },
  { name: 'chat.wait', tier: 'read', where: 'renderer', summary: 'Wait until a chat\'s run has finished, then print the reply', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }) }, example: 'barkdown chat wait', timeoutMs: 15 * 60 * 1000 },
  { name: 'chat.stop', tier: 'act', where: 'renderer', summary: 'Stop the run in a chat', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }) }, example: 'barkdown chat stop' },
  { name: 'chat.approve', tier: 'act', where: 'renderer', summary: 'Answer a waiting approval card: allow it, or decline with --decline', args: { chat: arg('string', 'chat id or title (default: the current chat)'), decline: arg('boolean', 'decline instead of allowing') }, example: 'barkdown chat approve' },
  { name: 'chat.side', tier: 'act', where: 'renderer', summary: 'Open a side chat beside the current chat', args: { title: arg('string', 'its title', { positional: true }) }, example: 'barkdown chat side "Check the licence"' },
  { name: 'chat.delete', tier: 'admin', where: 'renderer', summary: 'Delete a chat', args: { chat: arg('string', 'chat id or title', { required: true, positional: true }) }, example: 'barkdown chat delete "Scratch"' },

  // ── notes: documents in the library ──────────────────────────────────────────────────────────────────
  { name: 'note.list', tier: 'read', where: 'renderer', summary: 'The notes in the library', args: {}, example: 'barkdown note list' },
  { name: 'note.search', tier: 'read', where: 'renderer', summary: 'Search the library', args: { query: arg('string', 'what to look for', { required: true, positional: true }) }, example: 'barkdown note search "release plan"' },
  { name: 'note.read', tier: 'read', where: 'renderer', summary: 'A note as Markdown', args: { note: arg('string', 'note id or title', { required: true, positional: true }) }, example: 'barkdown note read "Release plan"' },
  { name: 'note.new', tier: 'act', where: 'renderer', summary: 'Create a note in the library and open it; give its text as Markdown (the first heading is the title)', args: { markdown: arg('text', 'the note as Markdown ("-" reads standard input, "@file" reads a file)', { positional: true }), title: arg('string', 'a title, when the Markdown has no heading') }, example: 'barkdown note new --title "Standup" "- shipped the CLI\\n- next: docs"', timeoutMs: 90 * 1000 },
  { name: 'note.open', tier: 'act', where: 'renderer', summary: 'Open a note in a tab beside the current chat', args: { note: arg('string', 'note id or title', { required: true, positional: true }) }, example: 'barkdown note open "Release plan"' },
  { name: 'note.page', tier: 'act', where: 'renderer', summary: 'Put a note in the sidebar\'s Pages', args: { note: arg('string', 'note id or title', { required: true, positional: true }) }, example: 'barkdown note page "Release plan"' },

  // ── work tabs of a chat ──────────────────────────────────────────────────────────────────────────────
  { name: 'tab.list', tier: 'read', where: 'renderer', summary: 'The work tabs of a chat', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }) }, example: 'barkdown tab list' },
  { name: 'tab.open', tier: 'act', where: 'renderer', summary: 'Open a work tab: a website, a terminal, a project file, a review, or a note', args: { kind: arg('string', 'web | terminal | project | review | note', { required: true, positional: true }), target: arg('string', 'the address, file path, or note', { positional: true }) }, example: 'barkdown tab open web https://example.com' },
  { name: 'tab.activate', tier: 'act', where: 'renderer', summary: 'Bring a tab to the front', args: { tab: arg('string', 'tab id, title or position (1 is the first)', { required: true, positional: true }) }, example: 'barkdown tab activate 2' },
  { name: 'tab.rename', tier: 'act', where: 'renderer', summary: 'Rename a tab', args: { tab: arg('string', 'tab id, title or position', { required: true, positional: true }), title: arg('string', 'the new title', { required: true, positional: true }) }, example: 'barkdown tab rename 1 "Docs"' },
  { name: 'tab.close', tier: 'act', where: 'renderer', summary: 'Close a tab', args: { tab: arg('string', 'tab id, title or position', { required: true, positional: true }) }, example: 'barkdown tab close 2' },

  // ── the terminal tab ─────────────────────────────────────────────────────────────────────────────────
  { name: 'terminal.run', tier: 'act', where: 'renderer', summary: 'Type a command into the chat\'s terminal tab (opening one if needed) and press Enter', args: { command: arg('text', 'the command line', { required: true, positional: true }), wait: arg('number', 'seconds to wait before reading the screen back (default 2)') }, example: 'barkdown terminal run "git status"', timeoutMs: 120 * 1000 },
  { name: 'terminal.read', tier: 'read', where: 'renderer', summary: 'What the chat\'s terminal tab shows', args: { lines: arg('number', 'only the last N lines') }, example: 'barkdown terminal read --lines 20' },

  // ── favorites and the window ─────────────────────────────────────────────────────────────────────────
  { name: 'favorite.list', tier: 'read', where: 'renderer', summary: 'The favorites', args: {}, example: 'barkdown favorite list' },
  { name: 'favorite.add', tier: 'act', where: 'renderer', summary: 'Bookmark the active tab of the current chat', args: {}, example: 'barkdown favorite add' },
  { name: 'ui.show', tier: 'act', where: 'renderer', summary: 'Show a part of the window to the person: settings (optionally a pane), palette, sidebar', args: { what: arg('string', 'settings | palette | sidebar', { required: true, positional: true }), pane: arg('string', 'for settings: general | assistant | barkpark | browser | shortcuts | about', { positional: true }) }, example: 'barkdown ui show settings browser' },
  { name: 'ui.notify', tier: 'act', where: 'renderer', summary: 'Show a short notice in the window', args: { text: arg('text', 'the notice', { required: true, positional: true }) }, example: 'barkdown ui notify "Build finished"' },

  // ── settings and everything administrative: Full YOLO ───────────────────────────────────────────────
  { name: 'settings.get', tier: 'read', where: 'main', summary: 'The settings (secrets are never included)', args: { key: arg('string', 'one key, dotted, e.g. browser.mode', { positional: true }) }, example: 'barkdown settings get theme' },
  { name: 'settings.set', tier: 'admin', where: 'renderer', summary: 'Change a setting, as saving Settings does', args: { key: arg('string', 'dotted key, e.g. theme, approvals, chatWidth, provider, claudeModel, browser.mode', { required: true, positional: true }), value: arg('json', 'the new value', { required: true, positional: true }) }, example: 'barkdown settings set theme dark' },
  { name: 'profile.list', tier: 'read', where: 'main', summary: 'The profiles, and which is selected', args: {}, example: 'barkdown profile list' },
  { name: 'profile.create', tier: 'admin', where: 'renderer', summary: 'Create a profile', args: { name: arg('string', 'its name', { required: true, positional: true }) }, example: 'barkdown profile create "Client work"' },
  { name: 'profile.switch', tier: 'admin', where: 'renderer', summary: 'Switch to another profile, as the switch in Settings does', args: { profile: arg('string', 'profile id or name', { required: true, positional: true }) }, example: 'barkdown profile switch "Client work"', timeoutMs: 120 * 1000 },
  { name: 'library.status', tier: 'read', where: 'main', summary: 'The local library: connected or not, and why not', args: {}, example: 'barkdown library status' },
  { name: 'library.retry', tier: 'admin', where: 'renderer', summary: 'Start the local library again after a failure', args: {}, example: 'barkdown library retry', timeoutMs: 120 * 1000 },
  { name: 'provider.status', tier: 'read', where: 'main', summary: 'Which assistant providers are signed in', args: {}, example: 'barkdown provider status' },
  { name: 'browser.permissions', tier: 'read', where: 'renderer', summary: 'What sites were allowed or denied', args: {}, example: 'barkdown browser permissions' },
  { name: 'browser.forget', tier: 'admin', where: 'renderer', summary: 'Forget a site\'s remembered permission', args: { site: arg('string', 'the site, as browser permissions prints it', { required: true, positional: true }) }, example: 'barkdown browser forget https://meet.example.com' },
  { name: 'updates.status', tier: 'read', where: 'main', summary: 'Whether an update is available', args: {}, example: 'barkdown updates status' },
  { name: 'updates.check', tier: 'admin', where: 'renderer', summary: 'Look for an update now', args: {}, example: 'barkdown updates check', timeoutMs: 60 * 1000 },
];

// What no caller may do through this surface, Full YOLO or not, and why.
const FORBIDDEN = {
  'fullyolo.set': 'Full YOLO is switched on and off by a person in Settings › Assistant. Barkdown cannot switch it for itself.',
  'fullyolo.on': 'Full YOLO is switched on and off by a person in Settings › Assistant. Barkdown cannot switch it for itself.',
  'fullyolo.off': 'Full YOLO is switched on and off by a person in Settings › Assistant. Barkdown cannot switch it for itself.',
  'app.quit': 'Barkdown does not turn itself off: quitting is the person\'s.',
  'app.relaunch': 'Barkdown does not turn itself off and on: restarting is the person\'s.',
  'app.start': 'Barkdown does not start itself: a person opens it.',
  'updates.install': 'Installing an update restarts Barkdown, and restarting is the person\'s.',
};
// Settings a command may never write, whatever the tier: the switch itself and secrets.
const SETTINGS_NEVER = [/^control(\.|$)/, /^apiKey/i, /token/i, /^barkpark\.local\.source$/];

const byName = new Map();
for (const command of COMMANDS) { byName.set(command.name, command); for (const alias of command.aliases || []) byName.set(alias, command); }
const find = name => byName.get(String(name || '').toLowerCase()) || null;

module.exports = { COMMANDS, FORBIDDEN, SETTINGS_NEVER, find };
