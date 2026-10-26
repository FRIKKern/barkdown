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
const { createRuntimeRecord } = require('./runtime-orphan');
const { powershell, systemTool, systemRoot, nativePath } = require('./windows-system-tools');

function freePort(port) {
  return new Promise((resolve, reject) => {
    const s = net.createServer(); s.once('error', () => reject(new Error(`Port ${port} is already in use. No existing service was changed.`)));
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
}
const WINDOWS = process.platform === 'win32';
// Postgres options: TCP on loopback only. Debian and Ubuntu builds put the Unix socket in
// /var/run/postgresql, which an ordinary user cannot write, so the server would not start there.
const pgOptions = port => `-h 127.0.0.1 -p ${port}` + (process.platform === 'linux' ? ' -k /tmp' : '');
// Where the runtime's tools live. Windows: the Scoop layout the setup guide installs.
// POSIX: the PATH the app inherited (Homebrew, asdf, distro packages), with the
// common Homebrew and Debian Postgres locations as fallbacks when pg_ctl is not on it.
function onPath(name) {
  for (const dir of String(process.env.PATH || '').split(path.delimiter)) if (dir && fs.existsSync(path.join(dir, name))) return dir;
  return null;
}
function toolchain(config) {
  if (WINDOWS) {
    const carried = config.source && releaseOf(config.source) ? path.join(config.source, 'postgres', 'bin') : null;
    if (carried) { const pgBin=nativePath(carried); return { pgBin, mix: null, exe: '.exe', toolPath: pgBin }; }
    const scoop = process.env.SCOOP || path.join(process.env.USERPROFILE, 'scoop');
    const pgBin = config.pgBin || path.join(scoop, 'apps', 'postgresql', 'current', 'bin');
    const mix = path.join(scoop, 'apps', 'elixir', 'current', 'bin', 'mix.bat');
    return { pgBin, mix, exe: '.exe', toolPath: [path.dirname(mix), path.join(scoop, 'apps', 'erlang', 'current', 'bin'), pgBin, path.join(scoop, 'shims')].join(';') };
  }
  const candidates = [17, 16, 15, 14].flatMap(v => [`/opt/homebrew/opt/postgresql@${v}/bin`, `/usr/local/opt/postgresql@${v}/bin`, `/usr/lib/postgresql/${v}/bin`]);
  // A runtime folder may carry its own Postgres (scripts/build-runtime-postgres.mjs): then the machine needs none.
  const carried = config.source ? path.join(config.source, 'postgres', 'bin') : null;
  const pgBin = config.pgBin || (carried && fs.existsSync(path.join(carried, 'pg_ctl')) ? carried : null) || onPath('pg_ctl') || candidates.find(dir => fs.existsSync(path.join(dir, 'pg_ctl'))) || '/opt/homebrew/bin';
  const mixDir = onPath('mix') || '/opt/homebrew/bin';
  return { pgBin, mix: path.join(mixDir, 'mix'), exe: '', toolPath: [mixDir, pgBin].join(path.delimiter) };
}
// A runtime folder is a source checkout (api/mix.exs, run through mix) or a packaged release
// (bin/barkpark with its own Erlang, run without Elixir on the machine). The release carries
// barkdown-release.json, written when it was built, naming the Barkpark commit it holds.
const RELEASE_MARK = 'barkdown-release.json';
function releaseOf(source) {
  if (typeof source !== 'string' || !path.isAbsolute(source)) return null;
  const windowsBin = path.join(source, 'bin', 'barkpark.bat');
  const bin = WINDOWS && fs.existsSync(windowsBin) ? windowsBin : path.join(source, 'bin', 'barkpark');
  if (!fs.existsSync(bin) || !fs.existsSync(path.join(source, 'releases'))) return null;
  let mark = null; try { mark = JSON.parse(fs.readFileSync(path.join(source, RELEASE_MARK), 'utf8')); } catch {}
  const upstream = typeof mark?.upstream === 'string' && /^[0-9a-f]{40}$/.test(mark.upstream) ? mark.upstream : null;
  if (bin === windowsBin && (mark?.version !== 1 || mark.platform !== 'win32' || mark.arch !== process.arch || !upstream || typeof mark.erts !== 'string' || !/^erts-[\d.]+$/.test(mark.erts) || !fs.existsSync(path.join(source, mark.erts, 'bin', 'erl.exe')))) return null;
  const pg = mark?.postgres;
  const postgres = pg?.version === 1 && pg.platform === process.platform && pg.arch === process.arch && typeof pg.postgres === 'string' && /^\d+\.\d+(?:\.\d+)?$/.test(pg.postgres) ? pg : null;
  return { bin, upstream, ...(postgres ? { postgres } : {}) };
}
// The release reads its keys from the environment. They are derived from the profile's own
// database password, so they are stable across boots and nothing new is stored.
function releaseSecrets(password) {
  const derive = (label, bytes) => Buffer.from(crypto.hkdfSync('sha256', Buffer.from(password), Buffer.from('barkdown-runtime-release'), Buffer.from(label), bytes));
  return { SECRET_KEY_BASE: derive('secret-key-base', 48).toString('base64'), BARKPARK_CLOAK_KEY: derive('cloak', 32).toString('base64'), BARKPARK_KEK: derive('kek', 32).toString('base64'),
    PREVIEW_JWT_SECRET: derive('preview-jwt', 32).toString('hex'), BARKPARK_RELEASE_CAPTURE_HMAC_SECRET: derive('release-capture', 32).toString('hex') };
}
function validate(config) {
  // A packaged application whose own runtime folder is gone is a damaged install, and the person
  // needs the way out, not the developer's choice of sources.
  if (typeof config?.source === 'string' && process.resourcesPath && config.source.startsWith(process.resourcesPath + path.sep) && !releaseOf(config.source)) throw new Error('This copy of Barkdown is missing the runtime it should carry. Reinstall Barkdown; your notes and profiles are kept.');
  if (!config?.source || !path.isAbsolute(config.source) || !(fs.existsSync(path.join(config.source, 'api', 'mix.exs')) || releaseOf(config.source))) throw new Error('Choose a built Barkpark source checkout (containing api/mix.exs) or a packaged Barkpark release (containing bin/barkpark).');
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
    this.packaged = releaseOf(config.source);
    if (this.packaged && WINDOWS && (!this.packaged.bin.endsWith('.bat') || !this.packaged.postgres)) throw new Error('This Windows runtime needs its stamped Windows launcher and carried PostgreSQL bundle. Nothing was started.');
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
  // Restore a logical export into this runtime's private cluster before its first boot (P3).
  // Refuses a data directory that already holds a database: an import never merges into one.
  // The exporter's token rows are removed; the first boot seeds this runtime's own token.
  async restore({ dumpFile, mediaDir }, signal = AbortSignal.timeout(15 * 60 * 1000)) {
    if (fs.existsSync(path.join(this.pgData, 'PG_VERSION')) || fs.existsSync(path.join(this.dataDir, 'seeded'))) throw new Error('This runtime already holds a database; an import needs a new one.');
    if (!fs.existsSync(dumpFile)) throw new Error('The database export is missing.');
    await this.acquire();
    let started = false;
    try {
      await freePort(this.config.pgPort);
      const passwordFile = path.join(this.dataDir, 'init-password');
      fs.writeFileSync(passwordFile, this.secrets.password, { mode: 0o600 });
      try { await this.run('initdb', ['-D', this.pgData, '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '-E', 'UTF8'], signal, 60000); }
      finally { fs.unlinkSync(passwordFile); }
      const log = path.join(this.dataDir, `postgres-restore-${Date.now()}.log`), at = ['-h', '127.0.0.1', '-p', String(this.config.pgPort), '-U', 'postgres'];
      this.processRecord.write({ pid: null, port: this.config.port, pgPort: this.config.pgPort });
      await this.run('pg_ctl', ['-D', this.pgData, '-l', log, '-o', pgOptions(this.config.pgPort), '-w', '-t', '20', 'start'], signal); started = true;
      await this.run('createdb', [...at, 'barkdown'], signal, 60000);
      await this.run('pg_restore', [...at, '-d', 'barkdown', '--no-owner', '--no-privileges', '--exit-on-error', dumpFile], signal, 10 * 60 * 1000);
      await this.run('psql', [...at, '-d', 'barkdown', '-v', 'ON_ERROR_STOP=1', '-tAc', 'DELETE FROM api_tokens'], signal, 60000);
      const { stdout } = await this.run('psql', [...at, '-d', 'barkdown', '-tAc', "SELECT count(*) FROM documents WHERE type = 'paper'"], signal, 60000);
      if (mediaDir && fs.existsSync(mediaDir)) await fs.promises.cp(mediaDir, this.mediaDir, { recursive: true, errorOnExist: true, force: false });
      return { papers: Number(String(stdout).trim()) };
    } finally {
      if (started) await this.run('pg_ctl', ['-D', this.pgData, '-m', 'fast', '-w', '-t', '20', 'stop']).catch(() => {});
      if (!await this.databaseRunning()) this.processRecord.clear();
      this.ownership?.release(); this.ownership = null; this.lease = null;
    }
  }
  async acquire() {
    if (this.lease) return;
    for (const file of [...(this.packaged ? [] : [this.mix]), path.join(this.pgBin, 'initdb' + this.exe), path.join(this.pgBin, 'pg_ctl' + this.exe)]) if (!fs.existsSync(file)) throw new Error(`Missing local tool: ${file}. Install the Barkpark ${process.platform === 'win32' ? 'Windows toolchain' : 'toolchain (Elixir, Erlang and PostgreSQL)'} first.`);
    if (!this.packaged && !fs.existsSync(path.join(this.config.source, 'api', '_build', 'dev', 'lib', 'barkpark', 'ebin', 'barkpark.app'))) throw new Error(process.platform === 'win32' ? 'Build the Barkpark checkout first using its Windows setup and Visual Studio compiler environment.' : 'Build the Barkpark checkout first: cd api && mix deps.get && mix compile (a dev build).');
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.ownership = acquireFileLease(this.lockPath, { busy: 'This local profile is owned by another running Barkdown.' });
    this.lease = this.ownership.lease;
    try { this.build = this.packaged ? null : await prepareRuntimeBuild(this.config.source, this.dataDir); }
    catch (error) { this.ownership.release(); this.ownership = null; this.lease = null; throw error; }
  }
  async release() {
    if (!this.lease) return;
    if (this.pgOwned || (this.child && this.child.exitCode == null)) throw new Error('Local runtime did not stop; ownership is retained.');
    this.ownership.release();
    this.ownership = null;
    this.lease = null;
  }
  // What this driver launched, so a later host can prove a leftover is its own (runtime-orphan.js).
  get processRecord() { return this.record ||= createRuntimeRecord({ dataDir: this.dataDir }); }
  // A data folder made by one Postgres major cannot be opened by another: the server refuses it with a
  // cryptic line, or worse. Before anything is started, the folder's PG_VERSION is compared with the
  // Postgres this runtime brings, and a mismatch is said in plain words with the way out.
  assertDatabaseCompatible() {
    const file = path.join(this.pgData, 'PG_VERSION');
    if (!fs.existsSync(file)) return;
    const have = String(fs.readFileSync(file, 'utf8')).trim().split('.')[0];
    let carried = this.packaged?.postgres?.postgres ? String(this.packaged.postgres.postgres).split('.')[0] : null;
    if (!carried) { try { carried = /\) (\d+)\./.exec(require('node:child_process').execFileSync(path.join(this.pgBin, 'pg_ctl' + this.exe), ['--version'], { encoding: 'utf8', timeout: 15000 }))?.[1] || null; } catch {} }
    if (carried && have && carried !== have) throw Object.assign(new Error(`This profile's database was made by PostgreSQL ${have}, and this runtime brings PostgreSQL ${carried}. Nothing was changed. Export the profile from the Barkdown that made it, then import it here.`), { code: 'runtime_database_major' });
  }
  databaseRunning() { return fs.existsSync(path.join(this.pgData, 'PG_VERSION')) ? this.run('pg_ctl', ['-D', this.pgData, 'status']).then(() => true, () => false) : Promise.resolve(false); }
  async stopDatabase() {
    try { await this.run('pg_ctl', ['-D', this.pgData, '-m', 'fast', '-w', '-t', '10', 'stop']); }
    catch { if (await this.databaseRunning()) await this.run('pg_ctl', ['-D', this.pgData, '-m', 'immediate', '-w', '-t', '10', 'stop']); }
  }
  // A host that died left its runtime and database running: stop them, proven by the launch record.
  reclaim() { return this.processRecord.reclaim({ databaseRunning: () => this.databaseRunning(), stopDatabase: () => this.stopDatabase() }); }
  async start(signal) {
    await this.reclaim();
    signal.throwIfAborted();
    await freePort(this.config.port); await freePort(this.config.pgPort);
    signal.throwIfAborted();
    this.assertDatabaseCompatible();
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
    this.processRecord.write({ pid: null, port: this.config.port, pgPort: this.config.pgPort });
    await this.run('pg_ctl', ['-D', this.pgData, '-l', this.pgLog, '-o', pgOptions(this.config.pgPort), '-w', '-t', '20', 'start'], signal);
    signal.throwIfAborted();
    this.bootId = crypto.randomUUID();
    if (this.packaged) return this.startRelease(signal);
    const env = { ...process.env, BARKDOWN_RELEASE_MODE:'', BARKDOWN_RELEASE_BIN:'', BARKDOWN_RELEASE_BOOT_SCRIPT:'', MIX_ENV: 'dev', MIX_BUILD_PATH: this.build.path, PORT: String(this.config.port),
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
      ? spawn(powershell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', externalResource('local-barkpark-launch.ps1')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
      // POSIX: a detached leader makes the runtime its own process group (see stop()).
      : spawn('/bin/sh', [externalResource('local-barkpark-launch.sh')], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (this.child.pid) this.processRecord.write({ pid: this.child.pid, port: this.config.port, pgPort: this.config.pgPort, bootId: this.bootId });
    const log = text => fs.appendFileSync(path.join(this.dataDir, 'server.log'), String(text).split(this.secrets.password).join('[redacted]').split(this.secrets.token).join('[redacted]'));
    this.child.stdout.on('data', log); this.child.stderr.on('data', log);
    this.child.on('error', error => { this.processError = error.message; });
  }
  // A packaged release: no mix, no checkout. Create the database, bring it forward, seed it
  // once, then start the server as its own process group. Nothing listens on a distribution
  // port: the node is not distributed, and it is stopped by signalling its group.
  async startRelease(signal) {
    const keys = releaseSecrets(this.secrets.password);
    this.redact = [this.secrets.password, this.secrets.token, ...Object.values(keys)];
    const hostEnv = WINDOWS ? { PATH: [systemTool(''),systemRoot()].join(';'), PATHEXT:'.COM;.EXE;.BAT;.CMD', SystemRoot: systemRoot(), WINDIR:systemRoot(), ComSpec:systemTool('cmd.exe'), USERPROFILE:process.env.USERPROFILE, APPDATA:process.env.APPDATA, LOCALAPPDATA:process.env.LOCALAPPDATA, TEMP:this.dataDir, TMP:this.dataDir } : { PATH:'/usr/bin:/bin:/usr/sbin:/sbin', HOME:process.env.HOME || this.dataDir, LANG:process.env.LANG || 'en_US.UTF-8' };
    const env = { ...hostEnv, ...keys,
      DATABASE_URL: `ecto://postgres:${encodeURIComponent(this.secrets.password)}@127.0.0.1:${this.config.pgPort}/barkdown`, POOL_SIZE: '3',
      // Since Barkpark separated its public port from its listen port, a release assumes the scheme's standard port in
      // every absolute address it hands out (pictures came back as http://127.0.0.1/media/… and could not be fetched).
      // The local runtime's public port is the one it listens on: PHX_PORT says so.
      PORT: String(this.config.port), PHX_PORT: String(this.config.port), PHX_HOST: '127.0.0.1', PHX_SCHEME:'http', RELEASE_DISTRIBUTION: 'none', RELEASE_TMP: path.join(this.dataDir, 'release-tmp'), ERL_CRASH_DUMP: path.join(this.dataDir, 'erl_crash.dump'),
      ...(WINDOWS ? { BARKDOWN_RELEASE_BIN:this.packaged.bin, BARKDOWN_RELEASE_BOOT_SCRIPT:externalResource('local-barkpark-release-boot.exs'), BARKDOWN_LOCAL_DATA:this.dataDir, BARKDOWN_BOOT_ID:this.bootId } : {}),
      BARKPARK_INGEST_TOKEN: this.secrets.token, BARKPARK_SEED_PROFILE: 'clean', BARKPARK_SEED_ADMIN_TOKEN: this.secrets.token, BARKPARK_PLUGINS: 'bulldocs,media',
      BARKPARK_MEDIA_DIR: path.join(this.dataDir, 'media'), BARKPARK_INDX_STATE_DIR: path.join(this.dataDir, 'indx'), BARKPARK_BUNDLE_SPILL_DIR: path.join(this.dataDir, 'bundles') };
    // Migration and seed are one-shot tasks and run without admission, as the release demands: a
    // managed instance refuses a seed boot. The server itself is started with it.
    const serverEnv = { ...env, ...(this.config.writeAdmission ? admissionEnv(this.dataDir, this.config.writeAdmission.instanceId) : {}) };
    const clean = text => this.redact.reduce((out, secret) => out.split(secret).join('[redacted]'), String(text));
    const log = text => fs.appendFileSync(path.join(this.dataDir, 'server.log'), clean(text));
    const launchArgs = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', externalResource('local-barkpark-launch.ps1')];
    const evaluate = async (expression, timeout, mode) => {
      try { const { stdout, stderr } = await exec(WINDOWS ? powershell() : this.packaged.bin, WINDOWS ? launchArgs : ['eval', expression], { env:WINDOWS ? {...env,BARKDOWN_RELEASE_MODE:mode} : env, windowsHide:true, timeout, signal, maxBuffer: 16 * 1024 * 1024 }); log(stdout); log(stderr); }
      catch (error) { log(error.stdout || ''); log(error.stderr || ''); throw new Error('The packaged Barkpark could not prepare its database. ' + clean(String(error.stderr || error.stdout || error.message).slice(-600))); }
    };
    const at = ['-h', '127.0.0.1', '-p', String(this.config.pgPort), '-U', 'postgres'];
    const { stdout } = await this.run('psql', [...at, '-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'barkdown'"], signal, 15000);
    if (String(stdout).trim() !== '1') await this.run('createdb', [...at, 'barkdown'], signal, 60000);
    await evaluate('Barkpark.Release.migrate()', 10 * 60 * 1000, 'migrate');
    signal.throwIfAborted();
    if (!fs.existsSync(path.join(this.dataDir, 'seeded'))) {
      // The release's own seed entry: it boots the tree without the listener and with the job queue
      // inert. Starting the whole application under eval bound the port and died after five seconds.
      await evaluate('Barkpark.Release.seed()', 5 * 60 * 1000, 'seed');
      fs.writeFileSync(path.join(this.dataDir, 'seeded'), 'clean\n');
    }
    signal.throwIfAborted();
    // The database is ready for this boot; the server answering is checked by healthy().
    if (!WINDOWS) fs.writeFileSync(path.join(this.dataDir, 'boot-ready'), this.bootId);
    this.processError = null;
    this.child = spawn(WINDOWS ? powershell() : this.packaged.bin, WINDOWS ? launchArgs : ['start'], { env: { ...serverEnv, PHX_SERVER: 'true', ...(WINDOWS ? {BARKDOWN_RELEASE_MODE:'server'} : {}) }, windowsHide:true, detached: !WINDOWS, stdio: ['ignore', 'pipe', 'pipe'] });
    if (this.child.pid) this.processRecord.write({ pid: this.child.pid, port: this.config.port, pgPort: this.config.pgPort, bootId: this.bootId });
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
      if (WINDOWS) await exec(systemTool('taskkill.exe'), ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 }).catch(error => { if (this.child.exitCode == null) throw error; });
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
    // Everything this driver launched has stopped; nothing is left to reclaim.
    this.processRecord.clear();
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
module.exports = { SourceDriver, validate, toolchain, releaseOf, releaseSecrets, RELEASE_MARK };
