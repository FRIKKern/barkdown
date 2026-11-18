// Daily notes (renderer/src/daily-note.js): a date becomes a title and a key in a fixed locale and time zone,
// an existing day note is found by key (moved, renamed parent) or by title, two quick presses make one note,
// and day steps cross month, year and DST edges without skipping a day.
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
// Renderer modules are browser ESM inside a CommonJS package.
const library = fs.readFileSync(new URL('../renderer/src/library-refresh.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../renderer/src/daily-note.js', import.meta.url), 'utf8').replace(/import \{[^}]*\} from '\.\/library-refresh\.js';/, library);
const { dayKey, dayTitle, shiftDay, findDayNote, findParent, createDailyNotes, PARENT_TITLE } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('a date is a local calendar key and a long title in the given locale and time zone', () => {
  const instant = new Date('2026-11-18T23:30:00Z'); // 00:30 on the 19th in Oslo, still the 18th in New York
  assert.equal(dayKey(instant, 'Europe/Oslo'), '2026-11-19');
  assert.equal(dayKey(instant, 'America/New_York'), '2026-11-18');
  assert.match(dayTitle('2026-11-18', 'en-GB'), /^Wednesday,? 18 November 2026$/);
  assert.match(dayTitle('2026-11-18', 'nb-NO'), /^onsdag 18\. november 2026$/);
});

test('day steps cross month, year, leap day and DST changes one day at a time', () => {
  assert.equal(shiftDay('2026-11-30', 1), '2026-12-01');
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDay('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftDay('2026-03-29', -1), '2026-03-28'); // Europe springs forward on the 29th
  assert.equal(shiftDay('2026-10-25', 1), '2026-10-26'); // and falls back on the 25th
  assert.throws(() => shiftDay('18.11.2026', 1));
});

const keyOf = d => 'bp:' + d.id;
test('an existing day note is found by its key wherever it moved, else by title; the parent by key after a rename', () => {
  const daily = { parent: 'bp:parent', days: { '2026-11-17': 'bp:moved' } };
  const docs = [{ id: 'parent', title: 'Journal' }, { id: 'moved', title: 'Renamed by hand' }, { id: 'loose', title: 'Wednesday 18 November 2026' }, { id: 'other', title: PARENT_TITLE }];
  assert.equal(findParent({ daily, docs, keyOf }).id, 'parent', 'a renamed parent is still the parent');
  assert.equal(findParent({ daily: { days: {} }, docs, keyOf }).id, 'other', 'without a remembered key, a placed "Daily notes" page');
  assert.equal(findDayNote({ key: '2026-11-17', title: 'Tuesday 17 November 2026', daily, docs, keyOf }).id, 'moved');
  assert.equal(findDayNote({ key: '2026-11-18', title: 'Wednesday 18 November 2026', daily, docs, keyOf }).id, 'loose', 'a day note moved out of the parent is found by title');
  assert.equal(findDayNote({ key: '2026-11-19', title: 'Thursday 19 November 2026', daily, docs, keyOf }), null);
  // A remembered key that the library no longer lists (deleted) does not count; a note that is another day's is not reused.
  assert.equal(findDayNote({ key: '2026-11-17', title: 'Renamed by hand', daily: { days: { '2026-11-17': 'bp:gone', '2026-11-16': 'bp:moved' } }, docs, keyOf }), null);
});

function fixture({ docs = [] } = {}) {
  let n = 0;
  const state = { profileId: 'A', generation: 1, pages: { roots: [], children: {} }, barkparkDocs: [...docs], settings: { barkpark: { enabled: true, local: { enabled: true } } } };
  const calls = [], errors = [], opened = [];
  const library = [...docs];
  const args = {
    state, keyOf, locale: 'en-GB',
    serialise: () => structuredClone(state),
    pages: () => state.pages,
    childrenOf: key => state.pages.children[key] || [],
    placed: key => state.pages.roots.includes(key) || Object.values(state.pages.children).some(k => k.includes(key)),
    refresh: async () => { calls.push(['refresh']); state.barkparkDocs = [...library]; return { status: 'ready', documents: [...library] }; },
    place: (key, parent, index) => { calls.push(['place', key, parent]); if (parent) (state.pages.children[parent] ||= []).splice(index ?? 99, 0, key); else state.pages.roots.push(key); },
    report: e => errors.push(e), render: () => {},
    newId: () => `00000000-0000-4000-8000-00000000000${++n}`,
    api: {
      state: { save: async value => { calls.push(['save', value.pages.daily?.creation?.requestId || null]); } },
      barkpark: { createNoteWith: async input => { calls.push(['create', input.requestId, input.title]); await new Promise(r => setTimeout(r, 5)); const note = { id: 'drafts.bd-note-' + input.requestId, title: input.title }; library.push(note); return note; } },
    },
  };
  return { state, calls, errors, opened, args, library };
}

test('two quick presses for one day make one parent and one note, and both open it', async () => {
  const f = fixture(), daily = createDailyNotes(f.args);
  const open = note => f.opened.push(note.id);
  const [a, b] = await Promise.all([daily.open('2026-11-18', { open }), daily.open('2026-11-18', { open })]);
  assert.deepEqual(f.errors, []);
  const creates = f.calls.filter(c => c[0] === 'create');
  assert.deepEqual(creates.map(c => c[2]), [PARENT_TITLE, dayTitle('2026-11-18', 'en-GB')]);
  assert.equal(a.id, b.id); assert.deepEqual(f.opened, [a.id, a.id]);
  // Each request id is saved before main is asked.
  for (const c of creates) assert(f.calls.indexOf(f.calls.find(s => s[0] === 'save' && s[1] === c[1])) < f.calls.indexOf(c), 'intent saved first');
  const parent = f.state.pages.daily.parent;
  assert.deepEqual(f.state.pages.roots, [parent]); assert.deepEqual(f.state.pages.children[parent], ['bp:' + a.id]);
  assert.equal(f.state.pages.daily.days['2026-11-18'], 'bp:' + a.id);
  assert.equal(f.state.pages.daily.creation, undefined); assert.deepEqual(f.errors, []);
});

test('a renamed parent is reused, a new past day goes in date order, and browsing a missing day creates nothing', async () => {
  const f = fixture({ docs: [{ id: 'p', title: 'My journal' }, { id: 'd17', title: 'whatever' }] });
  f.state.pages = { roots: ['bp:p'], children: { 'bp:p': ['bp:d17'] }, daily: { parent: 'bp:p', days: { '2026-11-17': 'bp:d17' } } };
  const daily = createDailyNotes(f.args);
  assert.deepEqual(await daily.open('2026-11-16', { create: false }), { missing: true, day: '2026-11-16', title: dayTitle('2026-11-16', 'en-GB') });
  assert(!f.calls.some(c => c[0] === 'create'));
  const note = await daily.open('2026-11-16');
  assert.deepEqual(f.calls.filter(c => c[0] === 'create').map(c => c[2]), [dayTitle('2026-11-16', 'en-GB')]);
  assert.deepEqual(f.state.pages.children['bp:p'], ['bp:d17', 'bp:' + note.id], 'older day after newer');
  assert.equal(daily.dayOf('bp:d17'), '2026-11-17');
});

test('a lost reply keeps the request; the next press retries the same id; a result after a profile switch is dropped', async () => {
  const f = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }] });
  f.state.pages = { roots: ['bp:p'], children: {}, daily: { parent: 'bp:p', days: {} } };
  const create = f.args.api.barkpark.createNoteWith;
  f.args.api.barkpark.createNoteWith = async input => { f.calls.push(['lost', input.requestId]); throw new Error('reply lost'); };
  const daily = createDailyNotes(f.args);
  assert.equal(await daily.open('2026-11-18'), null);
  const kept = f.state.pages.daily.creation.requestId;
  assert.match(f.errors[0], /not confirmed/);
  f.args.api.barkpark.createNoteWith = create;
  const note = await daily.open('2026-11-18');
  assert.equal(note.id, 'drafts.bd-note-' + kept, 'the retry reuses the saved request');
  assert.equal(f.calls.filter(c => c[0] === 'create').length, 1);

  const g = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }] });
  g.state.pages = { roots: ['bp:p'], children: {}, daily: { parent: 'bp:p', days: {} } };
  const before = g.state.pages;
  g.args.api.barkpark.createNoteWith = async input => { g.state.profileId = 'B'; g.state.generation++; g.state.pages = { roots: [], children: {} }; return { id: 'drafts.late', title: input.title }; };
  const opened = [];
  assert.equal(await createDailyNotes(g.args).open('2026-11-18', { open: n => opened.push(n) }), null);
  assert.deepEqual(opened, []); assert.deepEqual(g.state.pages, { roots: [], children: {} }); assert(before.daily.creation, 'the request stays with its profile');
  assert.deepEqual(g.errors, []);
});

test('without the local library, or when the library does not answer, it says why and creates nothing', async () => {
  const f = fixture(); f.state.settings.barkpark.local.enabled = false;
  assert.equal(await createDailyNotes(f.args).today(), null);
  assert.match(f.errors[0], /local library/);
  const g = fixture(); g.args.refresh = async () => ({ status: 'unavailable', error: 'down' });
  assert.equal(await createDailyNotes(g.args).today(), null);
  assert.match(g.errors[0], /unavailable/); assert(!g.calls.some(c => c[0] === 'create'));
});

test('a hidden library ("Show Barkpark papers" off) says why and keeps no request, so no second Daily notes page later', async () => {
  const f = fixture(); f.state.settings.barkpark.enabled = false;
  assert.equal(await createDailyNotes(f.args).open('2026-11-18'), null);
  assert.match(f.errors[0], /library shown/);
  assert(!f.calls.some(c => c[0] === 'save' || c[0] === 'create' || c[0] === 'refresh'));
  assert.equal(f.state.pages.daily, undefined);
});

test('a kept request is replayed only when what it would make is still missing', async () => {
  const id = '00000000-0000-4000-8000-0000000000aa';
  const f = fixture({ docs: [{ id: 'p', title: 'My journal' }, { id: 'd18', title: dayTitle('2026-11-18', 'en-GB') }] });
  f.state.pages = { roots: ['bp:p'], children: { 'bp:p': ['bp:d18'] }, daily: { parent: 'bp:p', days: {}, creation: { requestId: id, profileId: 'A', kind: 'parent', title: PARENT_TITLE, markdown: 'x' } } };
  const note = await createDailyNotes(f.args).open('2026-11-18');
  assert.equal(note.id, 'd18');
  assert(!f.calls.some(c => c[0] === 'create'), 'the existing page and day are used, nothing is made');
  assert.equal(f.state.pages.daily.parent, 'bp:p'); assert.equal(f.state.pages.daily.creation, undefined);
  assert.equal(f.state.pages.daily.days['2026-11-18'], 'bp:d18');

  const g = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }, { id: 'd17', title: 'renamed' }] });
  g.state.pages = { roots: ['bp:p'], children: {}, daily: { parent: 'bp:p', days: { '2026-11-17': 'bp:d17' }, creation: { requestId: id, profileId: 'A', kind: 'day', date: '2026-11-17', title: dayTitle('2026-11-17', 'en-GB'), markdown: '- [ ] ' } } };
  await createDailyNotes(g.args).open('2026-11-18');
  assert.deepEqual(g.calls.filter(c => c[0] === 'create').map(c => c[2]), [dayTitle('2026-11-18', 'en-GB')], 'only the pressed day is made');
});

test('a request main refused for good is dropped with a clear message, so the next press can start again', async () => {
  const f = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }] });
  f.state.pages = { roots: ['bp:p'], children: {}, daily: { parent: 'bp:p', days: {} } };
  const create = f.args.api.barkpark.createNoteWith;
  // As it arrives across the context bridge: the message only, "[code] text" (preload.js); no .code.
  f.args.api.barkpark.createNoteWith = async () => { throw new Error('[draft_identity] The server refused this creation.'); };
  const daily = createDailyNotes(f.args);
  assert.equal(await daily.open('2026-11-18'), null);
  assert.equal(f.state.pages.daily.creation, undefined, 'not kept');
  assert.match(f.errors[0], /refused, so that request was dropped/);
  f.args.api.barkpark.createNoteWith = create;
  const note = await daily.open('2026-11-18');
  assert(note && f.calls.some(c => c[0] === 'create'), 'the next press makes the note');
});

test('after a create, an unanswered refresh does not claim that nothing was created', async () => {
  const f = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }] });
  f.state.pages = { roots: ['bp:p'], children: {}, daily: { parent: 'bp:p', days: {} } };
  const refresh = f.args.refresh; let n = 0;
  f.args.refresh = async () => (++n === 1 ? refresh() : { status: 'unavailable', error: 'down' });
  await createDailyNotes(f.args).open('2026-11-18');
  assert(f.calls.some(c => c[0] === 'create'));
  assert.match(f.errors[0], /unavailable/); assert.doesNotMatch(f.errors[0], /Nothing was created/);
});

test('a kept day request whose note main already made gets that note its Pages row under Daily notes', async () => {
  const id = '00000000-0000-4000-8000-0000000000bb', title = dayTitle('2026-11-19', 'en-GB');
  const f = fixture({ docs: [{ id: 'p', title: PARENT_TITLE }, { id: 'd18', title: 'x' }, { id: 'drafts.bd-note-' + id, title }] });
  f.state.pages = { roots: ['bp:p'], children: { 'bp:p': ['bp:d18'] }, daily: { parent: 'bp:p', days: { '2026-11-18': 'bp:d18' }, creation: { requestId: id, profileId: 'A', kind: 'day', date: '2026-11-19', title, markdown: '- [ ] ', parent: 'bp:p' } } };
  await createDailyNotes(f.args).open('2026-11-18');
  assert(!f.calls.some(c => c[0] === 'create'));
  assert.deepEqual(f.state.pages.children['bp:p'], ['bp:drafts.bd-note-' + id, 'bp:d18'], 'placed under Daily notes, newest first');
  assert.equal(f.state.pages.daily.days['2026-11-19'], 'bp:drafts.bd-note-' + id);
});
