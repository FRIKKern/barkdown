import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { test } = require('node:test');
const { catalogOrigin } = require('../main/paper-origin');
const profileId = '11111111-1111-4111-8111-111111111111';
const connection = { server: 'http://127.0.0.1:4540', token: 'private-fixture', dataset: 'production', viaCli: false };
const managed = { profileId, connectionProfileId: profileId, connection };
test('only the current managed lease proves local ownership', () => {
  assert.deepEqual(catalogOrigin(connection, managed), { kind: 'local', profileId });
  for (const claim of [null, {}, { ...managed, profileId: 'invalid' }, { ...managed, connectionProfileId: '22222222-2222-4222-8222-222222222222' }, { ...managed, connection: null }]) assert.deepEqual(catalogOrigin(connection, claim), { kind: 'cloud' });
  for (const change of [{ server: 'http://127.0.0.1:4541' }, { token: 'foreign' }, { dataset: 'other' }, { viaCli: true }]) assert.deepEqual(catalogOrigin({ ...connection, ...change }, managed), { kind: 'cloud' });
  assert.deepEqual(catalogOrigin({ ...connection, paperOrigin: { kind: 'local', profileId } }, null), { kind: 'cloud' });
  assert(!JSON.stringify(catalogOrigin(connection, managed)).includes(connection.token));
});
