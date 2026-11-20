// The dev app's route for the agents' document reads in CLI mode (app/main/doc-channel.js). The main side is
// the real control socket and channel in a process made to look like the opted-in dev app's main process,
// with the provider run's own document-server spec; the document server, a terminal tab and any other
// sender are their own processes. The library is a loopback listener behind the stub CLI.
import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { appDir, ambient, listener, route, endAll, LIMIT } from './lib/cli-stub.mjs';

afterEach(endAll); after(endAll); // every child a row started, with all it started, even when the row failed or timed out
const ROW = { timeout: 60_000 };

const require = createRequire(import.meta.url);
const FLAG = '--' + ['barkdown', 'dev', 'cli', 'unfenced'].join('-');
const FENCED = /Refused to start the Barkpark CLI/;
const NOT_A_READ = /agents can read documents but not edit them/;
// The document server loads barkpark.js (as mcp-server.js does first), then starts a process of its own.
const GRANDCHILD = "require(process.argv[1]); const seen = require('child_process').execFileSync(process.execPath, ['-e', 'process.stdout.write(process.env.BARKDOWN_DOC_CHANNEL || String.fromCharCode(45))'], { encoding: 'utf8' }); process.stdout.write(JSON.stringify({ own: process.env.BARKDOWN_DOC_CHANNEL || null, child: seen }));";
// Another process speaking to the socket itself: one message, the first answer line printed.
const SENDER = "const s = require('net').createConnection(process.argv[1]); s.on('connect', () => s.write(process.argv[2] + '\\n')); s.on('data', d => { process.stdout.write(String(d)); s.destroy(); });";

function devMainPreload() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'doc-channel-main-')), 'main.cjs');
  fs.writeFileSync(file, "process.versions.electron = 'stand-in'; process.type = 'browser';");
  return `--require ${JSON.stringify(file)}`;
}

// Runs `steps` in order against one provider run in the dev app's main process and returns what each saw.
//   read / edit: the run's document server reads (or edits) note-1 through barkpark.js
//   terminal-read: the same read from a terminal tab's environment; terminal-command: the `barkdown` command
//   send: another process sends { docToken, argv } itself, with the run's token, the pointer's token or none
//   finish: the run ends; quit: main quits
async function inMain(steps, { other } = {}) {
  const { near, env, started } = await ambient();
  try {
    const code = `
      const { createControl } = require(APP + '/main/control.js');
      const channel = require(APP + '/main/doc-channel.js'), runs = require(APP + '/main/providers/runs.js');
      const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
      const userDataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'doc-channel-')));
      let served = 0; // document-read messages that reached the socket
      const control = createControl({ userDataDir, pointerDir: path.join(userDataDir, 'pointers'), execPath: process.execPath, fullYolo: () => true, cliLibrary: () => true, mainHandlers: {}, toWindow: async () => ({}), docChannel: { serve: message => { served++; return channel.serve(message); } } });
      const opened = channel.open(control.socketPath);
      const connection = { enabled: true, ${['via', 'Cli'].join('')}: true, server: process.env.AMBIENT, dataset: 'production' };
      const scope = { connection, writerToken: { generation: 1 }, profileId: null, context: {} };
      const run = runs.createRun({ chatId: 'c1', send: () => {}, provider: 'claude', scope });
      const spec = runs.mcpServerSpec(userDataDir, scope, run);
      const base = { ...process.env }; delete base.NODE_OPTIONS;
      const docServer = { ...base, ...spec.env }, terminal = { ...base, ...control.env() };
      const runNode = (env, args) => new Promise(resolve => { const child = spawn(process.execPath, args, { env, ...${JSON.stringify(LIMIT)} }); let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; }); child.stdin.end(); child.on('close', status => resolve({ status, out })); });
      const routing = JSON.stringify(['-s', process.env.AMBIENT, '-d', 'production']);
      const lib = (call) => "const b = require(" + JSON.stringify(APP + '/main/barkpark.js') + "); " + call + ".then(v => console.log(JSON.stringify({ ok: v && v.raw })), e => console.log(JSON.stringify({ error: e.message })));";
      const read = env => runNode(env, ['-e', lib("b.cliGetPaper('note-1', " + routing + ")")]);
      const grantToken = JSON.parse(spec.env.BARKDOWN_DOC_CHANNEL || '{}').token;
      const pointerToken = JSON.parse(fs.readFileSync(control.pointerFile, 'utf8')).token;
      const send = (docToken, argv) => runNode(terminal, ['-e', ${JSON.stringify(SENDER)}, control.socketPath, JSON.stringify(docToken === undefined ? { id: 1, argv } : { id: 1, docToken, argv })]);
      const results = [];
      for (const step of ${JSON.stringify(steps)}) {
        if (step.kind === 'read') results.push(await read(docServer));
        else if (step.kind === 'edit') results.push(await runNode(docServer, ['-e', lib("b.cliApplyOps('note-1', [], 1, " + routing + ")")]));
        else if (step.kind === 'terminal-read') results.push(await read(terminal));
        else if (step.kind === 'grandchild') results.push(await runNode(docServer, ['-e', ${JSON.stringify(GRANDCHILD)}, APP + '/main/barkpark.js']));
        else if (step.kind === 'terminal-command') results.push(await runNode(terminal, [APP + '/main/cli/barkdown.js', ...step.argv]));
        else if (step.kind === 'send') results.push(await send(step.token === 'run' ? grantToken : step.token === 'pointer' ? pointerToken : step.token === 'wrong' ? 'f'.repeat(64) : undefined, step.argv.map(a => a === 'OTHER' ? process.env.OTHER : a === 'AMBIENT' ? process.env.AMBIENT : a)));
        else if (step.kind === 'finish') { await runs.finish(run); results.push({ finished: true }); }
        else if (step.kind === 'quit') { channel.closeAll(); results.push({ quit: true }); }
      }
      control.close();
      return { opened, granted: Boolean(grantToken), tokenBytes: grantToken ? Buffer.from(grantToken, 'hex').length : 0, served, results };`;
    const out = await route(code, { ...env, OTHER: other || '', NODE_OPTIONS: devMainPreload() }, [FLAG]);
    assert.ok(out.result?.ok, out.stderr + out.stdout);
    return { ...out.result.ok, connections: near.connections(), started: started() };
  } finally { await near.close(); }
}
const parsed = r => { try { return JSON.parse(r.out.trim().split('\n').pop()); } catch { return { raw: r.out }; } };

test('an agent document read in the dev app runs through main and reaches the library', ROW, async () => {
  const { opened, granted, tokenBytes, results, connections, started } = await inMain([{ kind: 'read' }]);
  assert.equal(opened, true); assert.equal(granted, true); assert.equal(tokenBytes, 32);
  const answer = parsed(results[0]);
  assert.equal(answer.error, undefined, answer.error);
  assert.deepEqual(Object.keys(answer.ok || {}).sort(), ['dataset', 'server']);
  assert.equal(started.length, 1, 'main started the CLI once'); assert.deepEqual(started[0].argv.slice(4, 7), ['doc', 'get', 'paper']);
  assert.equal(connections, 1);
});

test('a terminal tab and any process without the run\'s token are refused, and nothing starts', ROW, async () => {
  const { results, connections, started } = await inMain([
    { kind: 'terminal-read' }, { kind: 'terminal-command', argv: ['note', 'read', 'note-1'] },
    { kind: 'send', token: 'pointer', argv: ['doc', 'get', 'paper', 'note-1'] }, { kind: 'send', token: 'wrong', argv: ['doc', 'get', 'paper', 'note-1'] },
    { kind: 'send', token: undefined, argv: ['doc', 'get', 'paper', 'note-1'] },
  ]);
  assert.match(parsed(results[0]).error || '', FENCED);
  assert.notEqual(results[1].status, 0, results[1].out);
  for (const r of results.slice(2)) assert.equal(parsed(r).ok, false, r.out);
  for (const r of results.slice(2, 4)) assert.equal(parsed(r).error?.code, 'refused', r.out);
  assert.deepEqual(started, []); assert.equal(connections, 0);
});

test('with the run\'s own token only its reads run: edits, other verbs, credentials and other servers are refused', ROW, async () => {
  const other = await listener();
  try {
    const { results, connections, started } = await inMain([
      { kind: 'edit' },
      { kind: 'send', token: 'run', argv: ['-s', 'AMBIENT', 'bulldocs', 'patch', 'note-1', '--file', '-', '--yes'] },
      { kind: 'send', token: 'run', argv: ['cloud', 'login'] },
      { kind: 'send', token: 'run', argv: ['-s', 'AMBIENT', 'doc', 'publish', 'paper', 'note-1'] },
      { kind: 'send', token: 'run', argv: ['-s', 'OTHER', 'doc', 'get', 'paper', 'note-1'] },
      { kind: 'send', token: 'run', argv: ['-s', 'AMBIENT', 'doc', 'get', 'paper', 'note-1', '--source-server', 'OTHER'] },
      { kind: 'send', token: 'run', argv: ['-s', 'AMBIENT', 'whoami', '--token', 't'] },
    ], { other: other.url });
    assert.match(parsed(results[0]).error || '', NOT_A_READ);
    assert.match(parsed(results[1]).error?.message || '', NOT_A_READ);
    for (const r of results.slice(1)) assert.equal(parsed(r).ok, false, r.out);
    assert.deepEqual(started, []); assert.equal(connections, 0); assert.equal(other.connections(), 0);
  } finally { await other.close(); }
});

test('a read must name the run\'s own server first; without it nothing starts', ROW, async () => {
  const { results, connections, started } = await inMain([
    { kind: 'send', token: 'run', argv: ['doc', 'get', 'paper', 'note-1'] },
    { kind: 'send', token: 'run', argv: ['-d', 'production', '-s', 'AMBIENT', 'doc', 'get', 'paper', 'note-1'] },
    { kind: 'send', token: 'run', argv: ['whoami'] },
  ]);
  for (const r of results) assert.equal(parsed(r).error?.code, 'not_own_server', r.out);
  assert.deepEqual(started, []); assert.equal(connections, 0);
});

test('the document server keeps the token to itself: a process it starts does not see it', ROW, async () => {
  const { results } = await inMain([{ kind: 'grandchild' }]);
  assert.deepEqual(parsed(results[0]), { own: null, child: '-' }, results[0].out);
});

test('in the dev main, a run with a direct connection gets no token; a CLI-mode run does', ROW, async () => {
  const out = await route(`
    const channel = require(APP + '/main/doc-channel.js'), runs = require(APP + '/main/providers/runs.js');
    const opened = channel.open('/x/control.sock');
    const spec = connection => { const scope = { connection, writerToken: { generation: 1 }, profileId: null, context: {} }; return Object.keys(runs.mcpServerSpec('/x', scope, runs.createRun({ chatId: 'c1', send: () => {}, provider: 'claude', scope })).env); };
    return { opened, direct: spec({ enabled: true, server: 'http://127.0.0.1:9', token: 't', dataset: 'production' }), cli: spec({ enabled: true, ${['via', 'Cli'].join('')}: true, server: 'http://127.0.0.1:9', dataset: 'production' }) };`, { NODE_OPTIONS: devMainPreload(), PATH: process.env.PATH }, [FLAG]);
  assert.ok(out.result?.ok, out.stderr + out.stdout);
  assert.equal(out.result.ok.opened, true);
  assert.equal(out.result.ok.direct.includes('BARKDOWN_DOC_CHANNEL'), false);
  assert.equal(out.result.ok.cli.includes('BARKDOWN_DOC_CHANNEL'), true);
});

// The document server refuses an edit itself, so the edit's content never leaves it: nothing reaches the socket.
test('an agent edit in the dev app with the CLI library gets the plain sentence and sends nothing to main', ROW, async () => {
  const { served, results, connections, started } = await inMain([{ kind: 'edit' }]);
  assert.match(parsed(results[0]).error || '', NOT_A_READ);
  assert.equal(served, 0, 'no document-read message reached the socket');
  assert.deepEqual(started, []); assert.equal(connections, 0);
});

test('the run\'s token stops working when the run finishes and when main quits', ROW, async () => {
  const ended = await inMain([{ kind: 'finish' }, { kind: 'send', token: 'run', argv: ['-s', 'AMBIENT', 'doc', 'get', 'paper', 'note-1'] }, { kind: 'read' }]);
  assert.equal(parsed(ended.results[1]).error?.code, 'refused'); assert.equal(parsed(ended.results[2]).error?.length > 0, true);
  const quit = await inMain([{ kind: 'quit' }, { kind: 'read' }]);
  assert.ok(parsed(quit.results[1]).error, quit.results[1].out);
  assert.deepEqual([...ended.started, ...quit.started], []); assert.equal(ended.connections + quit.connections, 0);
});

test('a packaged build, or any process that is not the opted-in dev main, opens no channel and its spec carries no token', ROW, async () => {
  const out = await route(`
    const channel = require(APP + '/main/doc-channel.js'), runs = require(APP + '/main/providers/runs.js');
    const scope = { connection: { enabled: true, ${['via', 'Cli'].join('')}: true, server: 'http://127.0.0.1:9', dataset: 'production' }, writerToken: { generation: 1 }, profileId: null, context: {} };
    const plain = channel.open('/x/control.sock');
    const packaged = channel.open('/x/control.sock', { packaged: true, optedIn: true });
    const run = runs.createRun({ chatId: 'c1', send: () => {}, provider: 'claude', scope });
    return { plain, packaged, env: Object.keys(runs.mcpServerSpec('/x', scope, run).env) };`, {});
  assert.ok(out.result?.ok, out.stderr + out.stdout);
  assert.equal(out.result.ok.plain, false); assert.equal(out.result.ok.packaged, false);
  assert.equal(out.result.ok.env.includes('BARKDOWN_DOC_CHANNEL'), false);
});

// The channel serves exactly the reads the document server's own code issues: the CLI functions its modules
// call, read from their source, and the verbs those functions issue.
test('the channel serves exactly the reads the document server issues, and its one write is not among them', ROW, () => {
  const { DOC_READS } = require('../main/doc-channel.js');
  const read = file => fs.readFileSync(path.join(appDir, 'main', file), 'utf8');
  const called = new Set();
  for (const file of ['mcp-server.js', 'paper-tools.js', 'agent-edits.js', 'paper-tool-connection.js']) for (const [, name] of read(file).matchAll(/barkpark'?\)?\.(cli[A-Za-z]*)\(/g)) called.add(name);
  assert.deepEqual([...called].sort(), ['cliApplyOps', 'cliGetPaper', 'cliListPapers', 'cliScope', 'cliSearch']);
  const source = read('barkpark.js'), verbs = new Set();
  for (const name of called) {
    const body = source.slice(source.indexOf(`function ${name}(`)); const end = body.indexOf('\n}\n');
    for (const [, one, two] of body.slice(0, end).matchAll(/cli\(\[\.\.\.routing, '([a-z]+)'(?:, '([a-z-]+)')?/g)) verbs.add(['doc', 'bulldocs'].includes(one) ? `${one} ${two}` : one);
  }
  assert.deepEqual([...verbs].sort(), ['bulldocs patch', 'doc get', 'doc query', 'whoami']);
  assert.deepEqual([...DOC_READS].sort(), [...verbs].filter(verb => verb !== 'bulldocs patch').sort());
});
