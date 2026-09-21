// One fixture helper for the live suites: the `bp` runner, the tags the publish wall wants, and a
// publish that passes the wall. A current Barkpark refuses a bare paper on publish:
//   * label_spine — a real description and 1–12 registered tags with distinct strengths;
//   * unknown_tag — every tag must exist as a published `tag` document;
//   * duplicate_of — title + tag-name tokens are scored against every published paper (Jaccard ≥ 0.55
//     with ≥ 3 shared tokens refuses), so each fixture needs at least two title words of its own.
// Republishing the SAME slug replaces the paper and is not a duplicate of itself.
import { execFileSync } from 'child_process';

// `bp` with JSON output. Stdin is only piped when there is input: bp refuses "piped stdin is unused".
export const bp = (args, input) => JSON.parse(execFileSync('bp', [...args, '-o', 'json'], {
  ...(input == null ? { stdio: ['ignore', 'pipe', 'pipe'] } : { input: typeof input === 'string' ? input : JSON.stringify(input) }),
  shell: true, encoding: 'utf8', maxBuffer: 20e6,
}));

export const text = value => [{ type: 'text', value }];
export const para = value => ({ type: 'paragraph', content: text(value) });

const DEFAULT_TAGS = [['barkdown', 'Barkdown'], ['scratch', 'Scratch']];

// Register (idempotently) the tags a fixture uses. A refusal is reported, not fatal: the publish below
// says what is still missing.
export function ensureTags(tags = DEFAULT_TAGS) {
  for (const [id, title] of tags) {
    try { bp(['doc', 'create-or-replace', 'tag', '--set', `_id=${id}`, '--set', `title=${title}`]); bp(['doc', 'publish', 'tag', id]); }
    catch (e) { console.error(`tag ${id}: ${(e.stdout || e.message).toString().slice(0, 160)}`); }
  }
}

// publishFixture({ slug, title, description, blocks, tags? }) → the publish result. `title` and
// `description` are required and must be the fixture's own words (the wall's title-token score).
export function publishFixture({ slug, title, description, blocks, tags }) {
  if (!slug || !title || !description) throw new Error('publishFixture needs slug, title and description');
  ensureTags();
  const weighted = tags || [
    { tag: 'barkdown', strength: 90, rationale: 'owned by the Barkdown editor suite' },
    { tag: 'scratch', strength: 40, rationale: 'disposable test fixture, rewritten on every run' },
  ];
  try {
    return bp(['bulldocs', 'publish', slug, '--file', '-', '--yes'], { slug, title, description, tags: weighted, blocks });
  } catch (e) {
    const out = (e.stdout || e.message || '').toString();
    let hint = '';
    if (/duplicate_of/.test(out)) hint = ' — the publish wall scored the title + tag names too close to another paper; give this fixture a title of its own words';
    else if (/label_spine|unknown_tag/.test(out)) hint = ' — the publish wall wants a description and registered tags (see tests/lib/paper-fixture.mjs)';
    throw new Error(`publish of ${slug} refused${hint}:\n${out.slice(0, 600)}`);
  }
}

// The paper as the server holds it (raw perspective).
export function getPaper(slug) { const r = bp(['doc', 'get', 'paper', slug, '--perspective', 'raw']); return r.document || r; }
