# Paper editor dependency notices

This archive preserves the exact notices for the 45 bundled package versions of the paper editor at upstream `944a57a1e`, the Barkpark commit Barkdown is pinned to (`app/BARKPARK_REF`). The same files ship beside the bundle in `app/renderer/vendor/paper-editor-notices`.

The [manifest](manifest.json) binds the committed bundle, the package lock, the installed package metadata and every raw notice by SHA256. Every notice here was copied byte-for-byte from the locked installed package: the 27 Tiptap packages are at 3.31.4 and ship their own license files, so nothing had to be fetched from a release commit this time. Earlier pins needed that for Tiptap 2; their notices are in git history.

## Reproduction

Run against an isolated upstream checkout at the recorded commit with locked editor dependencies installed:

```powershell
node scripts/editor-notices.mjs C:/path/to/isolated-barkpark
node scripts/editor-notices.mjs C:/path/to/isolated-barkpark --verify
```

Generation uses esbuild write:false and refuses a generated bundle that differs from the committed bytes. It reads official metadata only for notices missing from the installed package. It refuses to overwrite different retained notice text. Verification is offline: all 49 versions, installed metadata, source lock, bundle and notice/provenance hashes must match. No source/build files in the upstream checkout are modified.

## Retained texts

| Package | Version | License | Exact notice |
|---|---|---|---|
| @tiptap/core | 3.31.4 | MIT | [Notice](tiptap--core@3.31.4/LICENSE.md) |
| @tiptap/extension-blockquote | 3.31.4 | MIT | [Notice](tiptap--extension-blockquote@3.31.4/LICENSE.md) |
| @tiptap/extension-bold | 3.31.4 | MIT | [Notice](tiptap--extension-bold@3.31.4/LICENSE.md) |
| @tiptap/extension-code | 3.31.4 | MIT | [Notice](tiptap--extension-code@3.31.4/LICENSE.md) |
| @tiptap/extension-code-block | 3.31.4 | MIT | [Notice](tiptap--extension-code-block@3.31.4/LICENSE.md) |
| @tiptap/extension-document | 3.31.4 | MIT | [Notice](tiptap--extension-document@3.31.4/LICENSE.md) |
| @tiptap/extension-hard-break | 3.31.4 | MIT | [Notice](tiptap--extension-hard-break@3.31.4/LICENSE.md) |
| @tiptap/extension-heading | 3.31.4 | MIT | [Notice](tiptap--extension-heading@3.31.4/LICENSE.md) |
| @tiptap/extension-highlight | 3.31.4 | MIT | [Notice](tiptap--extension-highlight@3.31.4/LICENSE.md) |
| @tiptap/extension-horizontal-rule | 3.31.4 | MIT | [Notice](tiptap--extension-horizontal-rule@3.31.4/LICENSE.md) |
| @tiptap/extension-italic | 3.31.4 | MIT | [Notice](tiptap--extension-italic@3.31.4/LICENSE.md) |
| @tiptap/extension-link | 3.31.4 | MIT | [Notice](tiptap--extension-link@3.31.4/LICENSE.md) |
| @tiptap/extension-list | 3.31.4 | MIT | [Notice](tiptap--extension-list@3.31.4/LICENSE.md) |
| @tiptap/extension-paragraph | 3.31.4 | MIT | [Notice](tiptap--extension-paragraph@3.31.4/LICENSE.md) |
| @tiptap/extension-placeholder | 3.31.4 | MIT | [Notice](tiptap--extension-placeholder@3.31.4/LICENSE.md) |
| @tiptap/extension-strike | 3.31.4 | MIT | [Notice](tiptap--extension-strike@3.31.4/LICENSE.md) |
| @tiptap/extension-subscript | 3.31.4 | MIT | [Notice](tiptap--extension-subscript@3.31.4/LICENSE.md) |
| @tiptap/extension-superscript | 3.31.4 | MIT | [Notice](tiptap--extension-superscript@3.31.4/LICENSE.md) |
| @tiptap/extension-task-item | 3.31.4 | MIT | [Notice](tiptap--extension-task-item@3.31.4/LICENSE.md) |
| @tiptap/extension-task-list | 3.31.4 | MIT | [Notice](tiptap--extension-task-list@3.31.4/LICENSE.md) |
| @tiptap/extension-text | 3.31.4 | MIT | [Notice](tiptap--extension-text@3.31.4/LICENSE.md) |
| @tiptap/extension-text-align | 3.31.4 | MIT | [Notice](tiptap--extension-text-align@3.31.4/LICENSE.md) |
| @tiptap/extension-typography | 3.31.4 | MIT | [Notice](tiptap--extension-typography@3.31.4/LICENSE.md) |
| @tiptap/extension-underline | 3.31.4 | MIT | [Notice](tiptap--extension-underline@3.31.4/LICENSE.md) |
| @tiptap/extensions | 3.31.4 | MIT | [Notice](tiptap--extensions@3.31.4/LICENSE.md) |
| @tiptap/pm | 3.31.4 | MIT | [Notice](tiptap--pm@3.31.4/LICENSE) |
| @tiptap/starter-kit | 3.31.4 | MIT | [Notice](tiptap--starter-kit@3.31.4/LICENSE.md) |
| devlop | 1.1.0 | MIT | [Notice](devlop@1.1.0/license) |
| highlight.js | 11.11.2 | BSD-3-Clause | [Notice](highlight.js@11.11.2/LICENSE) |
| highlight.js | 11.12.0 | BSD-3-Clause | [Notice](highlight.js@11.12.0/LICENSE) |
| linkifyjs | 4.3.3 | MIT | [Notice](linkifyjs@4.3.3/LICENSE) |
| lowlight | 3.3.0 | MIT | [Notice](lowlight@3.3.0/license) |
| orderedmap | 2.1.1 | MIT | [Notice](orderedmap@2.1.1/LICENSE) |
| prosemirror-commands | 1.7.2 | MIT | [Notice](prosemirror-commands@1.7.2/LICENSE) |
| prosemirror-dropcursor | 1.8.2 | MIT | [Notice](prosemirror-dropcursor@1.8.2/LICENSE) |
| prosemirror-gapcursor | 1.4.1 | MIT | [Notice](prosemirror-gapcursor@1.4.1/LICENSE) |
| prosemirror-history | 1.5.1 | MIT | [Notice](prosemirror-history@1.5.1/LICENSE) |
| prosemirror-keymap | 1.2.3 | MIT | [Notice](prosemirror-keymap@1.2.3/LICENSE) |
| prosemirror-model | 1.25.12 | MIT | [Notice](prosemirror-model@1.25.12/LICENSE) |
| prosemirror-schema-list | 1.5.1 | MIT | [Notice](prosemirror-schema-list@1.5.1/LICENSE) |
| prosemirror-state | 1.4.4 | MIT | [Notice](prosemirror-state@1.4.4/LICENSE) |
| prosemirror-transform | 1.12.0 | MIT | [Notice](prosemirror-transform@1.12.0/LICENSE) |
| prosemirror-view | 1.42.6 | MIT | [Notice](prosemirror-view@1.42.6/LICENSE) |
| rope-sequence | 1.3.4 | MIT | [Notice](rope-sequence@1.3.4/LICENSE) |
| w3c-keyname | 2.2.8 | MIT | [Notice](w3c-keyname@2.2.8/LICENSE) |
