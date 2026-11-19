// shared/error-code.js: the one reader of the "[code] text" an error carries across the context bridge, and
// the one place that decides "refused for good".
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { wireMessage, errorCode, errorText, refusedForGood } = require('../shared/error-code');

test('a code and the refused class cross the bridge in the message, and the server’s own code is kept', () => {
  // As preload builds it from main's answer, then as the window receives it: an Error with the message only.
  const bridged = new Error(wireMessage({ code: 'validation_failed', refused: true, message: 'Body is invalid.' }));
  assert.equal(bridged.message, '[validation_failed refused] Body is invalid.');
  assert.equal(errorCode(bridged), 'validation_failed');
  assert.equal(errorText(bridged), 'Body is invalid.');
  assert.equal(refusedForGood(bridged), true);
  const plain = new Error(wireMessage({ code: 'draft_creation_uncertain', message: 'Creation is unconfirmed.' }));
  assert.deepEqual([errorCode(plain), errorText(plain), refusedForGood(plain)], ['draft_creation_uncertain', 'Creation is unconfirmed.', false]);
  for (const code of ['draft_identity', 'writes_disabled']) assert.equal(refusedForGood(new Error(`[${code}] x`)), true, code);
  // In main, before the bridge: the status decides, beside whatever code the server sent.
  for (const status of [400, 409, 413, 422]) assert.equal(refusedForGood({ status, code: 'validation_failed' }), true, String(status));
  for (const status of [401, 403, 404, 429, 500, 503]) assert.equal(refusedForGood({ status }), false, String(status));
  assert.equal(wireMessage({ message: 'no code' }), 'no code');
  assert.deepEqual([errorCode(new Error('no code')), errorText(new Error('no code')), errorText('text')], [null, 'no code', 'text']);
  assert.equal(errorCode({ code: 'own', message: '[other] x' }), 'own', 'an error that kept its code (main, tests) wins');
});
