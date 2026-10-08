import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createShellEnvironment: createEnvironment, mergePath, parsePrintenv, parseRegistryPath } = require('../main/shell-environment');
const shells = path.resolve('tests/fixtures/shells');
const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-shell-env-'));
const tools = '/fixture/tools'; fs.mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
const base = { PATH: '/usr/bin:/bin', HOME: home, BD_FIXTURE_PATH: `${tools}:/opt/homebrew/bin:/usr/bin` };
const noLaunchctl = ['/usr/bin/false'];
// Real children implement the tool protocol without requiring Unix executables on Windows.
// The POSIX live tour separately exercises an actual login shell.
function fixtureSpawn(file, args, options) {
  const name = path.basename(file);
  let script;
  if (name === 'slow.sh') script = 'setTimeout(() => {}, 30000)';
  else if (name === 'good.sh') {
    assert.deepEqual(args, ['-ilc', 'echo __BARKDOWN_SHELL_ENV__; printenv']);
    script = 'console.log("Welcome banner\\n__BARKDOWN_SHELL_ENV__\\nPATH=" + process.env.BD_FIXTURE_PATH + "\\nSSH_AUTH_SOCK=/tmp/fixture-agent.sock")';
  } else if (name === 'launchctl.sh') script = 'console.log("/from/launchctl:/usr/bin")';
  else if (name === 'reg.sh') {
    assert.deepEqual([args[0], ...args.slice(2)], ['query', '/v', 'Path']);
    const answer = args[1].startsWith('HKLM')
      ? '    Path    REG_EXPAND_SZ    C:\\Windows;%SystemRoot%\\System32'
      : '    Path    REG_SZ    C:\\Users\\me\\AppData\\Roaming\\npm';
    script = 'console.log(' + JSON.stringify(answer) + ')';
  } else script = 'process.exit(64)';
  return require('node:child_process').spawn(process.execPath, ['-e', script], options);
}
const createShellEnvironment = options => createEnvironment({ spawnImpl: fixtureSpawn, ...options });
{
  // The login shell's PATH leads, inherited entries follow, known folders that exist come last; adopted variables arrive.
  const shell = createShellEnvironment({ platform: 'darwin', env: { ...base, SHELL: path.join(shells, 'good.sh') }, home, timeoutMs: 2000, launchctl: noLaunchctl, exists: f => f === path.join(shells, 'good.sh') || f === path.join(home, '.local', 'bin') });
  const result = await shell.hydrate();
  assert.equal(result.source, 'login-shell:' + path.join(shells, 'good.sh'));
  assert.equal(result.env.PATH, [tools, '/opt/homebrew/bin', '/usr/bin', '/bin', path.join(home, '.local', 'bin')].join(':'));
  assert.equal(result.env.SSH_AUTH_SOCK, '/tmp/fixture-agent.sock');
  assert.equal(result.env.HOME, home, 'inherited values are kept');
  assert.equal(await shell.hydrate(), result, 'hydration happens once');
  // A variable set after the probe still reaches a run: the shell's contribution lays over the live environment.
  const live = { ...base, SHELL: path.join(shells, 'good.sh') }; const liveShell = createShellEnvironment({ platform: 'darwin', env: live, home, timeoutMs: 2000, launchctl: noLaunchctl, exists: f => f === path.join(shells, 'good.sh') || f === path.join(home, '.local', 'bin') });
  await liveShell.hydrate(); live.ANTHROPIC_API_KEY = 'set-later'; live.PATH = '/usr/bin:/bin:/late';
  assert.equal(liveShell.current().ANTHROPIC_API_KEY, 'set-later'); assert.equal(liveShell.current().PATH, [tools, '/opt/homebrew/bin', '/usr/bin', '/bin', '/late', path.join(home, '.local', 'bin')].join(':'));
  assert.equal(liveShell.current().SSH_AUTH_SOCK, '/tmp/fixture-agent.sock');
  assert.equal(shell.status().pathEntries, process.platform === 'win32' ? 6 : 5, 'simulated POSIX PATH includes the host-native known directory');
  assert.deepEqual(Object.keys(shell.status().probed[0]).sort(), ['ms', 'ok', 'shell'], 'a probe record never carries the shell environment');
}
{
  // Without an installed instance a process answers with its own environment; with one, the hydrated environment.
  const mod = require('../main/shell-environment');
  assert.equal(mod.providerEnv(), process.env);
  const inst = mod.install(createShellEnvironment({ platform: 'darwin', env: { ...base, SHELL: path.join(shells, 'good.sh') }, home, timeoutMs: 2000, launchctl: noLaunchctl, exists: f => f === path.join(shells, 'good.sh') }), { hydrate: true });
  const ready = await mod.providerEnvReady();
  assert.ok(ready.PATH.startsWith(tools + ':')); assert.deepEqual(mod.providerEnv(), inst.current(), 'the installed instance answers, composed afresh each call');
}
{
  // A hanging shell is skipped within its budget, a shell that rejects -ilc is skipped, and the next candidate answers.
  const env = { ...base, SHELL: path.join(shells, 'slow.sh') };
  const shell = createShellEnvironment({ platform: 'linux', env, home, timeoutMs: 300, launchctl: noLaunchctl, exists: () => true,
    spawnImpl: (file, args, options) => fixtureSpawn(file === 'getent' ? path.join(shells, 'strict.sh') : file === '/bin/bash' ? path.join(shells, 'good.sh') : file, args, options) });
  const started = Date.now(); const result = await shell.hydrate();
  assert.ok(Date.now() - started < 2000, 'the hung shell did not hold hydration');
  assert.equal(result.probed[0].ok, false); assert.match(result.probed[0].error, /timed out/);
  assert.equal(result.source, 'login-shell:/bin/bash');
  assert.ok(result.env.PATH.startsWith(tools + ':'));
}
{
  // No shell answers: macOS falls back to launchctl; elsewhere the inherited PATH plus known folders stands.
  const launch = path.join(home, 'launchctl.sh'); fs.writeFileSync(launch, '#!/bin/sh\necho "/from/launchctl:/usr/bin"\n'); fs.chmodSync(launch, 0o755);
  const mac = createShellEnvironment({ platform: 'darwin', env: { ...base, SHELL: path.join(shells, 'strict.sh') }, home, timeoutMs: 3000, launchctl: [launch], exists: f => f === path.join(shells, 'strict.sh') || f === path.join(home, '.local', 'bin') });
  const got = await mac.hydrate();
  assert.equal(got.source, 'launchctl'); assert.equal(got.env.PATH, ['/from/launchctl', '/usr/bin', '/bin', path.join(home, '.local', 'bin')].join(':'));
  const linux = createShellEnvironment({ platform: 'linux', env: { ...base, SHELL: path.join(shells, 'strict.sh') }, home, timeoutMs: 3000, exists: f => f === path.join(shells, 'strict.sh') || f === path.join(home, '.local', 'bin'), spawnImpl: (file, args, options) => fixtureSpawn(file === 'getent' ? '/usr/bin/false' : file, args, options) });
  const stood = await linux.hydrate();
  assert.equal(stood.source, 'inherited'); assert.equal(stood.env.PATH, ['/usr/bin', '/bin', path.join(home, '.local', 'bin')].join(':'));
}
{
  // Before hydration the current environment is inherited plus known folders; parsers handle banners, missing sentinels and registry output.
  const shell = createShellEnvironment({ platform: 'darwin', env: base, home, exists: f => f === path.join(home, '.local', 'bin') });
  assert.equal(shell.current().PATH, ['/usr/bin', '/bin', path.join(home, '.local', 'bin')].join(':'));
  assert.deepEqual(parsePrintenv('banner\n__BARKDOWN_SHELL_ENV__\nPATH=/a:/b\nX=1=2\n'), { PATH: '/a:/b', X: '1=2' });
  assert.equal(parsePrintenv('no sentinel\nPATH=/a'), null);
  assert.deepEqual(parseRegistryPath('\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %USERPROFILE%\\.local\\bin;C:\\Tools\r\n', { USERPROFILE: 'C:\\Users\\me' }), ['C:\\Users\\me\\.local\\bin', 'C:\\Tools']);
  assert.equal(mergePath(['/a', '/b'], ['/b', '/c'], ['/d', '/a'], ':'), '/a:/b:/c:/d');
}
{
  // Windows: machine PATH, then user PATH, then inherited, read through reg.exe.
  const regScript = path.join(home, 'reg.sh'); fs.writeFileSync(regScript, '#!/bin/sh\ncase "$2" in HKLM*) printf "%s\\n" "    Path    REG_EXPAND_SZ    C:\\\\Windows;%SystemRoot%\\\\System32";; *) printf "%s\\n" "    Path    REG_SZ    C:\\\\Users\\\\me\\\\AppData\\\\Roaming\\\\npm";; esac\n'); fs.chmodSync(regScript, 0o755);
  const win = createShellEnvironment({ platform: 'win32', env: { Path: 'C:\\Stale', SystemRoot: 'C:\\Windows' }, home: 'C:\\Users\\me', timeoutMs: 1000, reg: regScript, exists: () => false });
  const got = await win.hydrate();
  assert.equal(got.source, 'registry');
  assert.equal(got.env.Path, 'C:\\Windows;C:\\Windows\\System32;C:\\Users\\me\\AppData\\Roaming\\npm;C:\\Stale');
}
fs.rmSync(home, { recursive: true, force: true });
console.log('Shell environment: login-shell PATH leads and merges, hung and strict shells are skipped within budget, launchctl and registry fallbacks, parsers and the pre-hydration floor passed.');
