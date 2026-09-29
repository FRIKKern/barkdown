const { externalResource } = require('./external-resource');
const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execFile);
const { acquireFileLease } = require('./file-lease');
const { prepareRuntimeBuild } = require('./runtime-build');
const { admissionEnv } = require('./upstream-admission');

function freePort(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.once('error', () => reject(new Error(`Port ${port} is already in use. No existing service was changed.`)));
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
}
const WINDOWS = process.platform === 'win32';
// Where the runtime's tools live. Windows: the Scoop layout the setup guide installs.
// POSIX: the PATH the app inherited (Homebrew, asdf, distro packages), with the
// common Homebrew and Debian Postgres locations as fallbacks when pg_ctl is not on it.
function onPath(name) {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) if (dir && fs.existsSync(path.join(dir, name))) return dir;
  return null;
}
function toolchain(config) {
  if (WINDOWS) {
    const scoop = process.env.SCOOP || path.join(process.env.USERPROFILE, 'scoop');
    const pgBin = config.pgBin || path.join(scoop, 'apps', 'postgresql', 'current', 'bin');
    const mix = path.join(scoop, 'apps', 'elixir', 'current', 'bin', 'mix.bat');
    return { pgBin, mix, exe: '.exe', toolPath: [path.dirname(mix), path.join(scoop, 'apps', 'erlang', 'current', 'bin'), pgBin, path.join(scoop, 'shims')].join(';') };
  }
  const candidates = [17, 16, 15, 14].flatMap(v => [`/opt/homebrew/opt/postgresql@${v}/bin`, `/usr/local/opt/postgresql@${v}/bin`, `/usr/lib/postgresql/${v}/bin`]);
  const pgBin = config.pgBin || onPath('pg_ctl') || candidates.find(dir => fs.existsSync(path.join(dir, 'pg_ctl'))) || '/opt/homebrew/bin';
  const mixDir = onPath('mix') || '/opt/homebrew/bin';
  return { pgBin, mix: path.join(mixDir, 'mix'), exe: '', toolPath: [mixDir, pgBin].join(path.delimiter) };
}
function validate(config) {
  if (!config?.source || !path.isAbsolute(config.source) || !fs.existsSync(path.join(config.source, 'api', 'mix.exs'))) throw new Error('Choose a built Barkpark source checkout (containing api/mix.exs).');
  for (const key of ['port', 'pgPort']) if (!Number.isInteger(config[key]) || config[key] < 1024 || config[key] > 65535) throw new Error(`Invalid local ${key}.`);
  if (config.port === config.pgPort) throw new Error('HTTP and database ports must be different.');
  return config;
}
class SourceDriver {
  constructor(config, dataDir, secrets) {
    this.config = validate(config); this.dataDir = path.resolve(dataDir); this.secrets = secrets;
    this.server = `http://127.0.0.1:${config.port}`;
    const tools = toolchain(config);
    this.pgBin = tools.pgBin; this.mix = tools.mix; this.exe = tools.exe; this.toolPath = tools.toolPath;
    this.pgData = path.join(this.dataDir, 'pgdata'); this.lockPath = path.join(this.dataDir, 'owner.json');
  }
  async run(tool, args, signal, timeout = 30000) {
    try { return await exec(path.join(this.pgBin, tool + this.exe), args, { windowsHide: true, timeout, signal, env: { ...process.env, PGPASSWORD: this.secrets.password }, maxBuffer: 1024 * 1024 }); }
    catch (error) { throw new Error(`${tool} failed${signal?.aborted ? ' (cancelled)' : ''}. ${String(error.stderr || error.stdout || error.message).slice(-1500).split(this.secrets.password).join('[redacted]')}`); }
  }
  // A logical export of this runtime's database (P3): custom-format pg_dump, never a copy of the
  // live data directory. The caller holds the runtime first so the dump is one consistent state.
  async dump(file, signal) {
    if (!path.isAbsolute(file) || fs.existsSync(file)) throw new Error('A database export needs a new absolute file path.');
    await this.run('pg_dump', ['-h', '127.0.0.1', '-p', String(this.config.pgPort), '-U', 'postgres', '-d', 'barkdown', '--format=custom', '--no-owner', '--no-privileges', '--file', file], signal, 10 * 60 * 1000);
    const { stdout } = await this.run('psql', ['-h', '127.0.0.1', '-p', String(this.config.pgPort), '-U', 'postgres', '-d', 'barkdown', '-tAc', 'SHOW server_version'], signal, 5000);
    return { file, serverVersion: String(stdout).trim() };
  }
  get mediaDir() { return path.join(this.dataDir, 'media'); }
  async acquire() {
    if (this.lease) return;
    for (const file of [this.mix, path.join(this.pgBin, 'initdb' + this.exe), path.join(this.pgBin, 'pg_ctl' + this.exe)]) if (!fs.existsSync(file)) throw new Error(`Missing local tool: ${file}. Install the Barkpark Windows toolchain first.`);
    if (!fs.existsSync(path.join(this.config.source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error('Build the Barkpark checkout first using its Windows setup and Visual Studio compiler environment.');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.ownership = acquireFileLease(this.lockPath, { busy: 'This local profile is owned by another running Barkdown.' });
    this.lease = this.ownership.lease;
    try { this.build = await prepareRuntimeBuild(this.config.source, this.dataDir); }
    catch (error) { this.ownership.release(); this.ownership = null; this.lease = null; throw error; }
  }
  async release() {
    if (!this.lease) return;
    if (this.pgOwned || (this.child && this.child.exitCode == null)) throw new Error('Local runtime did not stop; ownership is retained.');
    this.ownership.release();
    this.ownership = null;
    this.lease = null;
  }
  async start(signal) {
    await freePort(this.config.port); await freePort(this.config.pgPort);
    signal.throwIfAborted();
    if (!fs.existsSync(path.join(this.pgData, 'PG_VERSION'))) {
      const passwordFile = path.join(this.dataDir, 'init-password');
      fs.writeFileSync(passwordFile, this.secrets.password, { mode: 0o600 });
      try { await this.run('initdb', ['-D', this.pgData, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '-E', 'UTF8'], signal, 60000); }
      finally { fs.unlinkSync(passwordFile); }
    }
    const alreadyRunning = await this.run('pg_ctl', ['-D', this.pgData, 'status'], signal).then(() => true, () => false);
    signal.throwIfAborted();
    if (alreadyRunning) throw new Error('The private database is already running without this launcher. Stop that profile before retrying; it was left untouched.');
    this.pgLog = path.join(this.dataDir, `postgres-${Date.now()}.log`); this.logOffset = 0;
    // Claim only this private directory; pg_ctl never addresses a global service.
    this.pgOwned = true;
    await this.run('pg_ctl', ['-D', this.pgData, '-l', this.pgLog, '-o', `-h 127.0.0.1 -p ${this.config.pgPort}`, '-w', '-t', '20', 'start'], signal);
    signal.throwIfAborted();
    this.bootId = crypto.randomUUID();
    const env = { ...process.env, MIX_ENV: 'dev', MIX_BUILD_PATH: this.build.path, PORT: String(this.config.port),
      BARKDOWN_LOCAL_DATA: this.dataDir, BARKDOWN_PG_PORT: String(this.config.pgPort), BARKDOWN_PG_PASSWORD: this.secrets.password,
      BARKDOWN_BOOT_ID: this.bootId, BARKDOWN_API_DIR: path.join(this.config.source, 'api'), BARKDOWN_MIX_PATH: this.mix,
      BARKDOWN_TOOL_PATH: this.toolPath, BARKDOWN_BOOT_SCRIPT: externalResource('local-barkpark-boot.exs'),
      BARKPARK_INGEST_TOKEN: this.secrets.token, BARKPARK_SEED_PROFILE: 'clean', BARKPARK_SEED_ADMIN_TOKEN: this.secrets.token, BARKPARK_PLUGINS: 'bulldocs,media',
      BARKPARK_MEDIA_DIR: path.join(this.dataDir, 'media'), BARKPARK_INDX_STATE_DIR: path.join(this.dataDir, 'indx'),
      BARKPARK_BUNDLE_SPILL_DIR: path.join(this.dataDir, 'bundles'),
      // Managed write admission (C083): opt-in per runtime until the pinned Barkpark
      // ref carries the coordinator and the trusted hold endpoint.
      ...(this.config.writeAdmission ? admissionEnv(this.dataDir, this.config.writeAdmission.instanceId) : {}),
    };
    this.processError = null;
    this.child = WINDOWS
      ? spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', externalResource('local-barkpark-launch.ps1')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      // POSIX: a detached leader makes the runtime its own process group (see stop()).
      : spawn('/bin/sh', [externalResource('local-barkpark-launch.sh')], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = text => fs.appendFileSync(path.join(this.dataDir, 'server.log'), String(text).split(this.secrets.password).join('[redacted]').split(this.secrets.token).join('[redacted]'));
    this.child.stdout.on('data', log); this.child.stderr.on('data', log);
    this.child.on('error', error => { this.processError = error.message; });
  }
  async checkFailure() {
    if (this.processError || !this.child || this.child.exitCode != null) throw new Error(this.processError || 'Barkpark exited during startup. See server.log in the local data folder.');
    if (this.pgLog && fs.existsSync(this.pgLog)) {
      const fd = fs.openSync(this.pgLog, 'r');
      try {
        const size = fs.fstatSync(fd).size, from = Math.min(size, Math.max(this.logOffset, size - 65536)), bytes = Buffer.alloc(size - from);
        fs.readSync(fd, bytes, 0, bytes.length, from); this.logOffset = Math.max(0, size - 512);
        if (/could not reserve shared memory|error 487|0xC0000142/i.test(bytes.toString())) throw new Error('PostgreSQL could not spawn a Windows worker (error 487); restarting the private cluster.');
      } finally { fs.closeSync(fd); }
    }
  }
  async healthy(signal) {
    try {
      await this.checkFailure();
      if (fs.readFileSync(path.join(this.dataDir, 'boot-ready'), 'utf8') !== this.bootId) return false;
      await this.run('psql', ['-h', '127.0.0.1', '-p', String(this.config.pgPort), '-U', 'postgres', '-d', 'barkdown', '-tAc', 'SELECT 1'], signal, 5000);
      const response = await fetch(this.server + '/status.json', { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
      const body = await response.json();
      return response.ok && ['database', 'migrations', 'plugins'].every(name => body.components?.some(c => c.name === name && c.status === 'operational'));
    } catch { return false; }
  }
  async stop() {
    if (this.child && this.child.exitCode == null && this.child.pid) {
      if (WINDOWS) await exec('taskkill.exe', ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 }).catch(error => { if (this.child.exitCode == null) throw error; });
      else await this.stopGroup();
    }
    this.child = null;
    if (this.pgOwned) {
      try { await this.run('pg_ctl', ['-D', this.pgData, '-m', 'fast', '-w', '-t', '10', 'stop']); }
      catch (error) {
        // A stopped cluster needs no recovery; a wedged one uses pg_ctl's scoped immediate stop.
        const alive = await this.run('pg_ctl', ['-D', this.pgData, 'status']).then(() => true, () => false);
        if (alive) await this.run('pg_ctl', ['-D', this.pgData, '-m', 'immediate', '-w', '-t', '10', 'stop']);
      }
      this.pgOwned = false;
    }
  }
}
// POSIX: signal the whole group (the leader was spawned detached), give the BEAM a
// moment to close its sockets and the private database connections, then force it.
SourceDriver.prototype.stopGroup = async function stopGroup() {
  const child = this.child, signal = sig => { try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
  const exited = () => child.exitCode != null || child.signalCode != null;
  const wait = ms => new Promise(resolve => { if (exited()) return resolve(); const timer = setTimeout(resolve, ms); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  signal('SIGTERM'); await wait(10000);
  if (!exited()) { signal('SIGKILL'); await wait(5000); }
  if (!exited()) throw new Error('Local runtime did not stop; ownership is retained.');
};
module.exports = { SourceDriver, validate, toolchain };
