// The part of a release that is arithmetic: which version and tag a channel gets from the tags that
// exist, which tag the notes compare against, and which nightly a stable promotes. Pure, so it is
// tested without a repository (scripts/release-plan.test.mjs); scripts/release.mjs feeds it facts.
const NIGHTLY = /^v(\d+\.\d+\.\d+)-nightly\.(\d{8})\.(\d+)$/, STABLE = /^v\d+\.\d+\.\d+$/;
export const isNightlyTag = tag => NIGHTLY.test(tag), isStableTag = tag => STABLE.test(tag);
// app/package.json holds the NEXT stable version: a nightly previews it, a stable releases it.
export function planRelease({ channel, tags, manifestVersion, date, from = null, version = null }) {
  const nightlies = tags.filter(isNightlyTag), stables = tags.filter(isStableTag);
  if (channel === 'nightly') {
    if (!/^\d+\.\d+\.\d+$/.test(manifestVersion)) throw new Error(`app/package.json version must be X.Y.Z, not ${manifestVersion}`);
    const n = nightlies.filter(t => t.startsWith(`v${manifestVersion}-nightly.${date}.`)).length + 1;
    const v = `${manifestVersion}-nightly.${date}.${n}`;
    return { channel, version: v, tag: 'v' + v, previousTag: nightlies[0] || null, fromTag: null, prerelease: true };
  }
  if (channel === 'stable') {
    const fromTag = from || nightlies[0];
    if (!fromTag) throw new Error('no nightly to promote; cut one first');
    if (!isNightlyTag(fromTag)) throw new Error(`${fromTag} is not a nightly tag`);
    const v = version || NIGHTLY.exec(fromTag)[1];
    if (!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('a stable version is X.Y.Z');
    return { channel, version: v, tag: 'v' + v, previousTag: stables[0] || null, fromTag, prerelease: false };
  }
  throw new Error('channel is nightly or stable');
}
export const nextPatch = version => { const [a, b, c] = version.split('.').map(Number); return `${a}.${b}.${c + 1}`; };
// Whether a scheduled nightly is due: new commits on main since the last nightly, and at least six
// hours since it was cut. A manual nightly skips this. `isAncestor(lastSha, headSha)` says whether the
// last nightly's commit is behind HEAD.
export const NIGHTLY_GAP_MS = 6 * 60 * 60 * 1000;
export function nightlyDue({ lastNightly = null, headSha, isAncestor, now = Date.now() }) {
  if (!lastNightly) return { due: true, reason: 'no nightly yet' };
  const age = now - Date.parse(lastNightly.at);
  if (age < NIGHTLY_GAP_MS) return { due: false, reason: `the last nightly ${lastNightly.tag} is ${Math.round(age / 60000)} minutes old; six hours must pass` };
  if (lastNightly.sha === headSha) return { due: false, reason: `${lastNightly.tag} already shipped ${headSha.slice(0, 9)}` };
  if (!isAncestor(lastNightly.sha, headSha)) return { due: false, reason: `${lastNightly.tag} is not behind ${headSha.slice(0, 9)}; nothing to ship from here` };
  return { due: true, reason: `new commits since ${lastNightly.tag} and the gap has passed` };
}
// One updater feed for both Mac architectures. electron-builder writes <channel>-mac.yml per build, each
// listing its own zip and image; electron-updater on an Apple silicon Mac takes the file whose name holds
// "arm64" and on an Intel Mac one whose name does not, so the release carries one feed with every file.
// The feed's top-level path/sha512 (read by updaters older than the files list) stay the first feed's.
export function mergeMacFeeds(feeds) {
  const parse = text => {
    const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n'), start = lines.indexOf('files:');
    if (start < 0) throw new Error('a feed without a files list');
    let end = start + 1; while (end < lines.length && lines[end].startsWith('  ')) end++;
    const files = []; for (const line of lines.slice(start + 1, end)) { if (line.startsWith('  - ')) files.push([line]); else files.at(-1).push(line); }
    const version = /^version: (.+)$/m.exec(text)?.[1];
    if (!version) throw new Error('a feed without a version');
    return { version, head: lines.slice(0, start + 1), files, tail: lines.slice(end) };
  };
  const parsed = feeds.map(parse);
  if (new Set(parsed.map(p => p.version)).size !== 1) throw new Error(`the feeds name different versions: ${parsed.map(p => p.version).join(', ')}`);
  const files = parsed.flatMap(p => p.files), urls = files.map(f => f[0].slice(4));
  if (new Set(urls).size !== urls.length) throw new Error('two feeds list the same file: ' + urls.join(', '));
  return [...parsed[0].head, ...files.flat(), ...parsed[0].tail].join('\n') + '\n';
}

// A stable also carries each image under a name without its version, so the README's
// releases/latest/download/Barkdown-arm64.dmg always serves the newest stable. Nightlies are never "latest".
export const fixedImages = (channel, stages) => channel === 'stable' ? stages.map(st => ({ image: st.image, fixed: `Barkdown-${st.arch}.dmg` })) : [];
