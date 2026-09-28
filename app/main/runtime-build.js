// A private copy of already-built artifacts keeps Mix's OS build lock and
// mutable compiler metadata out of the shared source checkout. Never compiles.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function noLinkedAncestors(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Linked runtime build paths are unsupported');
    if (path.dirname(current) === current) break;
  }
}
async function inventory(root) {
  const files = [];
  async function visit(directory, prefix = '') {
    if ((await fs.promises.lstat(directory)).isSymbolicLink()) throw new Error('Linked build directories are unsupported; choose a regular built checkout');
    for (const name of (await fs.promises.readdir(directory)).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name, file = path.join(directory, name), stat = await fs.promises.lstat(file);
      if (stat.isSymbolicLink()) throw new Error('Linked build artifacts are unsupported; choose a regular built checkout');
      if (stat.isDirectory()) await visit(file, relative);
      else if (stat.isFile()) files.push({ path: relative, size: stat.size, sha256: sha(await fs.promises.readFile(file)) });
      else throw new Error('Unsupported build artifact');
    }
  }
  await visit(root); return files;
}
async function verifyPayload(root, files) {
  // Mix may update its private .mix metadata even with --no-compile. Executable
  // and priv payload must remain byte-identical to the selected built source.
  const payload = list => list.filter(f => !f.path.split('/').includes('.mix'));
  if (JSON.stringify(payload(await inventory(root))) !== JSON.stringify(payload(files))) throw new Error('Private runtime build payload changed; inspect before reuse');
}
async function prepareRuntimeBuild(source, dataDir, { checkpoint = () => {} } = {}) {
  noLinkedAncestors(source); noLinkedAncestors(dataDir);
  const built = path.join(source, 'api', '_build', 'dev');
  const files = await inventory(built);
  const fingerprint = sha(JSON.stringify({ source: fs.realpathSync.native(source), files }));
  const cache = path.join(dataDir, 'runtime-build'), target = path.join(cache, fingerprint), marker = path.join(cache, `${fingerprint}.json`);
  noLinkedAncestors(cache); noLinkedAncestors(target);
  fs.mkdirSync(cache, { recursive: true });
  if (fs.existsSync(target)) {
    const manifest = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (manifest.version !== 1 || manifest.fingerprint !== fingerprint || JSON.stringify(manifest.files) !== JSON.stringify(files)) throw new Error('Private build manifest is invalid');
    await verifyPayload(target, files);
    return { path: target, fingerprint };
  }
  const staged = path.join(cache, 'staging-' + crypto.randomUUID());
  // cp creates the staging directory itself: with errorOnExist, Node on macOS refuses a
  // pre-created destination even when it is empty, while Windows and Linux accept it.
  await fs.promises.cp(built, staged, { recursive: true, dereference: false, errorOnExist: true, force: false });
  checkpoint('copied');
  if (JSON.stringify(await inventory(built)) !== JSON.stringify(files)) throw new Error('Built source changed while copying; staged artifacts retained, runtime not started');
  await verifyPayload(staged, files);
  fs.writeFileSync(marker, JSON.stringify({ version: 1, source: fs.realpathSync.native(source), fingerprint, files }, null, 2));
  fs.renameSync(staged, target);
  return { path: target, fingerprint };
}
module.exports = { prepareRuntimeBuild };
