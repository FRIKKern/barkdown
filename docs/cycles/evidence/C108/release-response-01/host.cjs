// Test-only configured-backend host. Production driver code remains unchanged.
const fs = require('fs');
const assert = require('assert/strict');
const cp = require('child_process');
const actualSpawn = cp.spawn;
const root = 'C:/Users/Frikk/Documents/GitHub/barkdown';
let serverInjections = 0;
cp.spawn = (command, args, options) => {
  if (options?.env?.BARKDOWN_RELEASE_MODE === 'server') {
    serverInjections++;
    options = { ...options, env: { ...options.env,
      BARKDOWN_RELEASE_BOOT_SCRIPT: "C:/Users/Frikk/Documents/GitHub/barkdown/.git/C108-release-response1702/boot.exs", C108_CHECKOUT_OUTPUT: process.env.C108_CHECKOUT_OUTPUT, C108_IMAGE_BIN: process.env.C108_IMAGE_BIN, C108_CHECKOUT_MODE: process.env.C108_CHECKOUT_MODE, C108_HTTP_TOKEN_FILE: process.env.C108_HTTP_TOKEN_FILE
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
      process.send({ ok: true, record: driver.processRecord.read(), serverInjections, lifecycle: lifecycle.status() });
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
