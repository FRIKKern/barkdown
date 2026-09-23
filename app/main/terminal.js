// Pipe terminals capture owner and cwd. Windows shells and descendants live in an owned Job.
const { spawn } = require('node:child_process');
const os = require('node:os'),
  path = require('node:path'),
  crypto = require('node:crypto');
const fs = require('node:fs');
const { createStore } = require('./store');
const { launchOwnedWorker, verifyOwnedWorker } = require('./goal-process');
function shellSpec() {
  if (process.platform === 'win32')
    return { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile'], label: 'PowerShell', echoes: true };
  const shell = process.env.SHELL || '/bin/bash';
  return { command: shell, args: ['-s'], label: shell.split('/').pop(), echoes: false };
}
const fail = (message) => Object.assign(new Error(message), { code: 'terminal_ownership' });
const bounded = (promise, ms, message) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(fail(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};
function createTerminalService({
  launch = launchOwnedWorker,
  verify = verifyOwnedWorker,
  timeout = 35000,
  platform = process.platform,
} = {}) {
  const sessions = new Map(),
    pending = new Map();
  let shuttingDown = false;
  const key = (o) => {
    if (
      !o ||
      !['profileId', 'chatId', 'id'].every((k) => typeof o[k] === 'string' && o[k].length > 0 && o[k].length < 512)
    )
      throw fail('Terminal owner is required');
    return JSON.stringify([o.profileId, o.chatId, o.id]);
  };
  function journal(o) {
    const store = createStore(o.storeDir, { create: false }),
      name = 'terminal-sessions/' + crypto.createHash('sha256').update(key(o)).digest('hex') + '.json';
    return { store, name, file: store.filePath(name) };
  }
  function prior(o) {
    const { file } = journal(o);
    if (!fs.existsSync(file)) return null;
    let old;
    try {
      old = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      throw fail(
        'Terminal ownership record is unreadable. Preserve it and resolve recovery before starting another shell.',
      );
    }
    if (
      old.version !== 1 ||
      old.profileId !== o.profileId ||
      old.chatId !== o.chatId ||
      old.id !== o.id ||
      typeof old.sessionId !== 'string' ||
      !['reserved', 'not-dispatched'].includes(old.launchState)
    )
      throw fail('Terminal ownership record does not match this tab');
    return old;
  }
  const view = (s) => ({
    id: s.id,
    chatId: s.chatId,
    sessionId: s.sessionId,
    cwd: s.cwd,
    shell: shellSpec().label,
    echoes: shellSpec().echoes,
  });
  async function status(o) {
    const current = sessions.get(key(o));
    if (current && !current.stopping && !pending.has(key(o))) return { state: 'running', session: view(current) };
    if (current) return { state: 'uncertain', session: view(current) };
    if (platform !== 'win32') return { state: 'new' };
    const old = prior(o);
    if (!old) return { state: 'new' };
    if (old.launchState === 'not-dispatched') return { state: 'stopped', cwd: old.cwd };
    const verified = await bounded(
      verify({ storeDir: o.storeDir, profileId: o.profileId, attemptId: old.sessionId }),
      timeout,
      'Previous terminal shutdown verification timed out',
    );
    return { state: verified ? 'stopped' : 'uncertain', cwd: old.cwd };
  }
  const emit = (s, event) => {
    try {
      s.send({ ...event, id: s.id, chatId: s.chatId, profileId: s.profileId, sessionId: s.sessionId });
    } catch {}
  };
  function owned(o) {
    const s = sessions.get(key(o));
    if (!s || s.sessionId !== o.sessionId) throw fail('This shell is no longer active. Start a new shell explicitly.');
    return s;
  }
  async function drain(s) {
    s.stopping = true;
    try {
      await bounded(s.launching, timeout, 'Terminal launch is unresolved; retry stopping before switching profiles');
      s.host.stop();
      await bounded(
        s.finished,
        timeout,
        'Terminal shutdown is unverified. The original profile remains selected; retry stopping the shell.',
      );
    } catch (error) {
      if (
        platform !== 'win32' ||
        !(await bounded(
          verify({ storeDir: s.storeDir, profileId: s.profileId, attemptId: s.sessionId }),
          timeout,
          'Terminal verification timed out',
        ))
      )
        throw fail(
          `Terminal shutdown is not verified. Retry stopping, or quit and reopen Barkdown before continuing. ${error.message}`,
        );
      if (sessions.get(key(s)) === s) sessions.delete(key(s));
      emit(s, { type: 'exit', verified: true });
    }
    return true;
  }
  async function start(options) {
    if (shuttingDown) throw fail('Barkdown is shutting down; a new shell cannot start');
    const k = key(options);
    if (pending.has(k)) throw fail('A shell transition is already in progress');
    const operation = (async () => {
      const previous = sessions.get(k);
      if (previous) await drain(previous);
      const spec = shellSpec(),
        cwd = path.resolve(options.root || os.homedir()),
        s = { ...options, cwd, sessionId: crypto.randomUUID(), stopping: false };
      if (platform === 'win32') {
        const { store, name } = journal(options),
          old = prior(options);
        if (old && old.launchState !== 'not-dispatched') {
          if (
            !(await bounded(
              verify({ storeDir: options.storeDir, profileId: options.profileId, attemptId: old.sessionId }),
              timeout,
              'Previous terminal shutdown verification timed out',
            ))
          )
            throw fail(
              'The previous shell shutdown is unverified. Wait for it to stop and explicitly retry Start; commands have not been replayed.',
            );
        }
        s.persisted = {
          version: 1,
          profileId: options.profileId,
          chatId: options.chatId,
          id: options.id,
          sessionId: s.sessionId,
          cwd,
          launchState: 'reserved',
        };
        store.writeJson(name, s.persisted);
      }
      sessions.set(k, s);
      let readyResolve, readyReject;
      const ready = new Promise((r, j) => {
        readyResolve = r;
        readyReject = j;
      });
      ready.catch(() => {});
      s.launching = (async () => {
        if (platform === 'win32') {
          s.host = await launch({
            storeDir: options.storeDir,
            profileId: options.profileId,
            attemptId: s.sessionId,
            script: path.join(__dirname, 'terminal-worker.js'),
            onMessage: (event) => {
              if (event.type === 'started') readyResolve();
              else if (event.type === 'failure') readyReject(fail(event.error));
              else if (event.type === 'shell-exit') s.exitCode = event.code;
              else if (event.type === 'data') emit(s, event);
            },
          });
          s.finished = s.host.finished.then(
            () => {
              if (sessions.get(k) === s) sessions.delete(k);
              emit(s, { type: 'exit', code: s.exitCode, verified: true });
            },
            (error) => {
              s.stopping = true;
              emit(s, { type: 'uncertain', error: error.message });
              throw error;
            },
          );
          s.finished.catch(() => {});
          s.finished.then(() => readyReject(fail('Shell stopped before startup')), readyReject);
          if (s.stopping) {
            s.host.stop();
            return;
          }
          await s.host.ready;
          if (s.stopping) {
            s.host.stop();
            return;
          }
          s.host.send({ type: 'start', command: spec.command, args: spec.args, cwd });
        } else {
          const child = spawn(spec.command, spec.args, {
            cwd,
            env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' },
            windowsHide: true,
          });
          s.host = {
            stop: () => child.kill(),
            send: (message) => child.stdin.write(String(message.line).replace(/\r?\n$/, '') + os.EOL),
          };
          s.finished = new Promise((resolve, reject) => {
            child.on('spawn', readyResolve);
            child.on('error', reject);
            child.on('close', (code) => {
              if (sessions.get(k) === s) sessions.delete(k);
              emit(s, { type: 'exit', code, verified: false });
              resolve();
            });
          });
          s.finished.catch(readyReject);
          child.stdout.on('data', (b) => emit(s, { type: 'data', data: b.toString('utf8') }));
          child.stderr.on('data', (b) => emit(s, { type: 'data', data: b.toString('utf8'), stream: 'stderr' }));
        }
      })();
      try {
        await bounded(s.launching, timeout, 'Shell launch remains unverified');
        await bounded(ready, timeout, 'Shell did not become ready');
        if (s.stopping) throw fail('Shell was stopped during startup');
        return { id: s.id, chatId: s.chatId, sessionId: s.sessionId, cwd, shell: spec.label, echoes: spec.echoes };
      } catch (error) {
        s.stopping = true;
        if (!s.host && error.ownedProcessNotDispatched === true) {
          const { store, name } = journal(options);
          store.writeJson(name, { ...s.persisted, launchState: 'not-dispatched' });
          if (sessions.get(k) === s) sessions.delete(k);
        }
        if (s.host) {
          s.host.stop();
          await bounded(s.finished, timeout, 'Shell launch cleanup remains unverified').catch(() => {});
        }
        throw error;
      }
    })();
    pending.set(k, operation);
    try {
      return await operation;
    } finally {
      pending.delete(k);
    }
  }
  function input(owner, line) {
    if (shuttingDown) throw fail('Barkdown is shutting down; terminal commands are blocked');
    const s = owned(owner);
    if (s.stopping) throw fail('Shell shutdown is pending; commands are blocked');
    if (typeof line !== 'string' || line.length > 256 * 1024) throw fail('Terminal command is too large');
    s.host.send({ type: 'input', line });
    return true;
  }
  async function stop(owner) {
    return drain(owned(owner));
  }
  async function stopAll(profileId) {
    await Promise.allSettled([...pending.values()]);
    const ownedSessions = [...sessions.values()].filter((s) => !profileId || s.profileId === profileId);
    const results = await Promise.allSettled(ownedSessions.map(drain));
    const failed = results.find((r) => r.status === 'rejected');
    if (failed) throw failed.reason;
    return true;
  }
  async function shutdown() {
    shuttingDown = true;
    return stopAll();
  }
  return { start, input, stop, stopAll, shutdown, status, shellSpec, hasSessions: () => sessions.size > 0 };
}
module.exports = { ...createTerminalService(), createTerminalService, shellSpec };
