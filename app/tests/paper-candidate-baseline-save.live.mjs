// Native Paper proof across an exact editor candidate -> served-baseline restoration.
// The isolated wrapper owns Barkpark; this fixture owns the proxy and one persistent desktop profile.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startSwitchingEditorAssetProxy } from './helpers/editor-asset-proxy.mjs';
import { getPaper, openFixturePaper, publishFixture } from './lib/paper-fixture.mjs';

const require = createRequire(import.meta.url);
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1') throw new Error('Run through status-shots-isolated.mjs; this fixture writes only to its disposable Barkpark.');

const files = [
  'bp-paper-code.js',
  'bp-paper-editor-shell.css',
  'bp-paper-editor.bundle.js',
  'bp-paper-editor.css',
  'bp-paper-mermaid.js',
  'bp-paper-surface.css',
];
const nativeFiles = ['bp-paper-editor.bundle.js', 'bp-paper-editor.css'];
const digest = (algorithm, bytes) => crypto.createHash(algorithm).update(bytes).digest('hex');

function auditedPhase(name, version, envName) {
  const dirValue = process.env[envName];
  if (!dirValue) throw new Error(`${envName} is required`);
  const dir = path.resolve(dirValue);
  const declared = new Map(fs.readFileSync(path.join(dir, 'SHA256SUMS'), 'utf8').trim().split('\n').map(line => {
    const match = /^([a-f0-9]{64})  (bp-paper-[^/]+)$/.exec(line);
    if (!match) throw new Error(`Invalid ${name} SHA256SUMS line: ${line}`);
    return [match[2], match[1]];
  }));
  assert.deepEqual([...declared.keys()].sort(), [...files].sort(), `${name} must declare exactly six browser assets`);
  const all = Object.fromEntries(files.map(file => {
    const bytes = fs.readFileSync(path.join(dir, file));
    assert.equal(digest('sha256', bytes), declared.get(file), `${name} ${file} differs from its preserved digest`);
    return [file, { bytes, sha256: declared.get(file), sha1: digest('sha1', bytes) }];
  }));
  return {
    name,
    version,
    all,
    assets: Object.fromEntries(nativeFiles.map(file => [`/assets/${file}`, all[file].bytes])),
  };
}

const candidate = auditedPhase('candidate', '1.22.0-candidate', 'BARKDOWN_EDITOR_CANDIDATE_DIR');
const baseline = auditedPhase('baseline', '1.21.0-baseline', 'BARKDOWN_EDITOR_BASELINE_DIR');
assert.ok(nativeFiles.some(file => candidate.all[file].sha256 !== baseline.all[file].sha256), 'candidate and baseline native pairs must differ');

const slug = 'candidate-baseline-save-reload';
const seedText = 'The restored baseline must save this Paper.';
publishFixture({
  slug,
  title: 'Candidate baseline restoration save proof',
  description: 'Disposable Paper proving an acknowledged human save and reload after exact editor baseline restoration.',
  blocks: [{ type: 'heading', level: 1, text: 'Baseline restoration' }, { type: 'paragraph', content: [{ type: 'text', value: seedText }] }],
});

const proxy = await startSwitchingEditorAssetProxy(process.env.BARKDOWN_SHOTS_SERVER, candidate);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-paper-restore-'));
const evidenceDir = path.resolve(process.env.BARKDOWN_PAPER_RESTORE_EVIDENCE || path.join(userData, 'evidence'));
fs.mkdirSync(evidenceDir, { recursive: true });

let app;
let page;
const phases = [];
const launch = () => electron.launch({
  executablePath: require('electron'),
  args: [path.resolve('.'), '--legacy', `--user-data=${userData}`],
  env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' },
});

async function openPaper(phase, connect) {
  app = await launch();
  page = await app.firstWindow();
  await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 30000 });
  if (connect) {
    await page.evaluate(async ({ server, token }) => {
      window.__barkdown.state.settings = await window.barkdown.settings.set({
        barkpark: { enabled: true, viaCli: false, writes: true, server, token },
      });
    }, { server: proxy.url, token: process.env.BARKPARK_API_TOKEN });
  } else {
    const restoredServer = await page.evaluate(() => window.__barkdown.state.settings?.barkpark?.server);
    assert.equal(restoredServer, proxy.url, 'baseline launch must reuse the candidate profile connection');
  }
  await openFixturePaper(page, slug);
  await page.waitForSelector('.bw-paper-pane .ProseMirror', { timeout: 60000 });
  const bundle = await page.evaluate(() => window.__barkdown.state.canvasBundle);
  assert.equal(bundle.source, 'server', `${phase.name} bundle source`);
  assert.equal(bundle.sha, phase.all[nativeFiles[0]].sha1, `${phase.name} executable SHA-1`);
  assert.equal(bundle.cssSha, phase.all[nativeFiles[1]].sha1, `${phase.name} stylesheet SHA-1`);
  const loaded = await page.evaluate(() => ({
    js: document.querySelector('script[data-canvas-bundle]')?.src,
    css: document.querySelector('link[data-canvas-bundle]')?.href,
  }));
  for (const [kind, file] of [['js', nativeFiles[0]], ['css', nativeFiles[1]]]) {
    assert.ok(loaded[kind]?.startsWith('file:///'), `${phase.name} ${kind} must execute from the verified profile cache`);
    assert.equal(digest('sha256', fs.readFileSync(fileURLToPath(loaded[kind]))), phase.all[file].sha256, `${phase.name} loaded ${file}`);
  }
  phases.push({ name: phase.name, bundle: { source: bundle.source, version: bundle.version, sha: bundle.sha, cssSha: bundle.cssSha }, loaded });
}

const snapshot = () => page.evaluate(() => document.querySelector('bp-paper-canvas').recoverySnapshot().blocks);

try {
  await openPaper(candidate, true);
  assert.deepEqual(await snapshot(), getPaper(slug).blocks, 'candidate launch opens the disposable Paper');
  await app.close();
  app = null;
  page = null;

  proxy.use(baseline);
  await openPaper(baseline, false);
  const before = getPaper(slug);
  await page.locator('.ProseMirror > p').first().click();
  await page.keyboard.press('End');
  const appended = ' Saved after baseline restoration.';
  await page.keyboard.type(appended);
  await page.waitForFunction(previousRev => {
    const canvas = document.querySelector('bp-paper-canvas');
    const host = [...window.__barkdown.controllers.values()].find(controller => controller.el?.contains(canvas));
    const status = document.querySelector('.bw-paper-pane #save-state')?.textContent || '';
    return canvas && host && !host.isDirty() && !canvas.hasPendingChanges()
      && Number(status.match(/Saved · rev (\d+)/)?.[1]) > previousRev;
  }, before.rev, { timeout: 45000 });
  const acknowledged = getPaper(slug);
  assert.ok(acknowledged.rev > before.rev, 'server revision advances after the restored-baseline edit');
  assert.ok(JSON.stringify(acknowledged.blocks).includes(seedText + appended), 'server contains the human edit made on the restored baseline');
  assert.deepEqual(await snapshot(), acknowledged.blocks, 'clean canvas equals the acknowledged server blocks');

  await page.evaluate(() => { document.querySelector('bp-paper-canvas').__restoreProof = true; });
  await page.locator('.bw-paper-pane button[title="Reload from server"]').click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('bp-paper-canvas');
    return canvas && !canvas.__restoreProof && canvas._editor;
  }, null, { timeout: 30000 });
  assert.deepEqual(await snapshot(), acknowledged.blocks, 'acknowledged server blocks survive explicit reload');

  const manifest = {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT,
    barkparkDirty: process.env.BARKDOWN_SHOTS_BP_DIRTY,
    buildFingerprint: process.env.BARKDOWN_SHOTS_BUILD_FINGERPRINT,
    isolation: { loopbackOnly: true, liveMutation: false, server: process.env.BARKDOWN_SHOTS_SERVER, proxy: proxy.url, userData },
    assets: Object.fromEntries([candidate, baseline].map(phase => [phase.name, Object.fromEntries(files.map(file => [file, phase.all[file].sha256]))])),
    phases,
    proxy: proxy.counts,
    revisions: { before: before.rev, acknowledged: acknowledged.rev },
    assertions: [
      'all six candidate and baseline files matched their preserved SHA256SUMS',
      'one persistent Barkdown profile loaded the exact candidate pair and then the exact restored baseline pair',
      'a human edit on the restored baseline received a newer real server revision',
      'explicit reload reproduced the acknowledged server blocks exactly',
      'all Paper writes stayed inside the disposable loopback Barkpark runtime',
    ],
  };
  fs.writeFileSync(path.join(evidenceDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ evidence: evidenceDir, revisions: manifest.revisions, assertions: manifest.assertions }, null, 2));
} finally {
  if (app) await app.close().catch(() => {});
  await proxy.close();
}
