// Recordings for the download page: real-app captures in docs/ become short, silent WebM and MP4 loops with a
// poster frame in site/media, small enough to load only when their scene is near (budget: 600 KB per format).
// Run after a new capture is approved; the outputs are committed. Needs ffmpeg.
//   node scripts/site-media.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'site', 'media');
// name: [source, width, first second, seconds]
const CLIPS = {
  'claude-edits-a-note': ['docs/images/status/editing.gif', 1280, 0, 12],
  'notebook': ['docs/visual/agent-notes/runs/2026-09-24T23-33-22-364Z-notebook/readme-notebook.gif', 1200, 0, 16],
};
const BUDGET = 600 * 1024;
fs.mkdirSync(out, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
for (const [name, [source, width, start, seconds]] of Object.entries(CLIPS)) {
  const input = ['-ss', String(start), '-t', String(seconds), '-i', path.join(root, source)];
  const scale = `fps=24,scale=${width}:-2:flags=lanczos`;
  ff([...input, '-vf', `${scale},format=yuv420p`, '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', path.join(out, `${name}.webm`)]);
  ff([...input, '-vf', `${scale},format=yuv420p`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
  ff(['-i', path.join(root, source), '-vf', `select=eq(n\\,0),scale=${width}:-2`, '-frames:v', '1', '-q:v', '4', path.join(out, `${name}.jpg`)]);
  for (const ext of ['webm', 'mp4']) {
    const size = fs.statSync(path.join(out, `${name}.${ext}`)).size;
    console.log(`site-media: ${name}.${ext} ${Math.round(size / 1024)} KB`);
    if (size > BUDGET) throw new Error(`${name}.${ext} is ${Math.round(size / 1024)} KB, over the ${BUDGET / 1024} KB budget`);
  }
}
