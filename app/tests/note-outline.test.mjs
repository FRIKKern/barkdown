// A Paper note's outline (renderer/src/note-outline-model.js): headings become a nested list, the body's
// words become "1,234 words · 6 min read", and the section being read is the last heading above the top.
import test from 'node:test';
import assert from 'node:assert/strict';
import { outlineRows, headingLabel, countWords, readingMinutes, outlineSummary, currentSection, readingLine } from '../renderer/src/note-outline-model.js';

test('headings nest by level; a skipped level nests one step, not two', () => {
  const rows = outlineRows([{ level: 1, text: 'Plan' }, { level: 2, text: 'Gear' }, { level: 3, text: 'Tent' }, { level: 2, text: 'Food' }, { level: 1, text: 'After' }, { level: 3, text: 'Photos' }, { level: 4, text: 'Raw' }]);
  assert.deepEqual(rows.map(r => [r.text, r.depth]), [['Plan', 0], ['Gear', 1], ['Tent', 2], ['Food', 1], ['After', 0], ['Photos', 1], ['Raw', 2]]);
  assert.deepEqual(rows.map(r => r.index), [0, 1, 2, 3, 4, 5, 6], 'each row points at its heading');
});

test('a note that starts below its top level keeps its first headings at the left edge', () => {
  const rows = outlineRows([{ level: 3, text: 'Notes' }, { level: 2, text: 'Later' }, { level: 3, text: 'Deeper' }]);
  assert.deepEqual(rows.map(r => r.depth), [0, 0, 1]);
});

test('empty headings show as Untitled heading; whitespace collapses; text stays text', () => {
  assert.equal(headingLabel('   '), 'Untitled heading');
  assert.equal(headingLabel(' Day\n  one '), 'Day one');
  const [row] = outlineRows([{ level: 2, text: '<img src=x onerror=alert(1)>' }]);
  assert.equal(row.text, '<img src=x onerror=alert(1)>', 'the model never turns heading text into markup');
  assert.equal(outlineRows([{ level: 2, text: '' }])[0].empty, true);
  assert.deepEqual(outlineRows([]), []);
});

test('words are words: punctuation, Markdown signs and list marks do not count', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('  \n '), 0);
  assert.equal(countWords('**Bring** boots — and _read_ the guide.'), 6);
  assert.equal(countWords('- [ ] Pack\n- Book the hut\n# Trip plan'), 6);
  assert.equal(countWords("Don't stop, re-read it: 12 km by noon"), 8);
  assert.equal(countWords('Blåbær på Øvre Ålen'), 4);
});

test('reading time rounds at 230 words a minute and never says 0 min for some words', () => {
  assert.equal(readingMinutes(0), 0);
  assert.equal(readingMinutes(1), 1);
  assert.equal(readingMinutes(344), 1);
  assert.equal(readingMinutes(345), 2);
  assert.equal(readingMinutes(1234), 5);
  assert.equal(readingMinutes(1380), 6);
});

test('the footer line', () => {
  assert.deepEqual(outlineSummary(1234, 7021), { text: '1,234 words · 5 min read', title: '7,021 characters' });
  assert.deepEqual(outlineSummary(1, 4), { text: '1 word · 1 min read', title: '4 characters' });
  assert.deepEqual(outlineSummary(0, 0), { text: '0 words', title: '0 characters' });
});

test('the current section is the last heading at or above the reading line', () => {
  const tops = [0, 400, 900, 1500];
  assert.equal(currentSection(tops, 0), 0);
  assert.equal(currentSection(tops, 399), 0);
  assert.equal(currentSection(tops, 400), 1);
  assert.equal(currentSection(tops, 1000), 2);
  assert.equal(currentSection(tops, 99999), 3);
  assert.equal(currentSection([200, 600], 50), -1, 'above the first heading: none');
  assert.equal(currentSection([], 50), -1);
  assert.equal(currentSection(tops, 380, 24), 1, 'a heading just below the line counts once it is within the slack');
});

test('at the very end of a note the reading line drops so the last headings in view can be current', () => {
  assert.equal(readingLine(500, 800, 3000), 500, 'mid-note: the top of the view');
  assert.equal(readingLine(2200, 800, 3000), 2920, 'at the end: near the bottom of the view');
  assert.equal(readingLine(0, 800, 800), 0, 'a note shorter than the view: the top');
  assert.equal(currentSection([0, 1000, 2600, 2750], readingLine(2200, 800, 3000), 40), 3);
});
