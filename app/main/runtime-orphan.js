// A managed runtime outlives a host that dies: its launcher leads its own process group and
// the private database is a daemon. The record written at launch lets the next host prove a
// leftover is this profile's own and stop it before it starts again. Proof is the process id
// together with its start time, so a recycled id is never signalled; the database is addressed
// only through its private data directory. A record whose host is still running is refused.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, execFile } = require('node:child_process');
const WINDOWS = process.platform === 'win32';
const RECORD = 'runtime-process.json';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function defaultStartedAt(pid) {
  try {
    if (WINDOWS) return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${Number(pid)}).StartTime.ToUniversalTime().ToString('o')`], { encoding: 'utf8', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return execFileSync('ps', ['-o', 'lstart=', '-p', String(Number(pid))], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return ''; }
}
function defaultAlive(pid) { try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; } }
async function defaultStop(pid, { alive = defaultAlive } = {}) {
  if (WINDOWS) { await new Promise(resolve => execFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 15000 }, () => resolve())); return; }
  const signal = name => { try { process.kill(-pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  signal('SIGTERM');
  for (let waited = 0; waited < 10000 && alive(pid); waited += 200) await sleep(200);
  if (alive(pid)) { signal('SIGKILL'); for (let waited = 0; waited < 5000 && alive(pid); waited += 200) await sleep(200); }
}
function createRuntimeRecord({ dataDir, hostPid = process.pid, startedAt = defaultStartedAt, alive = defaultAlive, stop = defaultStop, now = () => new Date().toISOString(), log = line => console.error(line) }) {
  if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) throw new TypeError('An absolute runtime data directory is required');
  const file = path.join(dataDir, RECORD);
  const valid = value => value && value.version === 1 && Number.isSafeInteger(value.hostPid) && value.hostPid > 0 && typeof value.hostStartedAt === 'string' &&
    (value.pid === null || Number.isSafeInteger(value.pid) && value.pid > 1) && (value.pid === null || typeof value.startedAt === 'string');
  function read() {
    let value; try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw new Error('The runtime process record is unreadable; nothing was stopped.'); }
    if (!valid(value)) throw new Error('The runtime process record is invalid; nothing was stopped.');
    return value;
  }
  function write({ pid = null, port, pgPort, bootId = null }) {
    const value = { version: 1, hostPid, hostStartedAt: startedAt(hostPid), pid, startedAt: pid === null ? null : startedAt(pid), port, pgPort, bootId, launchedAt: now() };
    const temporary = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n'); fs.renameSync(temporary, file);
    return value;
  }
  function clear() { try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const same = (pid, started) => Boolean(started) && alive(pid) && startedAt(pid) === started;
  // Stop what a previous host of this profile left running. Returns what was stopped.
  async function reclaim({ databaseRunning = async () => false, stopDatabase = async () => {} } = {}) {
    const record = read();
    if (!record) return { reclaimed: false, runtime: false, database: false };
    if (record.hostPid !== hostPid && same(record.hostPid, record.hostStartedAt)) throw Object.assign(new Error('This profile’s runtime belongs to another running Barkdown. Nothing was stopped.'), { code: 'runtime_owned' });
    let runtime = false, database = false;
    if (record.pid !== null && same(record.pid, record.startedAt)) {
      await stop(record.pid, { alive });
      if (same(record.pid, record.startedAt)) throw Object.assign(new Error('A runtime left by an earlier Barkdown did not stop. Nothing else was changed.'), { code: 'runtime_reclaim' });
      runtime = true;
    }
    if (await databaseRunning()) { await stopDatabase(); if (await databaseRunning()) throw Object.assign(new Error('A database left by an earlier Barkdown did not stop. Nothing else was changed.'), { code: 'runtime_reclaim' }); database = true; }
    clear();
    if (runtime || database) log(`[runtime] reclaimed after host ${record.hostPid} ended: ${[runtime && 'runtime ' + record.pid, database && 'private database'].filter(Boolean).join(', ')}`);
    return { reclaimed: runtime || database, runtime, database, hostPid: record.hostPid };
  }
  return Object.freeze({ read, write, clear, reclaim, file });
}
createRuntimeRecord.real = defaultStartedAt; createRuntimeRecord.alive = defaultAlive;
module.exports = { createRuntimeRecord, RECORD };
