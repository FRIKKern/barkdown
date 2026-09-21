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
function inventory(root) {
  const files = [];
  function visit(directory, prefix = '') {
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Linked build directories are unsupported; choose a regular built checkout');
    for (const name of fs.readdirSync(directory).sort()) {
      const relative = prefix ? `${prefix}/${name}` : name, file = path.join(directory, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) throw new Error('Linked build artifacts are unsupported; choose a regular built checkout');
      if (stat.isDirectory()) visit(file, relative);
      else if (stat.isFile()) files.push({ path: relative, size: stat.size, sha256: sha(fs.readFileSync(file)) });
      else throw new Error('Unsupported build artifact');
    }
  }
  visit(root); return files;
}
function verifyPayload(root, files) {
  // Mix may update its private .mix metadata even with --no-compile. Executable
  // and priv payload must remain byte-identical to the selected built source.
  const payload = list => list.filter(f => !f.path.split('/').includes('.mix'));
  if (JSON.stringify(payload(inventory(root))) !== JSON.stringify(payload(files))) throw new Error('Private runtime build payload changed; inspect before reuse');
}
function prepareRuntimeBuild(source, dataDir, { checkpoint = () => {} } = {}) {
  noLinkedAncestors(source); noLinkedAncestors(dataDir);
  const built = path.join(source, 'api', '_build', 'dev');
  const files = inventory(built);
  const fingerprint = sha(JSON.stringify({ source: fs.realpathSync.native(source), files }));
  const cache = path.join(dataDir, 'runtime-build'), target = path.join(cache, fingerprint), marker = path.join(cache, `${fingerprint}.json`);
  noLinkedAncestors(cache); noLinkedAncestors(target);
  fs.mkdirSync(cache, { recursive: true });
  if (fs.existsSync(target)) {
    const manifest = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (manifest.version !== 1 || manifest.fingerprint !== fingerprint || JSON.stringify(manifest.files) !== JSON.stringify(files)) throw new Error('Private build manifest is invalid');
    verifyPayload(target, files);
    return { path: target, fingerprint };
  }
  const staged = path.join(cache, 'staging-' + crypto.randomUUID());
  fs.mkdirSync(staged);
  fs.cpSync(built, staged, { recursive: true, dereference: false, errorOnExist: true, force: false });
  checkpoint('copied');
  if (JSON.stringify(inventory(built)) !== JSON.stringify(files)) throw new Error('Built source changed while copying; staged artifacts retained, runtime not started');
  verifyPayload(staged, files);
  fs.writeFileSync(marker, JSON.stringify({ version: 1, source: fs.realpathSync.native(source), fingerprint, files }, null, 2));
  fs.renameSync(staged, target);
  return { path: target, fingerprint };
}
module.exports = { prepareRuntimeBuild };
