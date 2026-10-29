// Recordings of the real app for the download page, made with sample content instead of test fixtures. Starts
// Barkdown from source (no runtime needed: --legacy notes) with a throwaway profile, dark theme and a small sample
// project, drives it the way a person would, records the window, and writes compact loops to site/media through
// ffmpeg (same budget as scripts/site-media.mjs). Run on a Mac with a desktop session; outputs are committed.
//   node scripts/site-capture.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'app');
const require = createRequire(path.join(appDir, 'package.json'));
const { _electron: electron } = require('playwright');
const out = path.join(root, 'site', 'media');
const work = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'barkdown-site-capture-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BUDGET = 600 * 1024;

// A sample project with one uncommitted change, so the code review tab has something real to show.
const project = path.join(work, 'release-notes');
fs.mkdirSync(project);
const git = (...args) => execFileSync('git', ['-C', project, ...args], { stdio: 'ignore' });
fs.writeFileSync(path.join(project, 'release.md'), '# Release\n\nInstall from the release page and approve it in Settings.\n');
fs.writeFileSync(path.join(project, 'checks.md'), '# Checks\n\n- [ ] Tests pass on both Macs\n');
git('init', '-q'); git('-c', 'user.name=Barkdown', '-c', 'user.email=site@barkdown.invalid', 'add', '.'); git('-c', 'user.name=Barkdown', '-c', 'user.email=site@barkdown.invalid', 'commit', '-qm', 'Release notes');
fs.writeFileSync(path.join(project, 'release.md'), '# Release\n\nDownload, open, drag Barkdown to Applications.\n');
fs.writeFileSync(path.join(project, 'checks.md'), '# Checks\n\n- [x] Tests pass on both Macs\n- [x] Signed and notarized\n');

// A home of its own: the terminal's prompt shows the folder, not this Mac's user or host name.
const home = path.join(work, 'home');
fs.mkdirSync(home);
fs.writeFileSync(path.join(home, '.zshrc'), "PROMPT='%F{green}%1~%f $ '\n");

// The loop is cut from the moment the drive starts to the moment it ends, measured on the recording's own clock.
async function record(name, drive) {
  const userData = path.join(work, `user-data-${name}`), video = path.join(work, `video-${name}`);
  const started = Date.now();
  const app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--legacy', `--user-data=${userData}`], recordVideo: { dir: video, size: { width: 1440, height: 900 } },
    env: { ...process.env, HOME: home, ZDOTDIR: home, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'sk-ant-site-capture', BARKDOWN_MOCK_KEYCHAIN: '1' } });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.emulateMedia({ colorScheme: 'dark' });
  // The work pane is what these recordings show: the chat at 38% instead of 60%.
  await page.evaluate(() => window.barkdown.settings.set({ chatWidth: 38 }));
  await page.reload(); await page.waitForFunction(() => window.__barkdown?.state.loaded);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => document.querySelectorAll('.bw-toast').forEach(n => n.remove()));
  await sleep(400);
  const trim = (Date.now() - started) / 1000;
  await drive(page);
  const seconds = (Date.now() - started) / 1000 - trim + 0.6;
  const file = await page.video().path();
  await app.close();
  const input = ['-ss', String(trim), '-t', String(seconds), '-i', file];
  const scale = 'fps=24,scale=1280:-2:flags=lanczos,format=yuv420p';
  const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
  ff([...input, '-vf', scale, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', path.join(out, `${name}.webm`)]);
  ff([...input, '-vf', scale, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
  ff(['-ss', String(trim + 1), '-i', file, '-vf', 'scale=1280:-2', '-frames:v', '1', '-q:v', '4', path.join(out, `${name}.jpg`)]);
  for (const ext of ['webm', 'mp4']) {
    const size = fs.statSync(path.join(out, `${name}.${ext}`)).size;
    console.log(`site-capture: ${name}.${ext} ${Math.round(size / 1024)} KB`);
    if (size > BUDGET) throw new Error(`${name}.${ext} is over the ${BUDGET / 1024} KB budget`);
  }
}

// A picture of the real app (a profile of its own, --profiles, dark), saved as a compact JPEG.
async function picture(name, drive) {
  const userData = path.join(work, `user-data-${name}`), png = path.join(work, `${name}.png`);
  const app = await electron.launch({ executablePath: require('electron'), args: [appDir, '--profiles', `--user-data=${userData}`],
    env: { ...process.env, HOME: home, ZDOTDIR: home, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: 'sk-ant-site-capture', BARKDOWN_MOCK_KEYCHAIN: '1' } });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => window.__barkdown?.state.loaded, null, { timeout: 120000 });
    await page.evaluate(() => document.querySelectorAll('.bw-toast').forEach(n => n.remove()));
    await drive(page);
    await page.screenshot({ path: png });
  } finally { await app.close(); }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=1440:-2', '-q:v', '4', path.join(out, `${name}.jpg`)]);
  console.log(`site-capture: ${name}.jpg ${Math.round(fs.statSync(path.join(out, `${name}.jpg`)).size / 1024)} KB`);
}
const only = process.argv.slice(2);
const wanted = name => !only.length || only.includes(name);

try {
  // Where notes live: Settings › General, the library profile, a new profile, export and import.
  if (wanted('settings-storage')) await picture('settings-storage', async page => {
    await page.locator('body').click({ position: { x: 900, y: 400 } });
    await page.keyboard.press('Meta+Comma');
    await page.locator('section[data-pane="general"]').waitFor();
    await page.locator('section[data-pane="general"] input[placeholder="Profile name"]').fill('Work');
    await page.locator('section[data-pane="general"] h3', { hasText: 'Storage' }).scrollIntoViewIfNeeded().catch(() => {});
    await sleep(600);
  });
  // A goal: quick open, Conversation goals, the goal typed in with its time window.
  if (wanted('goal-new')) await picture('goal-new', async page => {
    await page.locator('body').click({ position: { x: 900, y: 400 } });
    await page.keyboard.press('Meta+k');
    await page.keyboard.type('Conversation goals', { delay: 25 });
    await page.keyboard.press('Enter');
    const goal = page.locator('textarea[name="objective"]');
    await goal.waitFor({ timeout: 20000 });
    await goal.fill('Compare the Barkpark docs, the release notes and the open issues, and summarise where they disagree.');
    await sleep(600);
  });
  // Work tabs: a note, a website, a terminal in the project, the code review of its change; then back through them.
  if (wanted('work-tabs')) await record('work-tabs', async page => {
    await page.evaluate(folder => window.__barkdown.setFolder(folder), project);
    // Each hook opens a tab the way an agent's tool does; render() draws it.
    const open = target => page.evaluate(t => { window.__barkdown.openTarget(t); window.__barkdown.render(); }, target);
    await open({ kind: 'project', path: 'release.md' });
    await sleep(1800);
    await open({ kind: 'web', url: 'https://frikkern.github.io/barkdown/', title: 'frikkern.github.io' });
    await sleep(5500);
    await open({ kind: 'terminal' });
    await sleep(3000);
    await page.locator('.xterm').last().click();
    await page.keyboard.type('git status --short', { delay: 45 }); await page.keyboard.press('Enter');
    await sleep(1600);
    await open({ kind: 'review' });
    await sleep(2800);
    const tabs = page.locator('.bw-tab');
    for (const i of [0, 1]) { await tabs.nth(i).click(); await sleep(1300); }
  });
} finally { fs.rmSync(work, { recursive: true, force: true }); }
