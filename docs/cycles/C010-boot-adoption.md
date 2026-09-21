# C010 boot lane — explicit adoption and startup ownership

Parent stage P1 remains pending. Starting commit db11eca closes C006. This lane owns main startup, userData ownership, explicit adoption/recovery UI and tests; next-cycle owns the storage transaction helper and its independent handoff. No actual library migration or shared-service changes.

Before any store writer, acquire Electron single-instance ownership and the helper's branded authority lease. Inspect transaction state before empty registry creation. Active adoption boots the verified final UUID registry; interrupted/blocked state offers explicit recovery without seeding. Rollback is explicit and offline. Keep ownership until provider/runtime shutdown. Existing older binaries must be closed because they do not implement this gate.

Helper contract: createLegacyAdoption({userData,ownership,readSecrets}).prepare(), inspect(), recover({action}). acquireAuthorityLease(userData) returns assertOwned/release. Inspect statuses none/staged/activating/active/rolled-back/blocked; active verifies final marker/root/adopted UUID without freezing legitimate future registry generations.

A separate small implementation commit corrects inherited default/reset chat width to D07's 60%, preserving saved widths. Test actual startup, saved width reload and keyboard/palette reset. Both changes receive final source capture/visual approval, with recovery UI frames added.

Current status: planned. Storage helper in progress on sibling lane; no runtime owned. Next: width correction and pure startup decision tests, then integrate helper when stable. Do not create actual userData migration fixtures outside disposable roots.

Width source checkpoint: main default, renderer fallback, CSS split and keyboard/palette resets now60; existing stored43 preserved. Actual Electron test passes startup, saved-value reload, Home reset persistence and palette label. Initial test used async page polling that raced the debounce; replaced with explicit awaited API polling. No production persistence behavior changed. Visual capture deferred to final C010 source checkpoint.
