import { _electron as electron } from "playwright";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const {
  acquireAuthorityLease,
  createLegacyAdoption,
} = require("../main/legacy-authority-adoption");
const { createProfileRegistry } = require("../main/profile-registry");
const {
  launchOwnedWorker,
  verifyOwnedWorker,
} = require("../main/goal-process");
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  repo = path.dirname(appDir);
const userData = fs.mkdtempSync(
    path.join(os.tmpdir(), "bd-rollback-native-ui-"),
  ),
  out = path.join(userData, "evidence"),
  source = path.join(userData, "barkdown");
fs.mkdirSync(source);
fs.mkdirSync(out);
const ws = {
  version: 1,
  current: "chat",
  order: ["chat"],
  chats: {
    chat: {
      id: "chat",
      title: "Retained original",
      messages: [],
      events: [],
      apiHistory: [],
      tabs: [],
      draft: "Original unsent draft",
      draftImages: [],
      following: true,
    },
  },
  favorites: [],
  pages: { layoutVersion: 2, roots: [], children: {}, expanded: {}, archiveOpen: false, archiveFilter: "", cloudArchiveOpen: false, cloudArchiveFilter: "", seeded: true },
};
fs.writeFileSync(path.join(source, "workspace.json"), JSON.stringify(ws));
fs.writeFileSync(
  path.join(source, "settings.json"),
  JSON.stringify({ provider: "api", barkpark: { enabled: false } }),
);
const original = fs.readFileSync(path.join(source, "workspace.json"));
const originalFiles = Object.fromEntries(
  fs
    .readdirSync(source)
    .map((name) => [
      name,
      fs.readFileSync(path.join(source, name)).toString("base64"),
    ]),
);
const ownership = acquireAuthorityLease(userData);
let active;
try {
  const api = createLegacyAdoption({ userData, ownership });
  await api.prepare();
  active = await api.recover({ action: "activate" });
} finally {
  ownership.release();
}
const operation = JSON.parse(
  fs.readFileSync(path.join(userData, "legacy-adoption.json")),
).operationId;
const backup = path.join(
  userData,
  "legacy-adoption-work",
  operation,
  "shell-original",
);
function assertBackup() {
  for (const [name, bytes] of Object.entries(originalFiles))
    assert.equal(
      fs.readFileSync(path.join(backup, name)).toString("base64"),
      bytes,
    );
}
assertBackup();
const registry = createProfileRegistry(active.finalRoot),
  store = registry.storeFor(active.profileId),
  owner = {
    profileId: active.profileId,
    storeDir: store.storeDir,
    attemptId: randomUUID(),
  };
let resolveTree;
const tree = new Promise((resolve) => (resolveTree = resolve)),
  worker = await launchOwnedWorker({
    ...owner,
    script: path.join(appDir, "tests/fixtures/goal-process-tree.cjs"),
    args: [path.join(store.storeDir, "effects.txt")],
    onMessage: (m) => {
      if (m.type === "tree") resolveTree(m);
    },
  });
let app,
  passed = false;
const pids = await tree;
await worker.ready;
const launch = () =>
  electron.launch({
    executablePath: require("electron"),
    args: [appDir, '--legacy', `--user-data=${userData}`, "--rollback-adoption"],
    env: { ...process.env, BARKDOWN_PROVIDER: "api", ANTHROPIC_API_KEY: "" },
    recordVideo: { dir: out, size: { width: 760, height: 540 } },
  });
try {
  const journal = path.join(userData, "legacy-adoption.json"),
    before = fs.readFileSync(journal);
  app = await launch();
  let page = await app.firstWindow();
  await page.getByRole("button", { name: "Restore legacy authority" }).click();
  await page
    .locator(".detail")
    .filter({ hasText: "native work is still live or unverified" })
    .waitFor();
  assert.deepEqual(fs.readFileSync(journal), before);
  assert.equal(await verifyOwnedWorker(owner), false);
  assert.equal(await page.locator("button").count(), 1);
  await page.screenshot({ path: path.join(out, "rollback-refused.png") });
  await page.setViewportSize({ width: 440, height: 540 });
  await page.screenshot({
    path: path.join(out, "rollback-refused-narrow.png"),
  });
  await app.close();
  app = null;
  worker.stop();
  await worker.finished;
  assert.equal(await verifyOwnedWorker(owner), true);
  app = await launch();
  page = await app.firstWindow();
  await app.evaluate(
    ({ app }, payload) => {
      const fs = process.getBuiltinModule("fs"),
        path = process.getBuiltinModule("path"),
        req = process
          .getBuiltinModule("module")
          .createRequire(path.join(app.getAppPath(), "main/main.js"));
      const store = req(path.join(app.getAppPath(), "main/store.js")),
        originalInit = store.init;
      store.init = function (dir) {
        if (path.resolve(dir) === path.resolve(payload.source)) {
          for (const [name, bytes] of Object.entries(payload.files))
            if (
              fs.readFileSync(path.join(dir, name)).toString("base64") !== bytes
            )
              throw Error("Pre-boot original bytes changed: " + name);
          globalThis.__nativeRollbackOriginalBytesVerified = true;
        }
        return originalInit.apply(this, arguments);
      };
    },
    { source, files: originalFiles },
  );
  const next = app.waitForEvent("window");
  await page.getByRole("button", { name: "Restore legacy authority" }).click();
  page = await next;
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  assert.equal(
    (await page.evaluate(() => window.barkdown.profiles.status())).enabled,
    false,
  );
  assert.equal(
    await page.evaluate(() => window.__barkdown.state.chats.chat.draft),
    "Original unsent draft",
  );
  assert.equal(
    await app.evaluate(() => globalThis.__nativeRollbackOriginalBytesVerified),
    true,
  );
  await page.locator('#bw-recent-chats [data-context="chat"]').waitFor();
  await page.screenshot({ path: path.join(out, "verified-rollback.png") });
  await app.close();
  app = null;
  const restored = JSON.parse(
    fs.readFileSync(path.join(source, "workspace.json")),
  );
  function preserved(expected, actual, at = "workspace") {
    if (
      Array.isArray(expected) ||
      expected === null ||
      typeof expected !== "object"
    ) {
      assert.deepEqual(actual, expected, at);
      return;
    }
    for (const [key, value] of Object.entries(expected))
      preserved(value, actual?.[key], at + "." + key);
  }
  preserved(JSON.parse(original), restored);
  const allowedRoot = ["profileId", "generation", "mode", "directTab"];
  assert.deepEqual(
    Object.keys(restored)
      .filter((k) => !(k in ws))
      .sort(),
    allowedRoot.sort(),
  );
  assert.deepEqual(
    Object.keys(restored.chats).filter((k) => !(k in ws.chats)),
    ["direct"],
  );
  assert.deepEqual(
    Object.keys(restored.chats.chat)
      .filter((k) => !(k in ws.chats.chat))
      .sort(),
    ["runId", "closedTargets", "chatScroll"].sort(),
  );
  assertBackup();
  passed = true;
} finally {
  if (app) {
    const recovery = app.windows().find((p) => p.url().startsWith("data:"));
    const quit = recovery?.getByRole("button", { name: "Quit", exact: true });
    if (quit && (await quit.isVisible().catch(() => false))) {
      const closed = app.waitForEvent("close");
      await quit.click();
      await closed;
    } else await app.close();
  }
  worker.stop();
  await worker.finished.catch(() => {});
  const stopped = await verifyOwnedWorker(owner).catch(() => false);
  // Successful rollback relocates these receipts; verify their retained owner instead.
  const journal = JSON.parse(
      fs.readFileSync(path.join(userData, "legacy-adoption.json")),
    ),
    retained = path.join(
      userData,
      "legacy-adoption-work",
      journal.operationId,
      "retired-registry",
      "profiles",
      owner.profileId,
    );
  const verified =
    stopped ||
    (await verifyOwnedWorker({ ...owner, storeDir: retained }).catch(
      () => false,
    ));
  fs.writeFileSync(
    path.join(out, "manifest.json"),
    JSON.stringify(
      {
        sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: repo,
          encoding: "utf8",
        }).trim(),
        sourceDirty:
          execFileSync("git", ["status", "--porcelain", "--", "app"], {
            cwd: repo,
            encoding: "utf8",
          }).trim() !== "",
        userData,
        passed,
        pids,
        stopped: verified,
        retained,
        scope:
          "Actual Electron native rollback refusal, narrow recovery and verified explicit retry; no Barkpark/provider",
      },
      null,
      2,
    ),
  );
  assert.equal(verified, true);
  console.log("Rollback UI evidence:", out);
}
