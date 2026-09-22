// Read-only rollback preflight. Native receipts are shared by goals, ordinary
// provider turns and terminals; a dead parent or missing receipt is not proof.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createStore } = require("./store");
const { verifyOwnedWorker } = require("./goal-process");
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const check = (x, message) => {
  if (!x) throw new Error("Rollback native preflight: " + message);
};
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
async function assertProfileNativeStopped(
  { storeDir, profileId, assertOwned = () => {} },
  verify = verifyOwnedWorker,
) {
  check(UUID.test(profileId), "invalid profile identity");
  const store = createStore(storeDir, { create: false });
  const files = new Map(),
    directories = new Map(),
    attempts = new Set(),
    notDispatched = new Set();
  function read(relative) {
    const file = store.filePath(relative);
    check(
      fs.lstatSync(file).isFile(),
      "ownership entry is not a regular file: " + relative,
    );
    const bytes = fs.readFileSync(file);
    files.set(relative, hash(bytes));
    try {
      return JSON.parse(bytes);
    } catch {
      throw new Error(
        "Rollback native preflight: unreadable ownership record: " + relative,
      );
    }
  }
  function list(relative) {
    const file = store.filePath(relative);
    if (!fs.existsSync(file)) {
      directories.set(relative, null);
      return [];
    }
    check(
      fs.lstatSync(file).isDirectory(),
      "ownership directory is invalid: " + relative,
    );
    const names = fs.readdirSync(file).sort();
    directories.set(relative, names);
    return names;
  }
  const terminalNames = list("terminal-sessions");
  for (const name of terminalNames) {
    check(
      /^[0-9a-f]{64}\.json$/.test(name),
      "unclassified terminal ownership entry",
    );
    const t = read("terminal-sessions/" + name);
    check(
      t?.version === 1 &&
        t.profileId === profileId &&
        UUID.test(t.sessionId) &&
        ["chatId", "id"].every(
          (k) =>
            typeof t[k] === "string" && t[k].length > 0 && t[k].length < 512,
        ) &&
        ["reserved", "not-dispatched"].includes(t.launchState),
      "invalid terminal owner",
    );
    check(
      name === hash(JSON.stringify([profileId, t.chatId, t.id])) + ".json",
      "terminal owner filename mismatch",
    );
    check(
      !attempts.has(t.sessionId),
      "terminal session identity is duplicated",
    );
    attempts.add(t.sessionId);
    if (t.launchState === "not-dispatched") notDispatched.add(t.sessionId);
  }
  const workspace = read("workspace.json");
  check(object(workspace), "invalid workspace");
  if (workspace.ownership !== undefined) {
    const meta = workspace.ownership;
    check(
      meta?.version === 1 && object(meta.attempts),
      "invalid workspace ownership",
    );
    for (const [id, attempt] of Object.entries(meta.attempts)) {
      check(
        UUID.test(id) &&
          object(attempt) &&
          typeof attempt.driverFinished === "boolean",
        "invalid workspace attempt",
      );
      check(
        !notDispatched.has(id),
        "terminal identity collides with a workspace attempt",
      );
      if (!attempt.driverFinished) attempts.add(id);
    }
  }
  const nativeNames = list("goal-processes"),
    pairs = new Map();
  for (const name of nativeNames) {
    const match = /^([0-9a-f-]+)\.(launch|receipt)\.json$/.exec(name);
    check(match && UUID.test(match[1]), "unclassified native ownership entry");
    const [, id, kind] = match;
    const value = read("goal-processes/" + name);
    check(
      value?.version === 1 &&
        value.profileId === profileId &&
        value.attemptId === id,
      "native record owner mismatch",
    );
    check(
      UUID.test(value.nonce) &&
        value.jobName === `Local\\BarkdownGoal-${value.nonce}`,
      "invalid native launch identity",
    );
    const pair = pairs.get(id) || {};
    pair[kind] = value;
    pairs.set(id, pair);
    attempts.add(id);
  }
  for (const id of attempts) {
    assertOwned();
    const pair = pairs.get(id);
    if (notDispatched.has(id) && !pair?.receipt) {
      // C018 writes this only after a positively classified pre-spawn failure.
      // A matching launch reservation may precede that failure; any receipt
      // contradicts the exemption and must pass native verification instead.
      continue;
    }
    check(
      pair?.launch && pair?.receipt,
      "native shutdown evidence is missing for " + id,
    );
    check(
      (await verify({ storeDir, profileId, attemptId: id })) === true,
      "native work is still live or unverified for " + id,
    );
    assertOwned();
  }
  function assertUnchanged() {
    assertOwned();
    for (const [relative, expected] of directories) {
      const file = store.filePath(relative);
      const actual = fs.existsSync(file) ? fs.readdirSync(file).sort() : null;
      check(
        JSON.stringify(actual) === JSON.stringify(expected),
        "ownership directory changed during verification",
      );
    }
    for (const [relative, expected] of files)
      check(
        hash(fs.readFileSync(store.filePath(relative))) === expected,
        "ownership evidence changed during verification",
      );
  }
  assertUnchanged();
  return Object.freeze({ assertUnchanged });
}
module.exports = { assertProfileNativeStopped };
