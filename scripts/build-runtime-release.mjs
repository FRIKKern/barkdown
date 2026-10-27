// Build a packaged Barkpark runtime for Barkdown from a checkout: a production release with
// its own Erlang, stamped with the commit it holds. Barkdown runs it without Elixir or the
// checkout on the machine (app/main/local-barkpark-source.js, "packaged release").
// Usage: node scripts/build-runtime-release.mjs <barkpark checkout> [output folder]
// The checkout must be clean and, for a release Barkdown will ship, at app/BARKPARK_REF.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachPostgres } from './runtime-postgres-bundle.mjs';
import { carryLibraries } from './runtime-macho.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Second form: node scripts/build-runtime-release.mjs --add-postgres <release folder> <postgres folder>
// copies a Postgres built by scripts/build-runtime-postgres.mjs into the release as postgres/,
// so the runtime folder needs nothing from the machine.
if (process.argv[2] === '--add-postgres') {
  const [release, postgres] = process.argv.slice(3).map(value => value && path.resolve(value));
  const markFile = release && path.join(release, 'barkdown-release.json'), pgMark = postgres && path.join(postgres, 'barkdown-postgres.json');
  if (!release || !postgres || !fs.existsSync(markFile) || !fs.existsSync(pgMark)) { console.error('Usage: --add-postgres <release built by this script> <postgres built by build-runtime-postgres.mjs>'); process.exit(2); }
  try { attachPostgres(release, postgres); } catch (error) { console.error(error.message); process.exit(2); }
  console.log('Release now carries ' + path.basename(postgres));
  process.exit(0);
}
// Third form: node scripts/build-runtime-release.mjs --carry-libraries <release folder> brings a folder
// built before the check below up to it (libraries from this machine copied in beside what loads them).
if (process.argv[2] === '--carry-libraries') {
  const release = process.argv[3] && path.resolve(process.argv[3]);
  if (!release || !fs.existsSync(path.join(release, 'barkdown-release.json'))) { console.error('Usage: --carry-libraries <release built by this script>'); process.exit(2); }
  try { carry(release); } catch (error) { console.error(error.message); process.exit(2); }
  process.exit(0);
}
// A Mac runtime links nothing outside itself and macOS (scripts/runtime-macho.mjs); the libraries it
// carried are named in its stamp, so a notice or a later rebuild can see where they came from.
function carry(release) {
  if (process.platform !== 'darwin') return;
  const carried = carryLibraries(release), markFile = path.join(release, 'barkdown-release.json');
  const mark = JSON.parse(fs.readFileSync(markFile, 'utf8'));
  mark.carried = [...(mark.carried || []), ...carried];
  fs.writeFileSync(markFile, JSON.stringify(mark, null, 2) + '\n');
  for (const c of carried) console.log(`Carried ${c.library} as ${c.to}`);
}
const [checkoutArg, outArg] = process.argv.slice(2);
if (!checkoutArg) { console.error('Usage: node scripts/build-runtime-release.mjs <barkpark checkout> [output folder]'); process.exit(2); }
if (process.platform === 'win32') { console.error('The upstream release is assembled for unix hosts only; on Windows Barkdown still runs the checkout.'); process.exit(2); }
const checkout = path.resolve(checkoutArg), api = path.join(checkout, 'api');
if (!fs.existsSync(path.join(api, 'mix.exs'))) { console.error('Not a Barkpark checkout: ' + checkout); process.exit(2); }
const git = args => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
const upstream = git(['rev-parse', 'HEAD']);
if (git(['status', '--porcelain', '--untracked-files=no'])) { console.error('The checkout has uncommitted changes; a release is stamped with one commit.'); process.exit(2); }
const pin = fs.readFileSync(path.join(root, 'app', 'BARKPARK_REF'), 'utf8').trim();
const out = path.resolve(outArg || path.join(root, 'runtime', `barkpark-${upstream.slice(0, 9)}-${process.platform}-${process.arch}`));
if (fs.existsSync(out) && fs.readdirSync(out).length) { console.error('The output folder is not empty; nothing is overwritten: ' + out); process.exit(2); }
const env = { ...process.env, MIX_ENV: 'prod' };
const run = args => execFileSync('mix', args, { cwd: api, env, stdio: ['ignore', 'inherit', 'inherit'] });
run(['deps.get', '--only', 'prod']);
run(['release', 'barkpark', '--overwrite', '--path', out]);
const erts = fs.readdirSync(out).find(name => name.startsWith('erts-')) || null;
const mark = { version: 1, upstream, matchesPin: upstream === pin, builtAt: new Date().toISOString(), platform: process.platform, arch: process.arch, os: os.release(), erts };
fs.writeFileSync(path.join(out, 'barkdown-release.json'), JSON.stringify(mark, null, 2) + '\n');
carry(out);
console.log(`Packaged Barkpark ${upstream.slice(0, 9)} (${erts}) at ${out}${mark.matchesPin ? '' : '\nNote: this is not the commit Barkdown is pinned to (' + pin.slice(0, 9) + ').'}`);
