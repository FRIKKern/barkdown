// Own a disposable Barkpark and CLI config for live screenshots. Never switch the user's CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appDir, '../../barkpark-editor'));
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-shots-runtime-'));
const free = () => new Promise((resolve, reject) => { const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
const port = await free(); let pgPort = await free(); while (pgPort === port) pgPort = await free();
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const driver = new SourceDriver({ source, port, pgPort }, data, secrets);
const runtime = new LocalBarkpark(driver);
const git = args => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
const commit = git(['rev-parse', 'HEAD']);
const dirty = git(['status', '--porcelain']) !== '';
runtime.on('status', s => console.log('Capture runtime:', s.phase, s.error || ''));
console.log('Isolated capture data:', data);
try {
  await runtime.start();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tests/status-shots.mjs'], { cwd: appDir, windowsHide: true, stdio: 'inherit', env: {
      ...process.env, XDG_CONFIG_HOME: path.join(data, 'cli-config'), BARKPARK_API_URL: driver.server, BARKPARK_API_TOKEN: secrets.token, BARKPARK_DATASET: 'production',
      BARKDOWN_SHOTS_SERVER: driver.server, BARKDOWN_SHOTS_BP_COMMIT: commit, BARKDOWN_SHOTS_BP_DIRTY: String(dirty), BARKDOWN_SHOTS_ISOLATED: '1',
    } });
    child.once('error', reject); child.once('exit', resolve);
  });
  if (code !== 0) throw new Error('Live screenshot capture failed with exit ' + code);
} finally {
  await runtime.stop();
  if (fs.existsSync(path.join(data, 'pgdata', 'postmaster.pid'))) throw new Error('Owned capture database did not stop; retained for diagnosis.');
}
console.log('Live screenshots complete; private runtime stopped; user CLI configuration unchanged.');
