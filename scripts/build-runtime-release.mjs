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
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
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
console.log(`Packaged Barkpark ${upstream.slice(0, 9)} (${erts}) at ${out}${mark.matchesPin ? '' : '\nNote: this is not the commit Barkdown is pinned to (' + pin.slice(0, 9) + ').'}`);
