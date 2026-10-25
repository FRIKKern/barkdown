// assertCold without an explicit pgBin used the Windows Scoop path built from
// USERPROFILE, which is undefined off Windows: legacy adoption on macOS crashed
// with ERR_INVALID_ARG_TYPE before it ever looked for Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { assertCold } = require('../main/profile-runtime-adoption');

test('assertCold resolves Postgres without building a path from an undefined USERPROFILE', async () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'bd-cold-'));
  fs.mkdirSync(path.join(dir, 'pgdata', 'pg_tblspc'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pgdata', 'PG_VERSION'), '99\n');
  // Off Windows USERPROFILE is normally absent; remove it so the old default is exercised.
  const saved = process.env.USERPROFILE; if (process.platform !== 'win32') delete process.env.USERPROFILE;
  try {
    await assert.rejects(assertCold(dir), error => {
      assert.notEqual(error.code, 'ERR_INVALID_ARG_TYPE', 'must not build a Windows path from an undefined USERPROFILE');
      return true;
    });
  } finally { if (saved !== undefined) process.env.USERPROFILE = saved; fs.rmSync(dir, { recursive: true, force: true }); }
});
