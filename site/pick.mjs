// Which release the download page offers, shared by the page (live check) and scripts/site-build.mjs (latest.json
// written at deploy). The newest stable wins; until one exists, the newest nightly. Only a release that carries an
// image for both Macs and whose notes say it is notarized counts: older nightlies were signed ad hoc.
const NIGHTLY = /^v\d+\.\d+\.\d+-nightly\.\d{8}\.\d+$/, STABLE = /^v\d+\.\d+\.\d+$/;
const ARCHES = ['arm64', 'x64'];

export function pickRelease(releases) {
  // A stable also carries version-free copies (Barkdown-arm64.dmg) for releases/latest/download; offer the named one.
  const image = (release, arch) => release.assets.find(a => a.name.endsWith(`-${arch}.dmg`) && a.name !== `Barkdown-${arch}.dmg`);
  const usable = releases.filter(r => !r.draft && (STABLE.test(r.tag_name) || NIGHTLY.test(r.tag_name)) && /notarized by Apple/.test(r.body || '') && ARCHES.every(arch => image(r, arch)));
  const newest = list => list.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  const release = newest(usable.filter(r => STABLE.test(r.tag_name))) || newest(usable);
  if (!release) return null;
  const sums = release.assets.find(a => a.name === 'SHA256SUMS');
  const offer = { tag: release.tag_name, version: release.tag_name.slice(1), channel: STABLE.test(release.tag_name) ? 'stable' : 'nightly', published: release.published_at, page: release.html_url, sums: sums ? sums.browser_download_url : null };
  for (const arch of ARCHES) { const a = image(release, arch); offer[arch] = { name: a.name, url: a.browser_download_url, mb: Math.round(a.size / 1048576) }; }
  return offer;
}
