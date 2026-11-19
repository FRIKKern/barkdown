// Markdown to Paper blocks, the ecosystem's settled answers (Barkpark task task-615ddb76309fb699): only URLs
// the reader allows become links or image links; anything else keeps its text only.
// Their home is Barkpark's from-markdown goldens (api/priv/portable_doc/goldens/from-markdown/<name>.json).
// These two are copied here word for word until task-47983e6f4ec883ed replaces them with a copy made by a sync job.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { markdownToBlocks } = require('../shared/portabledoc.js');

const goldens = {
  'unsafe-link-keeps-text': { markdown: '[click](javascript:alert(1)) and [ok](https://example.com)', blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'click and ' }, { type: 'link', href: 'https://example.com', children: [{ type: 'text', value: 'ok' }] }] }] },
  'unsafe-image-keeps-text': { markdown: '![logo](javascript:alert(1))', blocks: [{ type: 'paragraph', content: [{ type: 'text', value: 'logo' }] }] },
};

for (const [name, golden] of Object.entries(goldens)) test(name, () => assert.deepEqual(markdownToBlocks(golden.markdown), golden.blocks));
