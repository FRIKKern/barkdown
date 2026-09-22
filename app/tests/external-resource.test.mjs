import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { externalResource } = require('../main/external-resource');
test('external resources retain source paths and map only an exact app.asar segment', () => {
  for (const name of ['goal-worker-host.ps1', 'local-barkpark-launch.ps1', 'local-barkpark-boot.exs']) {
    assert.equal(externalResource(name, path.resolve('main')), path.resolve('main', name));
    assert.equal(externalResource(name, 'C:/app/resources/app.asar/main'), path.join('C:/app/resources/app.asar.unpacked/main', name));
    assert.equal(externalResource(name, 'C:\\app\\resources\\app.asar\\main'), path.join('C:\\app\\resources\\app.asar.unpacked\\main', name));
    assert.equal(externalResource(name, 'C:/app/app.asar-backup/main'), path.join('C:/app/app.asar-backup/main', name));
  }
  for (const name of ['../secret.ps1', 'goal-worker.js', 'arbitrary.ps1']) assert.throws(() => externalResource(name), /Unknown/);
});
