// Test-only configured-backend host. Production driver code remains unchanged.
const fs = require('fs');
const assert = require('assert/strict');
const cp = require('child_process');
const actualSpawn = cp.spawn;
const root = 'C:/Users/Frikk/Documents/GitHub/barkdown';
const endpoint = process.env.C108_S3_ENDPOINT;
assert.match(endpoint, /^http:\/\/127\.0\.0\.1:\d+$/);
let serverInjections = 0;
const variant=process.env.C108_CACHE_VARIANT;assert(['original-controller','pass-refusal'].includes(variant));
cp.spawn = (command, args, options) => {
  if (options?.env?.BARKDOWN_RELEASE_MODE === 'server') {
    serverInjections++;
    options = { ...options, env: { ...options.env,
      C108_CACHE_VARIANT: variant, BARKDOWN_RELEASE_BOOT_SCRIPT: "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-http-refusal478/boot-private.exs",
      BARKPARK_MEDIA_STORAGE: 's3', BARKPARK_S3_ENDPOINT: endpoint,
      BARKPARK_S3_BUCKET: 'synthetic-cache-proof', BARKPARK_S3_REGION: 'synthetic-region',
      BARKPARK_S3_ACCESS_KEY_ID: 'synthetic-access', BARKPARK_S3_SECRET_ACCESS_KEY: 'synthetic-secret'
    } };
  }
  return actualSpawn(command, args, options);
};
const { SourceDriver } = require(root + '/app/main/local-barkpark-source');
const { LocalBarkpark } = require(root + '/app/main/local-barkpark');
let driver, lifecycle;
process.on('message', async message => {
  try {
    if (message.action === 'start') {
      driver = new SourceDriver(message.config, message.data, message.secrets);
      lifecycle = new LocalBarkpark(driver);
      await lifecycle.start();
      assert.equal(serverInjections, 1);
      process.send({ ok: true, record: driver.processRecord.read(), serverInjections, endpoint, lifecycle: lifecycle.status() });
    } else if (message.action === 'stop') {
      await lifecycle.stop();
      process.send({ ok: true, serverInjections }, () => process.disconnect());
    } else throw Error('Unknown owned proof action');
  } catch (error) {
    let cleanupError;
    if (driver?.lease) try { await driver.stop(); await driver.release(); } catch (e) { cleanupError = e.message; }
    process.send({ ok: false, error: error.message, cleanupError }, () => process.disconnect());
  }
});
