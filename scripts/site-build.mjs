// The download page (site/) as GitHub Pages serves it: the page, today's status pictures and latest.json, the
// release site/pick.mjs chooses from the repository's releases at build time. .github/workflows/site.yml runs this
// after every Release and on pushes to site/; the page also asks GitHub itself, so a newer release shows at once.
//   node scripts/site-build.mjs <out-folder>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pickRelease } from '../site/pick.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, '.site'));
const repository = process.env.GITHUB_REPOSITORY || 'FRIKKern/barkdown';
const headers = { accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) };
const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=30`, { headers });
if (!response.ok) throw new Error(`GitHub answered ${response.status} for the releases list`);
const offer = pickRelease(await response.json());
if (!offer) throw new Error('No notarized release with both Mac images: the page would have nothing to offer');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'site'), out, { recursive: true });
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
for (const name of ['paper-dark.png', 'paper-light.png', 'quick-open.png', 'slash-menu.png']) fs.copyFileSync(path.join(root, 'docs', 'images', 'status', name), path.join(out, 'shots', name));
fs.copyFileSync(path.join(root, 'app', 'build', 'icon.png'), path.join(out, 'icon.png'));
fs.writeFileSync(path.join(out, 'latest.json'), JSON.stringify(offer, null, 2) + '\n');
console.log(`site: ${out} offers ${offer.tag} (${offer.channel})`);
