import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const source = 'C:/Users/Frikk/.codex/worktrees/barkpark-paper-create/api';
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'c044-exunit-'));
const pg = 'C:/Users/Frikk/scoop/apps/postgresql/current/bin';
const mix = 'C:/Users/Frikk/scoop/apps/elixir/current/bin/mix.bat';
const password = crypto.randomBytes(32).toString('hex');
const listener = net.createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r)); const port = listener.address().port; await new Promise(r => listener.close(r));
const env = { ...process.env, MIX_ENV: 'test', PATH: `C:/Users/Frikk/scoop/apps/elixir/current/bin;C:/Users/Frikk/scoop/apps/erlang/current/bin;${process.env.PATH}`, C044_PG_PORT: String(port), BARKPARK_TEST_DB_HOST: '127.0.0.1', BARKPARK_TEST_DB_USER: 'postgres', BARKPARK_TEST_DB_PASS: password, BARKPARK_INDX_STATE_DIR: path.join(data, 'indx'), BARKPARK_MEDIA_DIR: path.join(data, 'media'), BARKPARK_BUNDLE_SPILL_DIR: path.join(data, 'bundles') };
function run(exe, args) { return new Promise((resolve, reject) => { const p = spawn(exe, args, { cwd: source, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); p.stdout.on('data', d => process.stdout.write(String(d).split(password).join('[redacted]'))); p.stderr.on('data', d => process.stderr.write(String(d).split(password).join('[redacted]'))); p.on('error', reject); p.on('exit', code => code === 0 ? resolve() : reject(Error(`Owned command exited ${code}`))); }); }
console.log('Owned ExUnit data:', data);
if (!fs.existsSync(path.join(source, '_build/test'))) await fsp.cp(path.join(source, '_build/dev'), path.join(source, '_build/test'), { recursive: true, force: false, errorOnExist: true });
const script = path.join(data, 'run.exs');
fs.writeFileSync(script, `repo = Application.fetch_env!(:barkpark, Barkpark.Repo)
Application.put_env(:barkpark, Barkpark.Repo, Keyword.put(repo, :port, String.to_integer(System.fetch_env!("C044_PG_PORT"))))
Mix.Task.run("test", ["test/barkpark_web/controllers/bulldocs_create_controller_test.exs", "test/barkpark_web/controllers/bulldocs_ingest_controller_test.exs", "test/barkpark_web/controllers/bulldocs_ingest_scope_test.exs"])
`);
const passwordFile = path.join(data, 'init-password'); fs.writeFileSync(passwordFile, password);
let started = false;
try {
  await run(path.join(pg, 'initdb.exe'), ['-D', path.join(data, 'pgdata'), '-U', 'postgres', '--auth=scram-sha-256', '--pwfile=' + passwordFile, '-E', 'UTF8']);
  fs.unlinkSync(passwordFile);
  await run(path.join(pg, 'pg_ctl.exe'), ['-D', path.join(data, 'pgdata'), '-l', path.join(data, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']); started = true;
  const launcher = path.join(data, 'run.ps1');
  fs.writeFileSync(launcher, `& '${mix}' run --no-start '${script}'\nexit $LASTEXITCODE\n`);
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', launcher]);
} finally { if (started) await run(path.join(pg, 'pg_ctl.exe'), ['-D', path.join(data, 'pgdata'), '-m', 'fast', '-w', 'stop']); }
