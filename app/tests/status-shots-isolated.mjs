// Own a disposable Barkpark and CLI config for live screenshots. Never switch the user's CLI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cleanSource, captureWithCleanup, verifyStatusReadme } from './helpers/capture-lifecycle.mjs';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE || path.join(appDir, '../../barkpark-editor'));
// Validate before allocating data or starting a driver. New append-only host
// evidence may coexist with a source checkpoint; tracked edits never may.
const host = cleanSource(path.dirname(appDir), { allowEvidence: true });
const hostRoot = path.dirname(appDir);
const captureArgs = process.argv.length > 2 ? process.argv.slice(2) : ['tests/status-shots.mjs'];
const statusCapture = path.resolve(appDir, captureArgs[0]) === path.join(appDir, 'tests/status-shots.mjs');
const originalReadme = statusCapture ? fs.readFileSync(path.join(hostRoot, 'README.md'), 'utf8') : null;
const captured = cleanSource(source);
const commit = captured.commit;
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-shots-runtime-'));
const free = () => new Promise((resolve, reject) => { const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); }); });
const port = await free(); let pgPort = await free(); while (pgPort === port) pgPort = await free();
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const driver = new SourceDriver({ source, port, pgPort }, data, secrets);
const runtime = new LocalBarkpark(driver);
runtime.on('status', s => console.log('Capture runtime:', s.phase, s.error || ''));
console.log('Isolated capture data:', data);
await captureWithCleanup({ runtime, data,
  verifySource(phase) {
    if (cleanSource(source).commit !== commit) throw Error('Runtime source commit changed during capture');
    const outputs = phase === 'after-capture' && statusCapture;
    if (cleanSource(hostRoot, { allowEvidence: true, allowStatusOutputs: outputs }).commit !== host.commit) throw Error('Host source commit changed during capture');
    if (outputs) verifyStatusReadme(hostRoot, originalReadme);
  },
  launch() {
    return spawn(process.execPath, captureArgs, { cwd: appDir, windowsHide: true, detached: process.platform !== 'win32', stdio: 'inherit', env: {
      ...process.env, XDG_CONFIG_HOME: path.join(data, 'cli-config'), BARKPARK_API_URL: driver.server, BARKPARK_API_TOKEN: secrets.token, BARKPARK_DATASET: 'production',
      BARKDOWN_SHOTS_SERVER: driver.server, BARKDOWN_SHOTS_BP_COMMIT: commit, BARKDOWN_SHOTS_BP_DIRTY: 'false', BARKDOWN_SHOTS_ISOLATED: '1', BARKDOWN_SHOTS_HOST_COMMIT: host.commit,
      BARKDOWN_SHOTS_BUILD_FINGERPRINT: driver.build?.fingerprint || '',
    } });
  },
});
console.log('Live screenshots complete; private runtime stopped; user CLI configuration unchanged.');
