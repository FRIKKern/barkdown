// A Chrome profile as Chrome 154 lays one out, for the import tests and the browser tour: Local State
// names the profiles, Bookmarks is JSON, History is SQLite with times in microseconds since 1601.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
export const EPOCH_1601_SECONDS = 11644473600;
export function makeChromeFixture(home, platform = process.platform) {
  const root = platform === 'win32' ? path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
    : platform === 'linux' ? path.join(home, '.config', 'google-chrome')
    : path.join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  fs.mkdirSync(path.join(root, 'Default'), { recursive: true }); fs.mkdirSync(path.join(root, 'Profile 1'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Person 1' }, 'Profile 1': { name: 'Work desk' }, 'Profile 9': { name: 'Gone' } } } }));
  const url = (name, href) => ({ type: 'url', name, url: href });
  fs.writeFileSync(path.join(root, 'Default', 'Bookmarks'), JSON.stringify({ version: 1, roots: {
    bookmark_bar: { type: 'folder', name: 'Bookmarks bar', children: [url('Barkpark docs', 'https://docs.barkpark.cloud/'), url('Fixture home', 'https://fixture.example/'), { type: 'folder', name: 'Reading', children: [url('Long read', 'https://reading.example/long'), url('Bad', 'javascript:alert(1)')] }] },
    other: { type: 'folder', name: 'Other bookmarks', children: [url('Elsewhere', 'https://other.example/x')] },
    synced: { type: 'folder', name: 'Mobile bookmarks', children: [] } } }));
  const db = new DatabaseSync(path.join(root, 'Default', 'History'));
  db.exec('create table urls(id integer primary key, url longvarchar, title longvarchar, visit_count integer default 0, typed_count integer default 0, last_visit_time integer, hidden integer default 0)');
  const insert = db.prepare('insert into urls(url, title, visit_count, typed_count, last_visit_time, hidden) values (?, ?, ?, ?, ?, ?)');
  const at = seconds => BigInt(seconds + EPOCH_1601_SECONDS) * 1000000n;
  insert.run('https://fixture.example/', 'Fixture home', 40, 12, at(1790000000), 0);
  insert.run('https://fixture.example/pricing', 'Fixture pricing', 3, 0, at(1789000000), 0);
  insert.run('https://news.example/today', 'News of the day', 9, 1, at(1790100000), 0);
  insert.run('https://hidden.example/', 'Hidden', 99, 9, at(1790100000), 1);
  insert.run('chrome://settings/', 'Settings', 50, 50, at(1790100000), 0);
  db.close();
  return root;
}
