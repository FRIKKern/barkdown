#!/usr/bin/env node
// `barkdown`: the command line of the running Barkdown app (C094).
//
//   barkdown <group> <action> [arguments] [--flag value]     barkdown chat send "Summarise the tabs" --wait
//   barkdown commands [group]                                what there is, and what may run now
//   barkdown help <command>                                  one command in full
//
// It carries nothing out itself: it finds the running app (main/control-client.js) and sends one command.
// What may run is decided by the app (main/control.js), so this file holds no rule that matters.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { findInstance, call } = require('../control-client');
const { COMMANDS, FORBIDDEN, find } = require('../../shared/control-commands');

const EXIT = { ok: 0, failed: 1, usage: 2, not_running: 3, full_yolo_required: 4, forbidden: 4 };
const GLOBAL = new Set(['json', 'instance', 'user-data', 'timeout', 'help']);

// "chat send hello" and "chat.send hello" name the same command; the longest match wins, so "commands chat"
// is the command `commands` with one argument.
function resolve(words) {
  for (const take of [2, 1]) { if (words.length < take) continue; const name = words.slice(0, take).join('.').toLowerCase(); if (find(name) || FORBIDDEN[name]) return { name, rest: words.slice(take) }; }
  return { name: (words[0] || '').toLowerCase(), rest: words.slice(1) };
}
function parse(argv) {
  const words = [], flags = {}, globals = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === '--') { words.push(...argv.slice(i + 1)); break; }
    if (item.startsWith('--') && item.length > 2) {
      let [key, value] = item.slice(2).split(/=(.*)/s, 2);
      const negated = key.startsWith('no-') && value === undefined; if (negated) key = key.slice(3);
      if (value === undefined) value = negated ? false : (i + 1 < argv.length && !/^--./.test(argv[i + 1]) && !(GLOBAL.has(key) && ['json', 'help'].includes(key)) && takesValue(key, words) ? argv[++i] : true);
      const name = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      // A flag that takes several files (--image a.png --image b.png) collects them.
      if (!GLOBAL.has(key) && find(resolve(words).name)?.args[name]?.type === 'paths') (flags[name] ||= []).push(value);
      else (GLOBAL.has(key) ? globals : flags)[name] = value;
    } else if (item === '-h') globals.help = true;
    else words.push(item);
  }
  return { words, flags, globals };
}
// A flag swallows the next word unless the command says it is a yes/no flag.
function takesValue(key, words) {
  if (key === 'json' || key === 'help') return false;
  const command = find(resolve(words).name); const spec = command?.args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
  return !spec || spec.type !== 'boolean';
}
// "-" is standard input and "@file" is a file, for text that does not fit a command line.
function expand(value) {
  if (value === '-') return fs.readFileSync(0, 'utf8');
  if (typeof value === 'string' && value.startsWith('@') && value.length > 1) { try { return fs.readFileSync(value.slice(1), 'utf8'); } catch (error) { throw Object.assign(new Error(`Could not read ${value.slice(1)}: ${error.message}`), { code: 'usage' }); } }
  return typeof value === 'string' ? value.replace(/\\n/g, '\n') : value;
}

const usageOf = command => `barkdown ${command.name.replace('.', ' ')}${Object.entries(command.args).map(([name, spec]) => spec.positional ? (spec.required ? ` <${name}>` : ` [${name}]`) : '').join('')}${Object.entries(command.args).some(([, spec]) => !spec.positional) ? ' [flags]' : ''}`;
function helpFor(command) {
  const lines = [usageOf(command), '', '  ' + command.summary, ''];
  for (const [name, spec] of Object.entries(command.args)) lines.push(`  ${(spec.positional ? `<${name}>` : `--${name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}`).padEnd(14)} ${spec.help}${spec.required ? ' (required)' : ''}`);
  if (command.aliases) lines.push('', '  Also: ' + command.aliases.map(a => 'barkdown ' + a.replace('.', ' ')).join(', '));
  if (command.tier === 'admin') lines.push('', '  Needs Full YOLO, which a person switches on in Settings › Assistant.');
  lines.push('', '  Example: ' + command.example);
  return lines.join('\n');
}
function overview(list = COMMANDS.map(c => ({ ...c, available: true }))) {
  const lines = ['barkdown: control the running Barkdown app', '', 'Usage: barkdown <group> <action> [arguments] [--flag value] [--json]', ''];
  let group = null;
  for (const command of list) {
    const head = command.name.includes('.') ? command.name.split('.')[0] : 'app';
    if (head !== group) { group = head; lines.push(group); }
    lines.push(`  ${command.name.replace('.', ' ').padEnd(20)} ${command.summary}${command.tier === 'admin' ? (command.available ? '  [Full YOLO]' : '  [needs Full YOLO]') : ''}`);
  }
  lines.push('', 'Everywhere: --json for the raw answer, --instance <pid> or --user-data <dir> to pick an app, --timeout <seconds>.', 'Text arguments take "-" for standard input and "@file" for a file.', 'Full YOLO, quitting and restarting are a person\'s: no command does them.');
  return lines.join('\n');
}

// Plain text for people; --json for programs.
function print(value, indent = '') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (!value.length) return indent + '(none)';
    if (value.every(v => v && typeof v === 'object' && !Array.isArray(v))) { const keys = [...new Set(value.flatMap(v => Object.keys(v)))].filter(k => value.some(v => v[k] != null && typeof v[k] !== 'object')); const cell = v => v == null ? '' : String(v).replace(/\s+/g, ' ').slice(0, 60); const widths = keys.map(k => Math.max(k.length, ...value.map(v => cell(v[k]).length))); return [keys.map((k, i) => k.toUpperCase().padEnd(widths[i])).join('  '), ...value.map(v => keys.map((k, i) => cell(v[k]).padEnd(widths[i])).join('  ').trimEnd())].map(l => indent + l).join('\n'); }
    return value.map(v => indent + (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('\n');
  }
  if (typeof value === 'object') { if (typeof value.text === 'string' && Object.keys(value).length <= 6 && value.printText !== false) { const meta = Object.entries(value).filter(([k, v]) => k !== 'text' && v != null && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · '); return (meta ? indent + meta + '\n\n' : '') + value.text; } return Object.entries(value).map(([k, v]) => v && typeof v === 'object' ? `${indent}${k}:\n${print(v, indent + '  ')}` : `${indent}${k}: ${v}`).join('\n'); }
  return indent + String(value);
}

async function main(argv) {
  const { words, flags, globals } = parse(argv);
  const json = Boolean(globals.json);
  const done = (value, code = 0) => { const text = json ? JSON.stringify(value, null, 2) : print(value); if (text) process.stdout.write(text + '\n'); return code; };
  const failed = error => { const code = EXIT[error.code] ?? 1; if (json) process.stdout.write(JSON.stringify({ ok: false, error: { code: error.code || 'failed', message: error.message } }, null, 2) + '\n'); else process.stderr.write(`barkdown: ${error.message}\n`); return code; };
  try {
    if (!words.length || (words[0] === 'help' && words.length === 1)) {
      // The overview shows what may run now when an app is there, and the bare catalogue when none is.
      let list; try { list = await call(findInstance({ instance: globals.instance, userData: globals.userData }), 'commands', {}, { timeoutMs: 5000 }); } catch {}
      process.stdout.write(overview(list) + '\n'); return 0;
    }
    if (words[0] === 'help' || globals.help) { const { name } = resolve(words[0] === 'help' ? words.slice(1) : words); if (FORBIDDEN[name]) return failed(Object.assign(new Error(FORBIDDEN[name]), { code: 'forbidden' })); const command = find(name); if (!command) return failed(Object.assign(new Error(`There is no command "${name}". Run "barkdown commands".`), { code: 'usage' })); process.stdout.write(helpFor(command) + '\n'); return 0; }
    const { name, rest } = resolve(words);
    const command = find(name);
    const args = { ...flags };
    for (const key of Object.keys(args)) args[key] = Array.isArray(args[key]) ? args[key] : expand(args[key]);
    if (rest.length) args._ = rest.map(expand);
    // A folder is named the way a shell names it: relative to here, or from the home folder.
    for (const [key, spec] of Object.entries(command?.args || {})) if (spec.type === 'path' && typeof args[key] === 'string' && args[key] !== 'none') args[key] = path.resolve(args[key].replace(/^~(?=$|[\\/])/, os.homedir()));
      else if (spec.type === 'paths' && Array.isArray(args[key])) args[key] = args[key].map(file => path.resolve(String(file).replace(/^~(?=$|[\\/])/, os.homedir())));
    const pointer = findInstance({ instance: globals.instance, userData: globals.userData });
    const timeoutMs = globals.timeout ? Number(globals.timeout) * 1000 : (command?.timeoutMs || 30000) + 5000;
    const result = await call(pointer, name, args, { timeoutMs });
    return done(json ? { ok: true, result } : result);
  } catch (error) { return failed(error); }
}

if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
module.exports = { main, parse, resolve, expand, print, helpFor, overview, EXIT };
