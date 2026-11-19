// The account badge beside "Barkdown" must never carry a person's initials: the app has no
// name for the person using it, so it shows a neutral person icon (task-b29a934318ed1a2f).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../renderer/index.html', import.meta.url), 'utf8');

test('the account badge shows a person icon, never letters', () => {
  const badge = html.match(/<span class="bw-avatar" id="bw-avatar">([\s\S]*?)<\/span>/);
  assert.ok(badge, 'account badge is in index.html');
  assert.match(badge[1], /data-lucide="user"/);
  assert.equal(badge[1].replace(/<[^>]*>/g, '').trim(), '', 'no text inside the badge');
});
