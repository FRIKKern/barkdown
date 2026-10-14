import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedQuoteBackspace, quoteBackspaceContract } from './lib/quote-backspace-contract.mjs';

const rich = [{ type: 'text', text: 'rich', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.invalid' } }] }];
const before = { type: 'doc', content: [
  { type: 'paragraph', attrs: { bpId: 'previous', bpType: 'paragraph' }, content: [...structuredClone(rich), { type: 'text', text: ' end' }] },
  { type: 'blockquote', attrs: { bpId: 'quote', bpType: 'blockquote' }, content: [{ type: 'text', text: 'quoted' }] },
  { type: 'heading', attrs: { bpId: 'sibling', level: 2 }, content: [{ type: 'text', text: 'untouched' }] },
] };

test('contracts are caller-declared, never selected from observed results', () => {
  assert.equal(quoteBackspaceContract({}), 'join');
  assert.equal(quoteBackspaceContract({ BARKDOWN_PARITY_QUOTE_BACKSPACE: 'paragraph' }), 'paragraph');
  assert.throws(() => quoteBackspaceContract({ BARKDOWN_PARITY_QUOTE_BACKSPACE: 'anything' }));
});
test('current paragraph conversion preserves quote identity/content and every other node', () => {
  const original = structuredClone(before);
  const { expected, index, quoteId } = expectedQuoteBackspace(before, 'paragraph', { bpType: 'paragraph', bpParagraphSource: null, textAlign: 'left' });
  assert.equal(expected.content.length, before.content.length);
  assert.equal(expected.content[index].attrs.bpId, quoteId);
  assert.deepEqual(expected.content[index].content, before.content[index].content);
  assert.deepEqual(expected.content[0], before.content[0]);
  assert.deepEqual(expected.content[2], before.content[2]);
  assert.deepEqual(before, original);
});
test('pinned legacy join retains rich marks, links and untouched sibling identity', () => {
  const { expected } = expectedQuoteBackspace(before, 'join');
  assert.equal(expected.content.length, 2);
  assert.deepEqual(expected.content[0].content[0], rich[0]);
  assert.equal(expected.content[0].content[1].text, ' endquoted');
  assert.deepEqual(expected.content[1], before.content[2]);
});
