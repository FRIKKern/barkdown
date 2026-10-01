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
