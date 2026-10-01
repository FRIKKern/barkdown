# C088 — Your own agents

**Status:** active; opened 2026-10-01. Stage P5. Started while [C086](C086-packaged-runtime.md) waits for the user (a clean account, a signature) and [C085](C085-portable-profile.md) for the Windows machine.

**Outcome:** Barkdown runs chats through the Claude Code and Codex installed on the machine, found reliably from a desktop app, and stops carrying its own copies (510 MB of the 1 GB application).

**Why:** the paper [The CLI Is Already There](https://guerrilla.barkpark.cloud/papers/the-cli-is-already-there): nobody runs these agents without a subscription and a login, both live in the vendor's tool, a bundled copy is frozen at build time, and T3 Code at scale bundles nothing. The paper's twelve failure modes are this cycle's test matrix.

**Slices:**
- S1 Login-shell PATH hydration, scoped to providers (the packaged runtime keeps its system-only PATH). Rows 1–3, 11.
- S2 Binary path override in Settings and a `--version` sanity run. Rows 4, 10.
- S3 Tested-with version range per SDK pin; three provider cards (install, sign in, version). Rows 6–7.
- S4 Platform packages removed, SDKs given the resolved executable, rebuild, rehearsals. Rows 8, 12; Finder launch on the clean account.
- Windows rows 5 and 10 when the machine is back.

**S1 (7fd677f7, 2026-10-01):** `app/main/shell-environment.js`. The login shell is asked for its environment after a sentinel line (`-ilc 'echo …; printenv'`, which fish and nushell can run too), candidates in order `$SHELL`, the account's shell from `dscl`/`getent`, the platform default; each gets a bounded time and a hung one is skipped; macOS falls back to `launchctl getenv PATH`, Windows reads the machine and user `Path` from the registry. The shell's PATH leads, inherited entries follow, known tool folders that exist come last; locale, `SSH_AUTH_SOCK`, Homebrew and XDG variables are adopted when missing. Provider runs (`run-scope.js`), the sign-in worker, owned workers and the terminal use it; the packaged runtime keeps its system-only PATH and the main process PATH is untouched. Probe records keep shell, outcome and time, never an environment. [Live](evidence/C088/live/2026-10-01T10-05-16-540Z-shell-environment/result.json): an app launched with the system PATH and a fixture login shell finds a fixture Claude Code and reports it signed in. `npm run test:shell-environment`.

**Next action:** S2.
