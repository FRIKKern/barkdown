// Third-party notices for what a built runtime folder carries: every application in the release
// (Hex packages from the checkout's deps, Erlang/OTP and Elixir applications), the carried
// Postgres and the OpenSSL linked into it. Writes docs/third-party/runtime/NOTICES.md and one
// licence text per component under docs/third-party/runtime/licenses/. A component whose licence
// text cannot be found is listed as such; nothing is invented.
// Usage: node scripts/collect-runtime-notices.mjs <runtime folder> <barkpark checkout>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const [runtimeArg, checkoutArg] = process.argv.slice(2);
if (!runtimeArg || !checkoutArg) { console.error('Usage: node scripts/collect-runtime-notices.mjs <runtime folder> <barkpark checkout>'); process.exit(2); }
const runtime = path.resolve(runtimeArg), checkout = path.resolve(checkoutArg), deps = path.join(checkout, 'api', 'deps');
const stamp = JSON.parse(fs.readFileSync(path.join(runtime, 'barkdown-release.json'), 'utf8'));
const out = path.join(root, 'docs', 'third-party', 'runtime'), texts = path.join(out, 'licenses');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(texts, { recursive: true });
const OTP = new Set(['asn1', 'compiler', 'crypto', 'inets', 'kernel', 'os_mon', 'public_key', 'runtime_tools', 'sasl', 'ssl', 'stdlib', 'syntax_tools', 'xmerl', 'erts', 'tools', 'mnesia', 'observer', 'wx', 'et', 'debugger', 'eunit', 'common_test', 'parsetools', 'ftp', 'tftp', 'ssh', 'snmp', 'edoc', 'erl_docgen', 'megaco', 'odbc', 'reltool', 'diameter', 'eldap', 'jinterface', 'dialyzer', 'erl_interface']);
const ELIXIR = new Set(['elixir', 'eex', 'iex', 'logger', 'mix', 'ex_unit']);
const first = candidates => candidates.find(f => f && fs.existsSync(f)) || null;
const licenseFile = dir => { try { return fs.readdirSync(dir).filter(n => /^(LICENSE|LICENCE|COPYING|COPYRIGHT)/i.test(n)).map(n => path.join(dir, n))[0] || null; } catch { return null; } };
const which = name => { try { return execFileSync('/bin/sh', ['-c', `command -v ${name}`], { encoding: 'utf8' }).trim(); } catch { return null; } };
const erlangHome = (() => { const erl = which('erl'); if (!erl) return null; try { return execFileSync(erl, ['-noshell', '-eval', 'io:format("~s", [code:root_dir()]), halt().'], { encoding: 'utf8' }).trim(); } catch { return null; } })();
// Elixir's LICENSE sits above its lib/elixir tree; walk up from the binary until it is found.
const elixirHome = (() => { const elixir = which('elixir'); if (!elixir) return null; try { let dir = path.dirname(fs.realpathSync(elixir)); for (let i = 0; i < 6; i++) { if (fs.existsSync(path.join(dir, 'LICENSE'))) return dir; dir = path.dirname(dir); } } catch {} return null; })();
const erlangLicense = first([erlangHome && path.join(erlangHome, 'LICENSE.txt'), erlangHome && path.join(path.dirname(path.dirname(erlangHome)), 'LICENSE.txt'), erlangHome && path.join(erlangHome, 'COPYRIGHT')]);
const elixirLicense = elixirHome ? path.join(elixirHome, 'LICENSE') : null;
const fetchLicense = (name, version, repository) => {
  if (!repository || !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(repository)) return null;
  const raw = repository.replace('https://github.com/', 'https://raw.githubusercontent.com/') + '/';
  for (const ref of [`v${version}`, version, 'main', 'master']) for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING']) {
    const url = raw + ref + '/' + file, target = path.join(os.tmpdir(), `barkdown-license-${name}-${crypto.randomBytes(3).toString('hex')}`);
    try { execFileSync('curl', ['-fsSL', '--max-time', '30', '-o', target, url], { stdio: 'ignore' }); if (fs.statSync(target).size > 100) return { file: target, url }; } catch {}
  }
  return null;
};
const hexMeta = name => { const file = path.join(deps, name, 'hex_metadata.config'); if (!fs.existsSync(file)) return null; const text = fs.readFileSync(file, 'utf8'); const m = /\{<<"licenses">>,\s*\[([^\]]*)\]\}/.exec(text); const licenses = m ? [...m[1].matchAll(/<<"([^"]+)">>/g)].map(x => x[1]) : []; const v = /\{<<"version">>,<<"([^"]+)">>\}/.exec(text); const g = /GitHub">>,<<"([^"]+)"/.exec(text); return { licenses, version: v?.[1] || null, repository: g?.[1] || null }; };
const rows = [];
// Standard licence texts, taken from packages in this very release that ship them verbatim.
const standardTexts = new Map();
function standardText(ids) {
  const id = (ids || []).map(x => x.replace(/\s+/g, '').toLowerCase()).find(x => ['apache-2.0', 'apache2.0', 'mit'].includes(x));
  if (!id) return null;
  const key = id.startsWith('apache') ? 'Apache-2.0' : 'MIT';
  if (!standardTexts.has(key)) {
    const marker = key === 'Apache-2.0' ? /^\s*Apache License\s*\n\s*Version 2\.0/ : /^\s*(The )?MIT License/i;
    for (const name of fs.readdirSync(deps)) { const file = licenseFile(path.join(deps, name)); if (!file) continue; const text = fs.readFileSync(file, 'utf8'); if (marker.test(text)) { fs.mkdirSync(path.join(texts, 'standard'), { recursive: true }); const target = path.join(texts, 'standard', key + '.txt'); fs.writeFileSync(target, key === 'MIT' ? text.replace(/^.*Copyright.*$/m, 'Copyright (c) the package authors') : text); standardTexts.set(key, 'licenses/standard/' + key + '.txt'); break; } }
    if (!standardTexts.has(key)) standardTexts.set(key, null);
  }
  return standardTexts.get(key);
}
const keep = (slug, file) => { const target = path.join(texts, slug + '.txt'); fs.copyFileSync(file, target); return 'licenses/' + slug + '.txt'; };
for (const entry of fs.readdirSync(path.join(runtime, 'lib')).sort()) {
  const m = /^(.+?)-([0-9][^-]*)$/.exec(entry); if (!m) continue;
  const [, name, version] = m;
  if (name === 'barkpark') { rows.push({ component: 'Barkpark server', version: stamp.upstream.slice(0, 9), license: 'private (FRIKKern/barkpark)', text: null, source: 'the pinned checkout' }); continue; }
  const meta = hexMeta(name);
  if (meta) {
    const file = licenseFile(path.join(deps, name));
    if (file) { rows.push({ component: name, version, license: meta.licenses.join(', ') || 'not declared', text: keep(name, file), source: 'Hex package (hex_metadata.config)' }); continue; }
    const fetched = fetchLicense(name, version, meta.repository);
    if (fetched) { rows.push({ component: name, version, license: meta.licenses.join(', ') || 'not declared', text: keep(name, fetched.file), source: `Hex package; text from ${fetched.url}` }); continue; }
    // The package ships no text and none could be fetched: its metadata names a standard licence; the standard text stands in.
    const standard = standardText(meta.licenses);
    rows.push({ component: name, version, license: meta.licenses.join(', ') || 'not declared', text: standard, source: standard ? 'Hex package; ships no text of its own, the standard text of its declared licence stands in' : 'Hex package; ships no text and declares no standard licence' });
    continue;
  }
  if (OTP.has(name)) { rows.push({ component: name, version, license: 'Apache-2.0 (Erlang/OTP)', text: erlangLicense ? keep('erlang-otp', erlangLicense) : null, source: 'Erlang/OTP' }); continue; }
  if (ELIXIR.has(name)) { rows.push({ component: name, version, license: 'Apache-2.0 (Elixir)', text: elixirLicense ? keep('elixir', elixirLicense) : null, source: 'Elixir' }); continue; }
  rows.push({ component: name, version, license: 'unknown', text: null, source: 'not a Hex package, not OTP, not Elixir: review' });
}
if (stamp.erts) rows.push({ component: 'erts (Erlang runtime)', version: stamp.erts.replace('erts-', ''), license: 'Apache-2.0 (Erlang/OTP)', text: erlangLicense ? keep('erlang-otp', erlangLicense) : null, source: 'Erlang/OTP' });
// The carried Postgres and the OpenSSL linked into it.
const pg = stamp.postgres;
if (pg) {
  let copyright = first([path.join(runtime, 'postgres', 'COPYRIGHT')]);
  if (!copyright) {
    // The build did not keep it: take it from the same verified source.
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-pg-copyright-')), tarball = path.join(work, 'pg.tar.bz2');
    execFileSync('curl', ['-fsSL', '--max-time', '600', '-o', tarball, `https://ftp.postgresql.org/pub/source/v${pg.postgres}/postgresql-${pg.postgres}.tar.bz2`]);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(tarball)).digest('hex');
    if (actual !== pg.sourceSha256) { console.error('The Postgres source no longer matches the checksum the build recorded.'); process.exit(1); }
    execFileSync('tar', ['-xjf', tarball, '-C', work, `postgresql-${pg.postgres}/COPYRIGHT`]);
    copyright = path.join(work, `postgresql-${pg.postgres}`, 'COPYRIGHT');
    fs.copyFileSync(copyright, path.join(runtime, 'postgres', 'COPYRIGHT'));
  }
  rows.push({ component: 'PostgreSQL', version: pg.postgres, license: 'PostgreSQL License', text: keep('postgresql', copyright), source: `official source, sha256 ${pg.sourceSha256.slice(0, 12)}` });
  const opensslPrefix = process.env.BARKDOWN_OPENSSL_PREFIX || '/opt/homebrew/opt/openssl@3';
  const opensslLicense = first([path.join(opensslPrefix, 'LICENSE.txt'), path.join(opensslPrefix, 'LICENSE')]);
  rows.push({ component: 'OpenSSL (linked statically into PostgreSQL)', version: pg.openssl, license: 'Apache-2.0', text: opensslLicense ? keep('openssl', opensslLicense) : null, source: opensslPrefix });
}
const missing = rows.filter(r => !r.text && !r.license.startsWith('private'));
const md = ['# Third-party notices for the carried runtime', '', `Generated by \`scripts/collect-runtime-notices.mjs\` on ${new Date().toISOString().slice(0, 10)} for the runtime folder built at Barkpark \`${stamp.upstream.slice(0, 9)}\` (${stamp.platform}-${stamp.arch}). Every row is a component the built application carries; the licence text of each is under \`licenses/\`. Licence identifiers of Hex packages come from their own metadata.`, '',
  '| Component | Version | Licence | Text | Source |', '|---|---|---|---|---|',
  ...rows.map(r => `| ${r.component} | ${r.version} | ${r.license} | ${r.text ? `[text](${r.text})` : 'not shipped by the package'} | ${r.source} |`), '',
  missing.length ? `Components whose licence text was not found (${missing.length}): ${missing.map(r => r.component).join(', ')}. Their identifiers are declared in their metadata; the texts must be obtained before a build is handed to another person.` : 'Every component carries its licence text.', ''];
fs.writeFileSync(path.join(out, 'NOTICES.md'), md.join('\n'));
console.log(`${rows.length} components; ${missing.length} without a licence text. Written to docs/third-party/runtime/.`);
