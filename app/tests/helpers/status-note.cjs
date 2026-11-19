// The showcase note the status screenshots publish (app/tests/status-shots.mjs): the blocks an author reaches
// for daily, so the picture shows the canvas doing real work. scripts/demo-names.cjs imports this same module
// and judges its quote attributions, so the guard reads the very note the pictures show. The attribution comes
// from the one frozen demo identity, and the note is frozen too, so an importer cannot rewrite it.
const demo = require('../../../scripts/demo-identity.cjs');

const SLUG = 'barkdown-status';
const text = value => [{ type: 'text', value }];
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

const statusNote = freeze({
  slug: SLUG, title: 'Status: what the canvas does today', description: 'The showcase note the README pictures are taken from: a heading, a paragraph, a plain quote, a checklist, a table, a callout and a code block, all edited in the Barkpark canvas inside Barkdown. Rewritten by tests/status-shots.mjs.', tags: [{ tag: 'barkdown', strength: 95, rationale: 'the README showcase note' }, { tag: 'scratch', strength: 35, rationale: 'rewritten on every capture' }], blocks: [
  { type: 'heading', level: 1, text: 'Status: what the canvas does today' },
  { type: 'paragraph', content: text('A note in Barkdown is a Barkpark paper. This one is edited in Barkpark’s own canvas, against a local Barkpark, and every edit lands on the server as an op.') },
  { type: 'blockquote', content: text('Barkdown is a note + agent app, utilizing Barkpark.'), cite: `${demo.quoteSource}, 2026-09-20` },
  { type: 'heading', level: 2, text: 'Editor parity rows' },
  { type: 'list', task: true, items: [{ content: text('Row 10 — tables: 11/11'), checked: true }, { content: text('Row 11 — multi-block edits across the ops round trip: 11/11'), checked: true }, { content: text('Table header columns and cell alignment: 6/6'), checked: true }] },
  { type: 'table', headCol: true, head: [text('Row'), text('Score'), text('Fixed in')], rows: [[text('Tables'), text('11/11'), text('Barkpark table-node, markdown.js')], [text('Multi-block'), text('11/11'), text('canvas seam, paper.js')], [text('Header and alignment'), { content: text('6/6'), align: 'right' }, text('canvas, reader and BPML')]] },
  { type: 'callout', tone: 'info', content: text('Every row goes green only by a live test that compares the canvas with the server.') },
  { type: 'code', lang: 'sh', value: 'cd app && npm run test:tables' },
] });

// The one way status-shots publishes the note: it hands over its bp(args, input) runner and never builds the
// command or the note itself (scripts/demo-names.test.cjs checks that wiring).
const publishStatusNote = bp => bp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify(statusNote));

module.exports = Object.freeze({ SLUG, statusNote, publishStatusNote });
