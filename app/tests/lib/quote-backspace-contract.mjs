import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

export function quoteBackspaceContract(env) {
  const contract = env.BARKDOWN_PARITY_QUOTE_BACKSPACE || 'join';
  assert.ok(['join', 'paragraph'].includes(contract), 'Unknown declared quote Backspace contract');
  return contract;
}

export function expectedQuoteBackspace(before, contract, paragraphAttrs) {
  assert.ok(['join', 'paragraph'].includes(contract));
  const expected = structuredClone(before);
  const text = node => node.text || (node.content || []).map(text).join('');
  const index = expected.content.findIndex(node => node.type === 'blockquote' && text(node) === 'quoted');
  assert.ok(index > 0, 'Fixture quote and preceding sibling must exist');
  const quote = expected.content[index];
  if (contract === 'paragraph') {
    assert.ok(paragraphAttrs && paragraphAttrs.bpType === 'paragraph', 'Paragraph schema defaults required');
    expected.content[index] = {
      type: 'paragraph', attrs: { ...paragraphAttrs, bpId: quote.attrs.bpId }, content: quote.content,
    };
  } else {
    const previous = expected.content[index - 1];
    assert.equal(previous.type, 'paragraph');
    for (const inline of quote.content || []) {
      const last = previous.content.at(-1);
      if (last?.type === 'text' && inline.type === 'text' && isDeepStrictEqual(last.marks || [], inline.marks || [])) last.text += inline.text;
      else previous.content.push(inline);
    }
    expected.content.splice(index, 1);
  }
  return { expected, index, quoteId: quote.attrs.bpId };
}
