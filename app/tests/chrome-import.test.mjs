// Import from Chrome (main/chrome-import.js) against a fixture laid out as Chrome lays out a profile:
// Local State names the profiles, Bookmarks is JSON, History is SQLite with Chrome's 1601 epoch.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { makeChromeFixture } from './lib/chrome-fixture.mjs';
const require = createRequire(import.meta.url);
const { listSources, importPlaces, suggest, readBookmarks } = require('../main/chrome-import');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chrome-'));
const fixtureRoot = makeChromeFixture(home);
assert.deepEqual(listSources({ home, platform: 'unsupported' }), [], 'unknown host layouts are not guessed');
const sources = listSources({ home });
assert.deepEqual(sources.map(s => [s.browser, s.profileDir, s.name, s.has.bookmarks, s.has.history]), [['chrome', 'Default', 'Person 1', true, true], ['chrome', 'Profile 1', 'Work desk', false, false]], 'a profile named in Local State but missing on disk is not offered');

const bookmarks = readBookmarks(path.join(fixtureRoot, 'Default'));
assert.deepEqual(bookmarks.bar.map(b => b.url), ['https://docs.barkpark.cloud/', 'https://fixture.example/'], 'only the bar\'s own links become Favorites');
assert.deepEqual(bookmarks.all.map(b => [b.url, b.folder.join('/')]), [['https://docs.barkpark.cloud/', ''], ['https://fixture.example/', ''], ['https://reading.example/long', 'Reading'], ['https://other.example/x', 'Other bookmarks']]);

const result = importPlaces({ browser: 'chrome', profileDir: 'Default' }, { home, now: () => '2026-10-02T12:00:00.000Z' });
assert.deepEqual(result.counts, { bookmarks: 4, bar: 2, history: 3, places: 6 }, 'hidden rows and chrome:// addresses are left out');
assert.equal(result.source.browserName, 'Google Chrome');
const home_ = result.places.find(p => p.url === 'https://fixture.example/');
assert.deepEqual([home_.visits, home_.typed, home_.bookmark, home_.lastVisit], [40, 12, true, 1790000000], 'history counts merge onto a bookmarked address');
assert.equal(result.places[0].url, 'https://fixture.example/', 'typed and visited addresses rank first');

// Suggestions: host matches first, then titles; bookmarks carry a star.
assert.deepEqual(suggest(result.places, 'fixture').map(s => s.url), ['https://fixture.example/', 'https://fixture.example/pricing']);
assert.equal(suggest(result.places, 'fixture')[0].bookmark, true);
assert.deepEqual(suggest(result.places, 'news').map(s => s.title), ['News of the day']);
assert.deepEqual(suggest(result.places, 'long read').map(s => s.url), ['https://reading.example/long'], 'titles match too');
assert.deepEqual(suggest(result.places, ''), []); assert.deepEqual(suggest(null, 'x'), []);
assert.equal(suggest(result.places, 'example', 3).length, 3, 'the limit holds');

// Refusals say what to choose.
assert.throws(() => importPlaces({ browser: 'netscape', profileDir: 'Default' }, { home }), { code: 'import_browser' });
assert.throws(() => importPlaces({ browser: 'chrome', profileDir: '../Default' }, { home }), { code: 'import_profile' });
assert.throws(() => importPlaces({ browser: 'chrome', profileDir: 'Profile 9' }, { home }), { code: 'import_profile' });
// A profile with no History still imports its bookmarks.
fs.writeFileSync(path.join(fixtureRoot, 'Profile 1', 'Bookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', name: 'Only', url: 'https://only.example/' }] } } }));
assert.deepEqual(importPlaces({ browser: 'chrome', profileDir: 'Profile 1' }, { home }).counts, { bookmarks: 1, bar: 1, history: 0, places: 1 });
fs.rmSync(home, { recursive: true, force: true });
console.log('Chrome import: sources from Local State, bar bookmarks to Favorites, history with the 1601 epoch, merged places, ranked suggestions and refusals passed.');

for (const platform of ['darwin', 'win32', 'linux']) {
  const hostHome = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chrome-host-'));
  const root = makeChromeFixture(hostHome, platform);
  const before = fs.readFileSync(path.join(root, 'Default', 'History'));
  assert.equal(listSources({ home: hostHome, platform })[0].browser, 'chrome');
  assert.deepEqual(importPlaces({ browser: 'chrome', profileDir: 'Default' }, { home: hostHome, platform }).counts, { bookmarks: 4, bar: 2, history: 3, places: 6 });
  assert.deepEqual(fs.readFileSync(path.join(root, 'Default', 'History')), before, platform + ' import leaves source bytes unchanged');
}
