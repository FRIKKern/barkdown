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
  { name: 'chat.new', tier: 'act', where: 'renderer', aliases: ['agent.add'], summary: 'Start a chat (an agent): optionally with a folder, a provider, a model, an effort and a first message', args: { title: arg('string', 'its title', { positional: true }), folder: arg('path', 'working folder for the agent'), provider: arg('string', 'claude | codex | api'), model: arg('string', 'model id'), effort: arg('string', 'reasoning effort'), message: arg('text', 'send this as the first message'), image: arg('paths', 'with --message: attach an image (PNG, JPEG, GIF or WebP); repeat for more'), wait: arg('boolean', 'with --message: wait for the reply and print it') }, example: 'barkdown agent add "Refactor the parser" --folder ~/code/parser --message "Read src/ and propose a plan"', timeoutMs: 15 * 60 * 1000 },
  { name: 'chat.open', tier: 'act', where: 'renderer', summary: 'Switch to a chat', args: { chat: arg('string', 'chat id or title', { required: true, positional: true }) }, example: 'barkdown chat open "Refactor the parser"' },
  { name: 'chat.rename', tier: 'act', where: 'renderer', summary: 'Rename a chat', args: { chat: arg('string', 'chat id or title', { required: true, positional: true }), title: arg('string', 'the new title', { required: true, positional: true }) }, example: 'barkdown chat rename "New chat" "Release notes"' },
  { name: 'chat.set', tier: 'act', where: 'renderer', summary: 'Change a chat\'s working folder, provider, model or effort', args: { chat: arg('string', 'chat id or title (default: the current chat)'), folder: arg('path', 'working folder; "none" clears it'), provider: arg('string', 'claude | codex | api'), model: arg('string', 'model id; "default" clears it'), effort: arg('string', 'effort; "default" clears it') }, example: 'barkdown chat set --model claude-sonnet-5-5 --effort low' },
  { name: 'chat.send', tier: 'act', where: 'renderer', summary: 'Send a message in a chat, as typing it and pressing Enter does', args: { message: arg('text', 'the message ("-" reads standard input)', { required: true, positional: true }), chat: arg('string', 'chat id or title (default: the current chat)'), image: arg('paths', 'attach an image (PNG, JPEG, GIF or WebP); repeat for more'), wait: arg('boolean', 'wait for the reply and print it') }, example: 'barkdown chat send "What is wrong in this screenshot?" --image ~/Desktop/shot.png --wait', timeoutMs: 15 * 60 * 1000 },
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
  { name: 'note.edit', tier: 'act', where: 'renderer', summary: 'Change a note\'s text as an assistant\'s edit does: append to it, or replace its body (the title stays). Undo is offered in the note', args: { note: arg('string', 'note id or title', { required: true, positional: true }), markdown: arg('text', 'the text as Markdown ("-" reads standard input, "@file" reads a file)', { required: true, positional: true }), mode: arg('string', 'append (default) | replace'), rev: arg('number', 'the revision you read (note read prints it); required for replace, so a note changed since is never overwritten'), summary: arg('string', 'what the edit does, shown beside Undo') }, example: 'barkdown note edit "Standup" "- reviewed the release notes"', timeoutMs: 90 * 1000 },
  { name: 'note.undo', tier: 'act', where: 'renderer', summary: 'Undo the latest edit made by an assistant or by note edit, if the note has not changed since', args: { note: arg('string', 'note id or title', { required: true, positional: true }) }, example: 'barkdown note undo "Standup"', timeoutMs: 90 * 1000 },
  { name: 'note.deleted', tier: 'read', where: 'renderer', summary: 'The deleted notes a copy can be recovered from', args: {}, example: 'barkdown note deleted' },
  { name: 'note.recover', tier: 'act', where: 'renderer', summary: 'Recover a deleted note as a separate copy and open it (links and Pages stay with the original)', args: { note: arg('string', 'the key or title note deleted prints', { required: true, positional: true }) }, example: 'barkdown note recover "Old plan"', timeoutMs: 90 * 1000 },
  { name: 'note.delete', tier: 'admin', where: 'renderer', summary: 'Delete a note; its snapshot is kept, and note recover brings back a copy', args: { note: arg('string', 'note id or title', { required: true, positional: true }) }, example: 'barkdown note delete "Scratch"', timeoutMs: 90 * 1000 },
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

  // ── goals: bounded work a chat coordinates, each worker in a side chat ─────────────────────────────────
  { name: 'goal.list', tier: 'read', where: 'renderer', summary: 'A chat\'s goals, with their state and tasks', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }) }, example: 'barkdown goal list' },
  { name: 'goal.new', tier: 'act', where: 'renderer', summary: 'Give a chat a goal: its assistant plans three workers, runs them in side chats and reviews them, within the time window', args: { objective: arg('text', 'what the goal is to achieve', { required: true, positional: true }), minutes: arg('number', 'the time window in minutes (1 to 10080)', { required: true }), chat: arg('string', 'chat id or title (default: the current chat)'), start: arg('boolean', 'start it at once (default yes; --no-start leaves it ready)') }, example: 'barkdown goal new "Make the test suite pass on Windows" --minutes 60', timeoutMs: 60 * 1000 },
  { name: 'goal.start', tier: 'act', where: 'renderer', summary: 'Start or resume a goal', args: { goal: arg('string', 'goal id, or its objective', { required: true, positional: true }), chat: arg('string', 'chat id or title (default: the current chat)') }, example: 'barkdown goal start goal-1', timeoutMs: 60 * 1000 },
  { name: 'goal.pause', tier: 'act', where: 'renderer', summary: 'Pause a goal: running workers are stopped, and a person reviews before it resumes', args: { goal: arg('string', 'goal id, or its objective', { required: true, positional: true }), chat: arg('string', 'chat id or title (default: the current chat)') }, example: 'barkdown goal pause goal-1', timeoutMs: 60 * 1000 },
  { name: 'goal.cancel', tier: 'act', where: 'renderer', summary: 'Cancel a goal', args: { goal: arg('string', 'goal id, or its objective', { required: true, positional: true }), chat: arg('string', 'chat id or title (default: the current chat)') }, example: 'barkdown goal cancel goal-1', timeoutMs: 60 * 1000 },
  { name: 'goal.open', tier: 'act', where: 'renderer', summary: 'Show a chat\'s goals to the person, where they review workers\' results', args: { chat: arg('string', 'chat id or title (default: the current chat)', { positional: true }) }, example: 'barkdown goal open' },

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
  { name: 'profile.portable', tier: 'read', where: 'main', summary: 'The last export of this profile and any unfinished imports', args: {}, example: 'barkdown profile portable' },
  { name: 'profile.export', tier: 'admin', where: 'renderer', summary: 'Export this profile into a new folder inside the one given. Editing pauses until a person restarts Barkdown', args: { folder: arg('path', 'the folder the export goes into', { required: true, positional: true }) }, example: 'barkdown profile export ~/Backups', timeoutMs: 15 * 60 * 1000 },
  { name: 'profile.import', tier: 'admin', where: 'renderer', summary: 'Import a profile export as a new profile (it is not switched to)', args: { folder: arg('path', 'the export folder (the one holding manifest.json)', { required: true, positional: true }) }, example: 'barkdown profile import ~/Backups/Barkdown-Personal-2026-10-05', timeoutMs: 15 * 60 * 1000 },
  { name: 'profile.discard', tier: 'admin', where: 'main', summary: 'Discard an unfinished import: its half-made profile goes to the trash', args: { profile: arg('string', 'profile id or name, as profile portable prints it', { required: true, positional: true }) }, example: 'barkdown profile discard "Personal (import)"', timeoutMs: 120 * 1000 },

  // ── the Paper switch: a profile's legacy notes move to Paper, and back ──────────────────────────────
  { name: 'paper.status', tier: 'read', where: 'main', summary: 'Whether this library has switched to Paper, and any Paper changed after the switch', args: {}, example: 'barkdown paper status' },
  { name: 'paper.compare', tier: 'read', where: 'main', summary: 'A changed Paper as the switch staged it and as it is now, side by side', args: { note: arg('string', 'the Paper id paper status lists', { required: true, positional: true }) }, example: 'barkdown paper compare drafts.abc123' },
  { name: 'paper.switch', tier: 'admin', where: 'renderer', summary: 'Switch this library to Paper, or resume an interrupted switch: backed up, staged and compared. Editing pauses until a person restarts Barkdown', args: {}, example: 'barkdown paper switch', timeoutMs: 15 * 60 * 1000 },
  { name: 'paper.rollback', tier: 'admin', where: 'renderer', summary: 'Roll back to legacy notes; Papers and their edits stay on Paper. Editing pauses until a person restarts Barkdown', args: {}, example: 'barkdown paper rollback', timeoutMs: 15 * 60 * 1000 },
  { name: 'paper.reconcile', tier: 'admin', where: 'main', summary: 'Decide one Paper changed after the switch: keep it as on Paper, or restore the staged text as a new revision', args: { note: arg('string', 'the Paper id paper status lists', { required: true, positional: true }), action: arg('string', 'keep | restore', { required: true, positional: true }) }, example: 'barkdown paper reconcile drafts.abc123 keep', timeoutMs: 120 * 1000 },
  { name: 'library.status', tier: 'read', where: 'main', summary: 'The local library: connected or not, and why not', args: {}, example: 'barkdown library status' },
  { name: 'library.retry', tier: 'admin', where: 'renderer', summary: 'Start the local library again after a failure', args: {}, example: 'barkdown library retry', timeoutMs: 120 * 1000 },
  { name: 'provider.status', tier: 'read', where: 'main', summary: 'Which assistant providers are signed in', args: {}, example: 'barkdown provider status' },
  { name: 'provider.check', tier: 'read', where: 'main', summary: 'Ask Claude Code or Codex whether it is signed in now, and show a sign-in in progress', args: { provider: arg('string', 'claude | codex', { required: true, positional: true }) }, example: 'barkdown provider check claude', timeoutMs: 60 * 1000 },
  { name: 'provider.login', tier: 'admin', where: 'main', summary: 'Start signing in to Claude Code or Codex: its sign-in page opens in the browser, and a person finishes it there', args: { provider: arg('string', 'claude | codex', { required: true, positional: true }), wait: arg('boolean', 'wait until the person has finished (up to five minutes)') }, example: 'barkdown provider login codex --wait', timeoutMs: 6 * 60 * 1000 },
  { name: 'provider.cancel', tier: 'act', where: 'main', summary: 'Cancel a sign-in in progress', args: { provider: arg('string', 'claude | codex', { required: true, positional: true }) }, example: 'barkdown provider cancel codex' },
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
  'profile.restart': 'After an export, a person restarts Barkdown to edit again: restarting is the person\'s.',
  'provider.logout': 'Barkdown has no sign-out. Sign out in Claude Code or Codex itself.',
  'goal.review': 'Accepting or retrying a worker\'s result is a person\'s word that it was verified: do it in the goal view (barkdown goal open).',
  'goal.accept': 'Accepting or retrying a worker\'s result is a person\'s word that it was verified: do it in the goal view (barkdown goal open).',
  'goal.complete': 'Completing a goal is a person\'s word that its results were verified: do it in the goal view (barkdown goal open).',
  'goal.reconcile': 'Confirming that a worker has stopped is a person\'s: do it in the goal view (barkdown goal open).',
};
// Settings a command may never write, whatever the tier: the switch itself and secrets.
const SETTINGS_NEVER = [/^control(\.|$)/, /^apiKey/i, /token/i, /^barkpark\.local\.source$/];

const byName = new Map();
for (const command of COMMANDS) { byName.set(command.name, command); for (const alias of command.aliases || []) byName.set(alias, command); }
const find = name => byName.get(String(name || '').toLowerCase()) || null;

module.exports = { COMMANDS, FORBIDDEN, SETTINGS_NEVER, find };
