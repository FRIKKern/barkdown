// Media addresses of an imported library: only loopback media requests at an origin the
// profile was imported from are redirected, and only to the profile's current runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { carried, redirect } = require('../main/media-origins');
test('the origins a library carries: the exporting runtime first, then what it carried, never the current one', () => {
  assert.deepEqual(carried({ runtime: { origin: 'http://127.0.0.1:60838', formerOrigins: ['http://127.0.0.1:50001', 'http://127.0.0.1:60838', 'https://example.com', 'http://127.0.0.1', 'junk'] } }, 'http://127.0.0.1:50001/'), ['http://127.0.0.1:60838']);
  assert.deepEqual(carried({}, 'http://127.0.0.1:1'), []);
});
test('only media of a recorded origin is redirected to the current runtime', () => {
  const state = { current: 'http://127.0.0.1:61000', former: ['http://127.0.0.1:60838'] };
  assert.equal(redirect('http://127.0.0.1:60838/media/files/a.png?w=2', state), 'http://127.0.0.1:61000/media/files/a.png?w=2');
  assert.equal(redirect('http://localhost:60838/media/a.png', { ...state, former: ['http://localhost:60838'] }), 'http://127.0.0.1:61000/media/a.png');
  for (const url of ['http://127.0.0.1:61000/media/a.png', 'http://127.0.0.1:60838/v1/data/doc/x', 'http://127.0.0.1:60999/media/a.png', 'https://127.0.0.1:60838/media/a.png', 'http://example.com:60838/media/a.png', 'file:///media/a.png', 'not a url'])
    assert.equal(redirect(url, state), null, url);
  assert.equal(redirect('http://127.0.0.1:60838/media/a.png', { current: null, former: state.former }), null);
  assert.equal(redirect('http://127.0.0.1:60838/media/a.png', { current: state.current, former: [] }), null);
});
