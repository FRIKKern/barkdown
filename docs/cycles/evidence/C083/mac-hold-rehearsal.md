# Switch rehearsal, first half, on macOS (2026-09-29)

**What ran:** `app/tests/upstream-admission.live.mjs` (`npm run test:hold-rehearsal` in `app/`) against a private managed runtime built from the upstream worktree at `153cb9ae3` (branch `codex/write-admission-slice6`: slices 4–6 and the trusted hold endpoint, unmerged). Barkdown at `8b024ba7` (POSIX launcher twin). Host: macOS 24.3 (Darwin), Apple Silicon, Homebrew Elixir 1.20.2 / OTP 29, PostgreSQL 15.18. Private ports 4551/5551, disposable data directory, `writeAdmission: { instanceId }` opted in through the source driver.

**Transcript (verbatim, secrets absent):**

```
Isolated runtime data: /private/var/folders/.../barkdown-hold-Zkx31j instance rehearsal-349ba03d
starting
ready
held { generation: 1, boot: 'ca3b84cd14815c1f42ba63d0f484b97e' }
PASS hold refuses an admin write, reopen admits it, the old capability refuses.
stopping
stopped
starting
ready
PASS restart while held stays blocked: writes refused, old capability unknown, a new hold refused (explicit recovery required).
stopping
stopped
```

**What it proves.** The journal is provisioned beside the runtime on first boot. `POST /v1/admin/write-admission/hold` returns a held view with generation and boot identity. While held, an admin write (`POST /v1/schemas/production`) is refused with 503 `storage_unavailable`, and the hold's status still answers. `DELETE .../hold/:capability` reopens with generation +1; the old capability then answers 404; the same write is admitted. A second hold, then a runtime stop and start: the coordinator reloads its journal into `recovery_required`, writes stay refused, the old capability is unknown to the fresh Holder, and a new hold is refused. That is the contract's crash/restart clause: restart never silently reopens.

**What it does not prove.** No comparison ran while held; no selection, no rollback, no media bytes in flight, no Oban job mid-drain (the runtime was idle, so the hold was `held` immediately rather than `closing`). Explicit recovery from `recovery_required` has no endpoint yet; the test ends there on a disposable runtime. The upstream commits are unmerged; the same test must rerun against the merged main after the `BARKPARK_REF` bump, and once on Windows.
