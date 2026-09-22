# Paper editor dependency notices

This archive preserves the exact notices for the 49 bundled package versions in candidate upstream 54579debe. It does not change Barkdown's current a544 fallback or certify the candidate's live validation. The follow-on consumption change must include these notices with the distributed assets.

The [manifest](manifest.json) binds the committed bundle, package lock, installed package metadata and every raw notice by SHA256. Installed notice files are copied byte-for-byte. The 31 Tiptap packages omit license files from their npm package payloads; their notices come from the official release source.

Tiptap 2.27.2 npm gitHead matches the official package tags at `4b8d4e9434cdaf624d1c982f3b99f95d1359b4e1`. Tiptap 2.27.3 has no matching package tag in the observed remote. Its official npm release metadata points to `0ed4a30a6cda23799a01881f67d01ad218a2ac6d`; each retained source package.json verifies the exact package name, version and MIT license. Both revisions identify copyright 2025 Tiptap GmbH. This archive records the absent tags rather than inventing them. No notice text remains unavailable.

Primary license sources: [Tiptap 2.27.2 release commit](https://raw.githubusercontent.com/ueberdosis/tiptap/4b8d4e9434cdaf624d1c982f3b99f95d1359b4e1/LICENSE.md), [Tiptap 2.27.3 release commit](https://raw.githubusercontent.com/ueberdosis/tiptap/0ed4a30a6cda23799a01881f67d01ad218a2ac6d/LICENSE.md). Each Tiptap directory also retains source.json with the exact registry URL, release gitHead and tarball integrity.

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
| @tiptap/core | 2.27.2 | MIT | [Notice](tiptap--core@2.27.2/LICENSE.md) |
| @tiptap/extension-blockquote | 2.27.2 | MIT | [Notice](tiptap--extension-blockquote@2.27.2/LICENSE.md) |
| @tiptap/extension-bold | 2.27.2 | MIT | [Notice](tiptap--extension-bold@2.27.2/LICENSE.md) |
| @tiptap/extension-bullet-list | 2.27.2 | MIT | [Notice](tiptap--extension-bullet-list@2.27.2/LICENSE.md) |
| @tiptap/extension-code-block | 2.27.2 | MIT | [Notice](tiptap--extension-code-block@2.27.2/LICENSE.md) |
| @tiptap/extension-code | 2.27.2 | MIT | [Notice](tiptap--extension-code@2.27.2/LICENSE.md) |
| @tiptap/extension-document | 2.27.2 | MIT | [Notice](tiptap--extension-document@2.27.2/LICENSE.md) |
| @tiptap/extension-dropcursor | 2.27.2 | MIT | [Notice](tiptap--extension-dropcursor@2.27.2/LICENSE.md) |
| @tiptap/extension-gapcursor | 2.27.2 | MIT | [Notice](tiptap--extension-gapcursor@2.27.2/LICENSE.md) |
| @tiptap/extension-hard-break | 2.27.2 | MIT | [Notice](tiptap--extension-hard-break@2.27.2/LICENSE.md) |
| @tiptap/extension-heading | 2.27.2 | MIT | [Notice](tiptap--extension-heading@2.27.2/LICENSE.md) |
| @tiptap/extension-highlight | 2.27.3 | MIT | [Notice](tiptap--extension-highlight@2.27.3/LICENSE.md) |
| @tiptap/extension-history | 2.27.2 | MIT | [Notice](tiptap--extension-history@2.27.2/LICENSE.md) |
| @tiptap/extension-horizontal-rule | 2.27.2 | MIT | [Notice](tiptap--extension-horizontal-rule@2.27.2/LICENSE.md) |
| @tiptap/extension-italic | 2.27.2 | MIT | [Notice](tiptap--extension-italic@2.27.2/LICENSE.md) |
| @tiptap/extension-link | 2.27.2 | MIT | [Notice](tiptap--extension-link@2.27.2/LICENSE.md) |
| @tiptap/extension-list-item | 2.27.2 | MIT | [Notice](tiptap--extension-list-item@2.27.2/LICENSE.md) |
| @tiptap/extension-ordered-list | 2.27.2 | MIT | [Notice](tiptap--extension-ordered-list@2.27.2/LICENSE.md) |
| @tiptap/extension-paragraph | 2.27.2 | MIT | [Notice](tiptap--extension-paragraph@2.27.2/LICENSE.md) |
| @tiptap/extension-placeholder | 2.27.2 | MIT | [Notice](tiptap--extension-placeholder@2.27.2/LICENSE.md) |
| @tiptap/extension-strike | 2.27.2 | MIT | [Notice](tiptap--extension-strike@2.27.2/LICENSE.md) |
| @tiptap/extension-subscript | 2.27.3 | MIT | [Notice](tiptap--extension-subscript@2.27.3/LICENSE.md) |
| @tiptap/extension-superscript | 2.27.3 | MIT | [Notice](tiptap--extension-superscript@2.27.3/LICENSE.md) |
| @tiptap/extension-task-item | 2.27.3 | MIT | [Notice](tiptap--extension-task-item@2.27.3/LICENSE.md) |
| @tiptap/extension-task-list | 2.27.3 | MIT | [Notice](tiptap--extension-task-list@2.27.3/LICENSE.md) |
| @tiptap/extension-text-align | 2.27.3 | MIT | [Notice](tiptap--extension-text-align@2.27.3/LICENSE.md) |
| @tiptap/extension-text | 2.27.2 | MIT | [Notice](tiptap--extension-text@2.27.2/LICENSE.md) |
| @tiptap/extension-typography | 2.27.2 | MIT | [Notice](tiptap--extension-typography@2.27.2/LICENSE.md) |
| @tiptap/extension-underline | 2.27.3 | MIT | [Notice](tiptap--extension-underline@2.27.3/LICENSE.md) |
| @tiptap/pm | 2.27.2 | MIT | [Notice](tiptap--pm@2.27.2/LICENSE.md) |
| @tiptap/starter-kit | 2.27.2 | MIT | [Notice](tiptap--starter-kit@2.27.2/LICENSE.md) |
| devlop | 1.1.0 | MIT | [Notice](devlop@1.1.0/license) |
| highlight.js | 11.11.2 | BSD-3-Clause | [Notice](highlight.js@11.11.2/LICENSE) |
| highlight.js | 11.12.0 | BSD-3-Clause | [Notice](highlight.js@11.12.0/LICENSE) |
| linkifyjs | 4.3.3 | MIT | [Notice](linkifyjs@4.3.3/LICENSE) |
| lowlight | 3.3.0 | MIT | [Notice](lowlight@3.3.0/license) |
| orderedmap | 2.1.1 | MIT | [Notice](orderedmap@2.1.1/LICENSE) |
| prosemirror-commands | 1.7.1 | MIT | [Notice](prosemirror-commands@1.7.1/LICENSE) |
| prosemirror-dropcursor | 1.8.2 | MIT | [Notice](prosemirror-dropcursor@1.8.2/LICENSE) |
| prosemirror-gapcursor | 1.4.1 | MIT | [Notice](prosemirror-gapcursor@1.4.1/LICENSE) |
| prosemirror-history | 1.5.0 | MIT | [Notice](prosemirror-history@1.5.0/LICENSE) |
| prosemirror-keymap | 1.2.3 | MIT | [Notice](prosemirror-keymap@1.2.3/LICENSE) |
| prosemirror-model | 1.25.7 | MIT | [Notice](prosemirror-model@1.25.7/LICENSE) |
| prosemirror-schema-list | 1.5.1 | MIT | [Notice](prosemirror-schema-list@1.5.1/LICENSE) |
| prosemirror-state | 1.4.4 | MIT | [Notice](prosemirror-state@1.4.4/LICENSE) |
| prosemirror-transform | 1.12.0 | MIT | [Notice](prosemirror-transform@1.12.0/LICENSE) |
| prosemirror-view | 1.41.8 | MIT | [Notice](prosemirror-view@1.41.8/LICENSE) |
| rope-sequence | 1.3.4 | MIT | [Notice](rope-sequence@1.3.4/LICENSE) |
| w3c-keyname | 2.2.8 | MIT | [Notice](w3c-keyname@2.2.8/LICENSE) |
