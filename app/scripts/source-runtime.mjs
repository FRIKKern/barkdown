// The packaged Barkpark a source launch runs on (#95). The installed application carries it in
// Resources/runtime; from source it lives where scripts/build-runtime-release.mjs writes it by default,
// runtime/barkpark-<pin9>-<platform>-<arch>, and .github/workflows/runtime.yml publishes the same folder
// for app/BARKPARK_REF as the asset of the runtime-<pin9> pre-release. A folder built here is used as is;
// a missing one is downloaded, checked against its SHA-256 and only then moved into place.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RELEASES = 'https://github.com/FRIKKern/barkdown/releases/download';
// Only Apple silicon is published, as for the application itself; Windows source runs keep the checkout.
export const PUBLISHED = ['darwin-arm64'];

export function pinOf(root = appRoot) { return fs.readFileSync(path.join(root, 'BARKPARK_REF'), 'utf8').trim(); }
export function folderName(pin, platform = process.platform, arch = process.arch) { return `barkpark-${pin.slice(0, 9)}-${platform}-${arch}`; }
export function runtimeFolder(pin, { root = appRoot, platform = process.platform, arch = process.arch } = {}) { return path.resolve(root, '..', 'runtime', folderName(pin, platform, arch)); }
export function assetUrls(pin, { platform = process.platform, arch = process.arch, base = RELEASES } = {}) {
  const asset = `${folderName(pin, platform, arch)}.tar.gz`;
  return { asset, archive: `${base}/runtime-${pin.slice(0, 9)}/${asset}`, sum: `${base}/runtime-${pin.slice(0, 9)}/${asset}.sha256` };
}

// The same shape app/main/local-barkpark-source.js accepts as a packaged release, stamped with the pin:
// a runtime for another commit is not this checkout's runtime, even if it would start.
export function readyRuntime(folder, pin) {
  try {
    if (!fs.existsSync(path.join(folder, 'bin', 'barkpark')) || !fs.existsSync(path.join(folder, 'releases'))) return null;
    const mark = JSON.parse(fs.readFileSync(path.join(folder, 'barkdown-release.json'), 'utf8'));
    return mark?.version === 1 && mark.upstream === pin ? mark : null;
  } catch { return null; }
}

async function download(url, file, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'follow' });
  if (!response.ok) throw Object.assign(new Error(`${url} answered ${response.status}`), { status: response.status });
  const hash = crypto.createHash('sha256'), out = fs.createWriteStream(file);
  for await (const chunk of response.body) { hash.update(chunk); if (!out.write(chunk)) await new Promise(resolve => out.once('drain', resolve)); }
  await new Promise((resolve, reject) => out.end(error => error ? reject(error) : resolve()));
  return hash.digest('hex');
}

// Returns { folder, mark, source: 'present' | 'downloaded' } or throws with a reason a person can act on.
export async function ensureRuntime({ pin = pinOf(), root = appRoot, platform = process.platform, arch = process.arch, base = RELEASES, fetchImpl = globalThis.fetch, log = () => {} } = {}) {
  const folder = runtimeFolder(pin, { root, platform, arch });
  const present = readyRuntime(folder, pin);
  if (present) return { folder, mark: present, source: 'present' };
  if (!PUBLISHED.includes(`${platform}-${arch}`)) throw new Error(`no packaged Barkpark is published for ${platform}-${arch}; choose a built checkout in Settings › Barkpark (docs/LOCAL-BARKPARK.md)`);
  if (fs.existsSync(folder) && fs.readdirSync(folder).length) throw new Error(`${folder} exists but is not the runtime for ${pin.slice(0, 9)}; move it aside and start again`);
  const { asset, archive, sum } = assetUrls(pin, { platform, arch, base });
  const parent = path.dirname(folder); fs.mkdirSync(parent, { recursive: true });
  const work = fs.mkdtempSync(path.join(parent, '.download-'));
  try {
    let expected;
    try { const response = await fetchImpl(sum, { redirect: 'follow' }); if (!response.ok) throw Object.assign(new Error(`${sum} answered ${response.status}`), { status: response.status }); expected = (await response.text()).trim().split(/\s+/)[0]; }
    catch (error) { throw new Error(error.status === 404 ? `runtime-${pin.slice(0, 9)} is not published yet (the runtime workflow runs when app/BARKPARK_REF changes on main); build it with: node scripts/build-runtime-release.mjs <barkpark checkout at ${pin.slice(0, 9)}>` : `could not reach the runtime release: ${error.message}`); }
    if (!/^[0-9a-f]{64}$/.test(expected || '')) throw new Error(`${sum} does not hold a SHA-256`);
    log(`Downloading the packaged Barkpark ${pin.slice(0, 9)} for ${platform}-${arch} (about 150 MB, once per pin)…`);
    const file = path.join(work, asset), actual = await download(archive, file, fetchImpl);
    if (actual !== expected) throw new Error(`${asset} does not match its SHA-256 (expected ${expected.slice(0, 12)}…, got ${actual.slice(0, 12)}…); nothing was installed`);
    const unpacked = path.join(work, 'unpacked'); fs.mkdirSync(unpacked);
    // Relative paths: GNU tar reads "C:\…" as a remote host.
    execFileSync('tar', ['-xzf', asset, '-C', 'unpacked'], { cwd: work, stdio: ['ignore', 'ignore', 'pipe'] });
    const inside = path.join(unpacked, folderName(pin, platform, arch)), mark = readyRuntime(inside, pin);
    if (!mark) throw new Error(`${asset} does not hold a Barkpark runtime stamped ${pin.slice(0, 9)}; nothing was installed`);
    if (fs.existsSync(folder)) fs.rmdirSync(folder);
    fs.renameSync(inside, folder);
    return { folder, mark, source: 'downloaded' };
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
