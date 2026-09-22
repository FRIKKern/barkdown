import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const {
  assertProfileNativeStopped,
} = require("../main/profile-native-preflight");
const {
  acquireAuthorityLease,
  createLegacyAdoption,
} = require("../main/legacy-authority-adoption");
const { createProfileRegistry } = require("../main/profile-registry");
const {
  launchOwnedWorker,
  verifyOwnedWorker,
} = require("../main/goal-process");
const script = fileURLToPath(
  new URL("./fixtures/goal-process-tree.cjs", import.meta.url),
);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if (e.code === "ESRCH") return false;
    throw e;
  }
};
function fixture() {
  const storeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "bd-native-preflight-"),
    ),
    profileId = randomUUID();
  fs.writeFileSync(
    path.join(storeDir, "workspace.json"),
    JSON.stringify({ version: 1, chats: {}, order: [], current: null }),
  );
  return { storeDir, profileId };
}
function put(o, name, value) {
  const file = path.join(o.storeDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
}
function pair(o, id = randomUUID()) {
  const nonce = randomUUID(),
    value = {
      version: 1,
      profileId: o.profileId,
      attemptId: id,
      nonce,
      jobName: `Local\\BarkdownGoal-${nonce}`,
    };
  put(o, `goal-processes/${id}.launch.json`, value);
  put(o, `goal-processes/${id}.receipt.json`, {
    ...value,
    containment: "job-list-v1",
    helperPid: 1,
    helperStarted: "1",
    phase: "stopped",
    activeProcesses: 0,
  });
  return id;
}
function terminal(o, id = randomUUID(), state = "reserved") {
  const t = {
    version: 1,
    profileId: o.profileId,
    chatId: "chat",
    id: "tab",
    sessionId: id,
    cwd: o.storeDir,
    launchState: state,
  };
  return put(
    o,
    "terminal-sessions/" +
      createHash("sha256")
        .update(JSON.stringify([o.profileId, t.chatId, t.id]))
        .digest("hex") +
      ".json",
    t,
  );
}
test("empty native inventory does not seed directories; launch/receipt gaps and unfinished reservations refuse", async () => {
  const o = fixture();
  const before = fs.readdirSync(o.storeDir);
  await assertProfileNativeStopped(o);
  assert.deepEqual(fs.readdirSync(o.storeDir), before);
  const id = randomUUID();
  terminal(o, id);
  await assert.rejects(assertProfileNativeStopped(o), /missing/);
  terminal(o, id, "not-dispatched");
  await assertProfileNativeStopped(o); // Positively never dispatched, no receipt.
  pair(o, id);
  let calls = 0;
  await assert.rejects(
    assertProfileNativeStopped(o, async () => {
      calls++;
      return false;
    }),
    /live or unverified/,
  );
  assert.equal(calls, 1);
  fs.renameSync(
    path.join(o.storeDir, `goal-processes/${id}.launch.json`),
    path.join(o.storeDir, "retained-launch.json"),
  );
  await assert.rejects(assertProfileNativeStopped(o), /missing/);
  const w = fixture();
  put(w, "workspace.json", {
    ownership: {
      version: 1,
      attempts: { [randomUUID()]: { driverFinished: false } },
    },
  });
  await assert.rejects(assertProfileNativeStopped(w), /missing/);
});
test("foreign, malformed, linked and concurrently changed ownership refuses without mutating records", async () => {
  for (const mode of [
    "foreign",
    "corrupt",
    "changed",
    "lease",
    "linked",
    "unknown",
  ]) {
    const o = fixture(),
      id = pair(o),
      file = path.join(o.storeDir, `goal-processes/${id}.receipt.json`);
    if (mode === "foreign") {
      const r = JSON.parse(fs.readFileSync(file));
      r.profileId = randomUUID();
      fs.writeFileSync(file, JSON.stringify(r));
    }
    if (mode === "corrupt") fs.writeFileSync(file, "{");
    if (mode === "unknown")
      fs.writeFileSync(
        path.join(o.storeDir, "goal-processes/pending.tmp"),
        "retained",
      );
    if (mode === "linked") {
      const old = path.join(o.storeDir, "goal-processes");
      fs.renameSync(old, old + "-retained");
      fs.symlinkSync(old + "-retained", old, "junction");
    }
    let owned = true;
    const bytes = fs.readFileSync(file);
    await assert.rejects(
      assertProfileNativeStopped(
        {
          ...o,
          assertOwned() {
            if (!owned) throw Error("lease lost");
          },
        },
        async () => {
          if (mode === "changed") fs.appendFileSync(file, " ");
          if (mode === "lease") owned = false;
          return true;
        },
      ),
    );
    if (mode !== "changed") assert.deepEqual(fs.readFileSync(file), bytes);
  }
});
for (const crash of [false, true])
  test(
    `actual native ${crash ? "crashed" : "stopped"} tree blocks before rollback phase, then allows retained retirement`,
    { skip: process.platform !== "win32", timeout: 45000 },
    async (t) => {
      const userData = fs.mkdtempSync(
          path.join(os.tmpdir(), "bd-native-rollback-"),
        ),
        source = path.join(userData, "barkdown");
      fs.mkdirSync(source);
      const original = JSON.stringify({
        version: 1,
        chats: {},
        order: [],
        current: null,
        pages: [],
        favorites: [],
      });
      fs.writeFileSync(path.join(source, "workspace.json"), original);
      const ownership = acquireAuthorityLease(userData);
      t.after(() => ownership.release());
      const api = createLegacyAdoption({ userData, ownership });
      await api.prepare();
      const active = await api.recover({ action: "activate" });
      const registry = createProfileRegistry(active.finalRoot),
        second = registry.createProfile({ name: "No runtime second profile" }),
        store = registry.storeFor(second.id);
      const owner = {
          profileId: second.id,
          storeDir: store.storeDir,
          attemptId: randomUUID(),
        },
        marker = path.join(store.storeDir, "effects.txt");
      let resolveTree;
      const tree = new Promise((resolve) => (resolveTree = resolve));
      const worker = await launchOwnedWorker({
        ...owner,
        script,
        args: [marker],
        onMessage: (m) => {
          if (m.type === "tree") resolveTree(m);
        },
      });
      t.after(async () => {
        worker.stop();
        await worker.finished.catch(() => {});
      });
      await worker.ready;
      const pids = await tree;
      const journal = path.join(userData, "legacy-adoption.json"),
        before = fs.readFileSync(journal);
      assert.equal(await verifyOwnedWorker(owner), false);
      await assert.rejects(
        api.recover({ action: "rollback" }),
        /native work is still live or unverified/,
      );
      assert.deepEqual(fs.readFileSync(journal), before);
      assert.equal(api.inspect().status, "active");
      assert.ok([pids.root, pids.pid, pids.leaf].every(alive));
      if (crash) process.kill(worker.helperPid, "SIGKILL");
      else worker.stop();
      await worker.finished;
      assert.equal(await verifyOwnedWorker(owner), true);
      assert.ok([pids.root, pids.pid, pids.leaf].every((pid) => !alive(pid)));
      const rolled = await api.recover({ action: "rollback" });
      assert.equal(rolled.status, "rolled-back");
      assert.ok(
        fs.existsSync(
          path.join(rolled.retainedRoot, "profiles", second.id, "effects.txt"),
        ),
      );
      assert.equal(
        fs.readFileSync(path.join(source, "workspace.json"), "utf8"),
        original,
      );
      fs.writeFileSync(
        path.join(userData, "native-proof.json"),
        JSON.stringify(
          {
            sourceCommit: "working C021",
            crash,
            profileId: second.id,
            pids,
            stopped: true,
            beforePhase: "active",
            refusedBeforePhaseChange: true,
            retainedRoot: rolled.retainedRoot,
          },
          null,
          2,
        ),
      );
      console.log("Native rollback proof:", userData);
    },
  );

test("matching not-dispatched launch is distinct from an uncertain launch-only reservation", async () => {
  const o = fixture(),
    id = pair(o),
    receipt = path.join(o.storeDir, `goal-processes/${id}.receipt.json`);
  fs.renameSync(receipt, path.join(o.storeDir, "retained-receipt.json"));
  await assert.rejects(assertProfileNativeStopped(o), /missing/);
  terminal(o, id, "not-dispatched");
  await assertProfileNativeStopped(o);
  put(o, "workspace.json", {
    ownership: { version: 1, attempts: { [id]: { driverFinished: false } } },
  });
  await assert.rejects(assertProfileNativeStopped(o), /collides/);
});
