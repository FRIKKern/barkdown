# Dependency health audit and proposed runtime cycle

Read-only checkpoint, 22 September 2026, source92f07c0. No dependency, lockfile, integration or application behavior changed; no Electron/runtime launched. This is a proposed cycle, not an active queue replacement or security clearance.

## Recorded result

[Audit JSON](evidence/dependency-health/audit.json) reports two high-severity package aggregates: Electron38.8.6 and extract-zip2.0.1. There are19 individual Electron advisories and two extract-zip advisories; two aggregates does not mean only two issues. [Provenance](evidence/dependency-health/provenance.json) binds the exact lock and command outputs. npm audit exited1 as expected. The isolated checkout has no installed dependencies, so its first npm explain failed; that failure is retained. A read-only query of the installed integration tree and the lock both establish electron -> extract-zip as the sole recorded path. No npm audit fix or install was run.

Electron is a devDependency but its binary is the application's runtime. Dev-only audit omission would hide its shipped risk. extract-zip is used in the Electron npm installer, which downloads a binary archive with checksums then extracts it; no app document-import use was found. The advisory needs a malicious archive; default checksum verification reduces one entry path but is not evidence of absence of supply-chain/cache/mirror compromise. No packaged artifact was inspected, so dependency exclusion in the shipped artifact remains unproved.

## Actual surfaces, not exploit claims

| Advisory family | Inspected application surface / limit |
|---|---|
| Context isolation and contextBridge prototype handling | main/main.js129 uses contextIsolation:true but sandbox:false; main/preload.js exposes Promise-returning invoke wrappers. The [upstream isolation advisory](https://github.com/electron/electron/security/advisories/GHSA-h7rp-cf8h-j98x) specifically applies to this API pattern when untrusted code reaches that renderer. Main loads a local HTML shell, not a remote webpage. However the connected Paper JS bundle executes in this same renderer (renderer/src/canvas-bundle.js); its hashes establish integrity, not publisher trust. No exploit or HTML-to-code path was attempted/proven. |
| shell.openPath null validation | main/main.js241 forwards renderer-supplied path directly to shell.openPath. Sender/frame checks exist; no explicit NUL validation here. The [official advisory](https://github.com/electron/electron/security/advisories/GHSA-5c9j-mhmv-5xgx) names this exact API. Reachability exists, malicious execution was not tested. |
| Popup targets/options, sandboxed iframe popups/external protocols, redirects and native popup positioning | Website tabs intentionally render remote pages. main.js138-146 enforces sandbox/no Node/no preload and per-profile partition. Window creation is denied, but guest popup callback calls contents.loadURL(url) without the address bar's HTTP(S) normalization. This is a concrete routing surface to test, not a proven advisory bypass. Main popup callback restricts external open to HTTP(S). |
| Permission origin | App and website sessions install permission-request handlers for clipboard-read/fullscreen; no setPermissionCheckHandler call found. This does not establish the origin-confusion advisory's exact precondition, nor prove general permission isolation. |
| DevTools | --dev opens DevTools; development attack surface exists. No custom DevTools embedder handler found. |
| Offscreen child paint/shared textures/GPU geometry; extension tabs; custom protocol CORS | No offscreen option, shared texture API, extension loading, or custom protocol registration found in app/main. Listed vulnerable code ships in Electron, but these feature prerequisites were not observed. |
| clipboard.readImage; parent code-sign check | No Electron clipboard API call found in app production code; DOM clipboard events/browser APIs are distinct. Parent signing advisory is not proof of a Windows exploit; no signing/parent-validation feature is implemented here. |

Review the full advisory list in retained audit JSON; this source inventory neither suppresses advisories nor claims exhaustive exploit analysis.

## Supported candidates and migration boundary

The official [schedule](https://releases.electronjs.org/schedule) lists38 EOL10 March2026. On this audit date supported stable majors are42/43/44:42 ends20 October2026,43 ends5 January2027,44 ends2 March2027. Release metadata confirms [42.11.6](https://releases.electronjs.org/release/v42.11.6), [43.7.3](https://releases.electronjs.org/release/v43.7.3), and [44.4.3](https://releases.electronjs.org/release/v44.4.3). These are candidates, not validated app upgrades. npm recommends44.4.3; that recommendation is not a compatibility test.

Registry metadata retained for all three uses @electron-internal/extract-zip rather than extract-zip2.0.1. No candidate lock was resolved or audited; transitive vulnerability absence is unproved. All require external Node >=22.12, consistent with app's >=22.13.1, while embedded Node moves to24.

[Official breaking changes](https://www.electronjs.org/docs/latest/breaking-changes):42 moves binary installation from postinstall to on-demand/explicit installer;41 changes PDF guest behavior;43 changes default file-dialog directory;44 removes old Electron clipboard APIs in favor of asynchronous ClipboardItem operations, removes32-bit platforms and macOS12, and statically links ANGLE. Our tests pass require('electron') directly to Playwright, so clean-ci binary availability must be proven. No direct Electron clipboard call was found, so44's change is a verification concern, not an established code blocker. DOM/native paste and image fidelity still require actual tests.

Recommendation: trial exact44.4.3 first in an isolated cycle for the longest supported runway; choose43.7.3 only if a concrete44 incompatibility cannot be resolved narrowly.42.11.6 is the smallest supported major jump but has less than a month of support remaining, making it a short-lived contingency rather than the preferred landing target. Do not change website security policy and Electron version in one unreviewable patch.

## Proposed bounded cycle: supported Windows Electron runtime

Outcome: one exact supported Electron version, reviewed lock delta and proven existing Windows app behavior, with explicit remaining audit findings. Do not merge/deploy, migrate a real userData directory or change editor vendor pin as part of it.

1. Create isolated source branch/private dependency cache; preserve old package+lock. Resolve exact candidate only, inspect transitive changes, rerun audit and document every remaining advisory. Verify artifact provenance/installer extraction and reproducible clean npm ci plus explicit binary installation. No blind override of extract-zip.
2. Check clean build and unpacked electron-builder output. Launch disposable packaged app, not only development entrypoint; verify main/preload/renderer/shared/native helper resources, provider worker/terminal jobs and normal/abrupt shutdown. Packaging availability is acceptance, not inferred from build configuration.
3. Run full desktop suite, especially C026 actual contextBridge rejection, credential safeStorage restart, C014/C020/C018 native worker/terminal recovery, C016 profile/webview cookie isolation, navigation/popups/PDF and dialog folder behavior. Add controlled local-origin webview tests for prohibited schemes/popups and permission requests; no external exploit traffic.
4. Real Paper typed edit/save/reopen/Undo, clipboard text/HTML/image, upload and cancellation; exact editor source provenance unchanged. Deterministic capture/compare, actual agent review of every changed frame/geometry and GIF, isolated live status and root verify. Chromium changes may legitimately change pixels; never autoapprove.
5. Source commit before evidence; update notice manifest for changed packages and bounded handoff. Rollback is old code with a separate retained disposable test profile: do not assume Chromium profile data can safely downgrade in place.

Cost estimate (planning, not measured): install/lock/packaging inventory roughly30-60minutes; focused/full regressions60-120minutes; serialized native/Paper/visual capture and review60-120minutes. Reserve3-5hours plus download/UI queue and actual regression repair. Cross-platform packaging, signing and clean-machine installer delivery remain separate gates. An audit-only green result cannot replace these tests.
