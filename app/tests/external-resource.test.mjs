import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { externalResource } = require('../main/external-resource');
test('external resources map only the direct app.asar parent of main', () => {
  for (const name of ['goal-worker-host.ps1', 'local-barkpark-launch.ps1', 'local-barkpark-launch.sh', 'local-barkpark-boot.exs', 'local-barkpark-release-boot.exs']) {
    assert.equal(externalResource(name, path.resolve('main')), path.resolve('main', name));
    assert.equal(externalResource(name, 'C:/app/resources/app.asar/main'), path.join('C:/app/resources/app.asar.unpacked/main', name));
    if (process.platform === 'win32') assert.equal(externalResource(name, 'C:\\app\\resources\\app.asar\\main'), path.join('C:\\app\\resources\\app.asar.unpacked\\main', name));
    assert.equal(externalResource(name, 'C:/app/app.asar-backup/main'), path.join('C:/app/app.asar-backup/main', name));
    assert.equal(externalResource(name, 'C:/portable/app.asar/Barkdown/resources/app.asar/main'), path.join('C:/portable/app.asar/Barkdown/resources/app.asar.unpacked/main', name));
    assert.equal(externalResource(name, 'C:/work/app.asar/barkdown/app/main'), path.join('C:/work/app.asar/barkdown/app/main', name));
  }
  for (const name of ['../secret.ps1', 'goal-worker.js', 'arbitrary.ps1']) assert.throws(() => externalResource(name), /Unknown/);
});
