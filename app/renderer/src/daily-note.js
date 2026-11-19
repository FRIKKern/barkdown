import { libraryScope } from './library-refresh.js';
import { refusedForGood, errorText } from '../../shared/error-code.js';

// Daily notes: one Paper note per local date, titled with the date in the person's long form, under a
// "Daily notes" page in Pages. Pages state (per profile) remembers the parent's key and each day's note key
// (`pages.daily = { parent, days: { 'YYYY-MM-DD': key }, creation }`), so a renamed or moved parent or day
// note is found by key, not by title. Creation keeps New page's rules (note-creation.js): the request is saved
// before main is asked and a retry reuses it; presses run one after another, so two quick presses make one
// note and both open it; a result after a profile or library switch is dropped.
const REQUEST = /^[a-f0-9-]{36}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;
export const PARENT_TITLE = 'Daily notes';
const PARENT_BODY = 'One note a day. Quick open › Today’s note opens today’s.';
export const DAY_TEMPLATE = '- [ ] ';

// Why daily notes can't run now, or null. A hidden library ("Show Barkpark papers" off) lists nothing, so a
// press then would make a second Daily notes page; it waits instead.
export function dailyUnavailable(state) {
  const b = state?.settings?.barkpark;
  if (!state?.profileId || !b?.local?.enabled) return 'Daily notes need this profile’s local library. Turn it on in Settings › Barkpark.';
  if (!b.enabled) return 'Daily notes need the library shown. Turn on “Show Barkpark papers in the library” in Settings › Barkpark.';
  return null;
}

// The local calendar date of `date` (in `timeZone`, or the machine's when omitted), as YYYY-MM-DD.
export function dayKey(date = new Date(), timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
// Day arithmetic on the calendar key itself (noon UTC), so a DST change never skips or repeats a day.
const noon = key => { if (!DAY.test(key || '')) throw new TypeError('A day is YYYY-MM-DD'); const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)); };
export function shiftDay(key, days) { const t = noon(key); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }
export function dayTitle(key, locale) {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(noon(key));
}

function dailyOf(tree) {
  const d = tree.daily;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return (tree.daily = { parent: null, days: {} });
  if (!d.days || typeof d.days !== 'object' || Array.isArray(d.days)) d.days = {};
  return d;
}
// The day a note is the daily note of, from Pages state; null for any other note.
export function dayOfNote(tree, noteKey) {
  const days = tree?.daily?.days;
  if (!days || typeof days !== 'object') return null;
  for (const [day, key] of Object.entries(days)) if (key === noteKey && DAY.test(day)) return day;
  return null;
}
// The "Daily notes" page: by its remembered key first (it may be renamed or moved), then a placed note with that title.
export function findParent({ daily, docs, keyOf, placed = () => true }) {
  if (daily?.parent) { const kept = docs.find(d => keyOf(d) === daily.parent); if (kept) return kept; }
  return docs.find(d => d.title === PARENT_TITLE && placed(keyOf(d))) || null;
}
// A day's note: by its remembered key, else a note titled with that date (under the parent first, then anywhere,
// as the person may have moved it) that is not already another day's note.
export function findDayNote({ key, title, daily, docs, keyOf, childrenOf = () => [] }) {
  const mapped = daily?.days?.[key];
  if (mapped) { const kept = docs.find(d => keyOf(d) === mapped); if (kept) return kept; }
  const taken = new Set(Object.entries(daily?.days || {}).filter(([day]) => day !== key).map(([, k]) => k));
  const named = docs.filter(d => d.title === title && !taken.has(keyOf(d)));
  const under = new Set(daily?.parent ? childrenOf(daily.parent) : []);
  return named.find(d => under.has(keyOf(d))) || named[0] || null;
}
// Where a new day goes among the parent's children: newest first, other pages keep their place.
export function insertIndex(children, tree, key) {
  const i = children.findIndex(child => { const day = dayOfNote(tree, child); return day && day < key; });
  return i < 0 ? children.length : i;
}

export function createDailyNotes({ state, api, serialise, pages, refresh, keyOf, place, report, render, childrenOf = () => [], placed = () => true,
  newId = () => crypto.randomUUID(), locale = undefined }) {
  let chain = Promise.resolve();
  const unlisted = new Map(); // notes this action made that no listing has shown yet: key -> { scope, note }
  async function send(tree, daily, intent, current) {
    if (intent.profileId !== state.profileId || !REQUEST.test(intent.requestId || '') || !['parent', 'day'].includes(intent.kind)
      || typeof intent.title !== 'string' || typeof intent.markdown !== 'string' || (intent.kind === 'day' && !DAY.test(intent.date || ''))) {
      throw Object.assign(new Error('The previous daily-note request belongs to another profile.'), { code: 'draft_identity' });
    }
    const note = await api.barkpark.createNoteWith({ requestId: intent.requestId, title: intent.title, markdown: intent.markdown });
    if (!current()) return null;
    const key = keyOf(note);
    if (!state.barkparkDocs.some(d => keyOf(d) === key)) state.barkparkDocs.push(note);
    unlisted.set(key, { scope: libraryScope(state), note });
    if (intent.kind === 'parent') { daily.parent = key; place(key, null, null); }
    else {
      daily.days[intent.date] = key;
      const parent = daily.parent || intent.parent || null;
      place(key, parent, parent ? insertIndex(childrenOf(parent), tree, intent.date) : null);
    }
    delete daily.creation;
    try { await api.state.save(serialise()); }
    catch (error) { daily.creation = intent; throw error; }
    return note;
  }
  async function step(day, create, open) {
    const why = dailyUnavailable(state);
    if (why) { report(why); return null; }
    if (!DAY.test(day || '')) throw new TypeError('A day is YYYY-MM-DD');
    const scope = libraryScope(state), tree = pages();
    const current = () => scope === libraryScope(state) && tree === state.pages;
    const daily = dailyOf(tree), title = dayTitle(day, locale);
    let made = false;
    try {
      // At most: a kept request (or dropping it), the parent, the day, then the read that finds it.
      for (let round = 0; round < 6; round++) {
        let receipt; // a refresh another caller started meanwhile supersedes ours; ask again
        for (let i = 0; i < 3 && (!receipt || receipt.status === 'superseded'); i++) { receipt = await refresh(); if (!current()) return null; }
        if (receipt?.status !== 'ready') throw new Error(`The library is unavailable, so the daily note was not checked.${made ? '' : ' Nothing was created.'}`);
        const listed = new Set(receipt.documents.map(keyOf));
        for (const [key, kept] of unlisted) if (listed.has(key) || kept.scope !== scope) unlisted.delete(key);
        const docs = [...receipt.documents, ...[...unlisted.values()].map(k => k.note)];
        const parent = findParent({ daily, docs, keyOf, placed });
        if (parent && daily.parent !== keyOf(parent)) daily.parent = keyOf(parent);
        // A kept request is replayed only when what it would make is still missing: look first, so a request
        // kept while the library was unreadable never makes a second Daily notes page or a second day note.
        const kept = daily.creation;
        if (kept) {
          const there = kept.kind === 'parent' ? parent
            : DAY.test(kept.date || '') && findDayNote({ key: kept.date, title: kept.title, daily, docs, keyOf, childrenOf });
          if (there) {
            if (kept.kind === 'day') {
              // Main may have made this very note before its answer was lost: give it the Pages row the replay would have.
              daily.days[kept.date] = keyOf(there);
              const home = daily.parent || kept.parent || null;
              if (!placed(keyOf(there))) place(keyOf(there), home, home ? insertIndex(childrenOf(home), tree, kept.date) : null);
            }
            delete daily.creation;
            await api.state.save(serialise());
            if (!current()) return null;
            continue;
          }
          made = true;
          await send(tree, daily, kept, current); if (!current()) return null; continue;
        }
        const found = findDayNote({ key: day, title, daily, docs, keyOf, childrenOf });
        if (found) {
          if (daily.days[day] !== keyOf(found)) { daily.days[day] = keyOf(found); await api.state.save(serialise()); if (!current()) return null; }
          open(found);
          return found;
        }
        if (!create) return { missing: true, day, title };
        daily.creation = parent
          ? { requestId: newId(), profileId: state.profileId, kind: 'day', date: day, title, markdown: DAY_TEMPLATE, parent: keyOf(parent) }
          : { requestId: newId(), profileId: state.profileId, kind: 'parent', title: PARENT_TITLE, markdown: PARENT_BODY };
        try { await api.state.save(serialise()); }
        catch (error) { delete daily.creation; throw error; }
        if (!current()) return null;
        render();
        made = true;
        await send(tree, daily, daily.creation, current);
        if (!current()) return null;
      }
      throw new Error('The daily note did not settle. Press again to check it.');
    } catch (error) {
      if (!current()) return null;
      const kept = daily.creation;
      if (kept && refusedForGood(error)) {
        delete daily.creation;
        try { await api.state.save(serialise()); } catch {}
        if (!current()) return null;
        report(`${kept.kind === 'parent' ? 'Making the Daily notes page' : `Making the note for ${kept.title}`} was refused, so that request was dropped. Press again to try anew. ${errorText(error)}`);
        return null;
      }
      report(daily.creation ? `${daily.creation.kind === 'parent' ? 'The Daily notes page' : `The note for ${daily.creation.title}`} is not confirmed. Press again to check the same note. ${error.message}` : error.message);
      return null;
    } finally { if (current()) render(); }
  }
  // open(day, { create, open }) runs after any earlier press has settled.
  const run = (day, { create = true, open = () => {} } = {}) => { const next = chain.then(() => step(day, create, open)); chain = next.catch(() => {}); return next; };
  return {
    open: run,
    today: options => run(dayKey(new Date()), options),
    dayOf: noteKey => dayOfNote(state.pages, noteKey),
    title: day => dayTitle(day, locale),
    // Browsing past days never creates: this only reads what the last listing showed.
    known: day => findDayNote({ key: day, title: dayTitle(day, locale), daily: state.pages?.daily, docs: state.barkparkDocs, keyOf, childrenOf }),
  };
}

// "‹ Previous day · Next day ›" for a daily note's path bar. A missing day says so and offers Create;
// stepping keeps going from that day. `go(note)` opens a note in this tab.
export function dayNav(daily, day, go) {
  const nav = document.createElement('div');
  nav.className = 'bw-daily-nav';
  nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', 'Daily notes');
  let cursor = day;
  const button = (label, act) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.day = act; return b; };
  const prev = button('‹ Previous day', 'prev'), next = button('Next day ›', 'next');
  const missing = document.createElement('span'); missing.className = 'bw-daily-missing'; missing.hidden = true; missing.setAttribute('role', 'status');
  const label = document.createElement('span'), create = button('Create', 'create');
  missing.append(label, create);
  const titles = () => { prev.title = 'Previous day: ' + daily.title(shiftDay(cursor, -1)); next.title = 'Next day: ' + daily.title(shiftDay(cursor, 1)); };
  const step = n => {
    cursor = shiftDay(cursor, n); titles();
    if (cursor === day) { missing.hidden = true; return; }
    const note = daily.known(cursor);
    if (note) return go(note);
    label.textContent = `No note for ${daily.title(cursor)} · `; missing.hidden = false;
  };
  prev.onclick = () => step(-1); next.onclick = () => step(1);
  create.onclick = async () => { create.disabled = true; try { await daily.open(cursor, { create: true, open: go }); } finally { create.disabled = false; } };
  titles();
  nav.append(prev, next, missing);
  return nav;
}
