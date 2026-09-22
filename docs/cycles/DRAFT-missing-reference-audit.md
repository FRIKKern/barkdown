# Missing references — read-only A1 audit

Audited integration ece4626; no production edits or Electron/provider/runtime launch. Separate from C025 cache integrity.

## Concrete adapter reproduction

[Original report](evidence/C025-cache/deferred-missing-reference-audit.json), disposable r3kG4y. Existing B draft and one missing image reference were persisted. Replayed the actual composer/sendMessage ordering: clear draft/images, save optimistic user/reply view, then service.start. Repository saveView deliberately does not accept renderer message authority. validateImages throws ENOENT before begin can reserve the durable user message. Reload shows empty draft, no images and zero messages; injected agent dispatched zero times. The renderer currently displays an optimistic failed message until reload, but cannot durably retain it. This is a concrete adapter-level preservation failure, not yet actual Electron reproduction.

## Already supported or proven narrowly

- B local document JSON renamed away while A has identical slug: B.get returns null and A content remains unchanged. Local document UI explicitly reports no longer exists; actual selected-B restart UI with same-slug A not newly tested.
- Production Paper HTTP adapter with controlled fetch404 calls only B /v1/data/doc/production/paper/same-slug?perspective=raw and throws status404, no other origin request. This is adapter proof, not actual server/UI proof. Paper host code retains existing mounted owner on failed navigation and shows an error for initial failure; prior24 host regressions exercise controlled transport ownership.
- Profile service image validation realpaths under owning profile attachments before reservation. Existing profile-service test covers missing foreign image path, not an existing same-name A image or restored missing image UI.
- Selected B missing chat folder is preserved exactly by scope resolution; it does not substitute A. Claude/Codex receive captured cwd/workingDirectory; API file tools capture same context. None of resolve checks folder existence; actual missing-folder SDK failure and clear usable UX remain unproved. Whole-workspace C012 does not establish these cases.

## Required bounded follow-up proof

Actual Electron: persisted B draft+attachment, remove only B attachment while A owns same name, attempt send, restart; preserve exact prompt/references and present explicit missing-image recovery without dispatch. Also test rejection while user types a newer draft and runtime-acquisition failure before reservation. Avoid restoring old draft over newer input. Test reference removal after validation but before provider image read: API/Claude imageBlocks currently skips unreadable paths, while Codex delegates local_image; do not claim consistent provider behavior.

Missing folder: restart selected B with folder removed, open project tree/file, send location question and explicit filesystem request through each owned provider; verify captured path, truthful error and no A/scratch substitution. Missing Paper: real B404 while A has same slug, restart/open initial and navigate from dirty paper; assert no cross-owner fallback and preserved human edit. Attachment thumbnails currently use stored URLs directly and show native missing image; actionable recovery must be observed, not inferred.
