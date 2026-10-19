// Independent non-author documentation review of the C108 checkpoint (draft PR 81).
//
// Reads the retained records and checks the handoff's and the PR body's claims against them:
// every result.json named in the cycle record is parsed for its status and step exit codes; the
// writer-syntax catalog's counts and timings are re-read from its review.json; every relative
// Markdown link in the handoff, the cycle record and the catalog README must resolve; the published
// checkpoint and the hosted run are compared with GitHub. Nothing is executed or re-run: this is a
// reading of claims against evidence, which is what the "independent non-author documentation
// review" the cycle names can honestly be. Writes review.json and README.md into the output
// directory; refuses an existing one.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const out = process.argv[2];
if (!out) { console.error("usage: node scripts/c108-independent-review.mjs <new-output-directory>"); process.exit(2); }
if (fs.existsSync(out)) { console.error(`refusing to overwrite ${out}`); process.exit(2); }

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const findings = [];
const note = (check, status, detail) => findings.push({ check, status, detail });

// 1. Every evidence path the cycle record lists exists. Result files come in three kinds and the
// cycle keeps all three on purpose (failures are retained, never deleted): run-steps receipts of a
// full root run (verify-NN/result.json) must have passed with exit-0 steps; records the handoff
// names as retained failures (a "-failed" directory, a "failed-root-result") must read as failed;
// everything else is an observational record whose status is a named outcome, not pass/fail.
const cycle = json("docs/cycle.json");
const handoffCycle = read("docs/cycles/C108-windows-media-custody.md");
let missing = 0;
const receipts = [], retainedFailures = [], observational = [], broken = [];
for (const p of cycle.evidence) {
  if (!fs.existsSync(path.join(root, p))) { missing++; continue; }
  if (!/result\.json$/.test(p)) continue;
  let r;
  try { r = json(p); } catch (e) { broken.push({ path: p, error: e.message }); continue; }
  const steps = r.steps || [];
  const badSteps = steps.filter((st) => st.status !== "passed" || (st.exitCode != null && st.exitCode !== 0));
  if (/\/verify-\d+\/result\.json$/.test(p)) {
    // A failed full-root receipt is kept too; it is honest only if the cycle handoff names it as a failure.
    const passed = r.status === "passed" && badSteps.length === 0;
    const named = handoffCycle.split("\n").some((line) => line.includes(p.replace("docs/cycles/", "")) && /fail/i.test(line));
    receipts.push({ path: p, ok: passed || named, passed, status: r.status });
  }
  else if (/failed/.test(p)) retainedFailures.push({ path: p, ok: r.status === "failed" || badSteps.length > 0, status: r.status });
  else observational.push({ path: p, status: r.status ?? null, ok: r.status !== "running" });
}
note("cycle evidence paths exist", missing === 0 ? "pass" : "fail", `${cycle.evidence.length} listed, ${missing} missing`);
note("every full-root receipt (verify-NN) passed with exit-0 steps, or is a failure the handoff names", receipts.every((r) => r.ok) && broken.length === 0 ? "pass" : "fail", `${receipts.length} receipts, ${receipts.filter((r) => r.passed).length} passed${receipts.filter((r) => !r.passed).length ? "; retained failures named in the handoff: " + receipts.filter((r) => !r.passed && r.ok).map((r) => r.path.replace("docs/cycles/evidence/C108/", "")).join(", ") : ""}${receipts.filter((r) => !r.ok).length ? "; FAILED AND UNNAMED: " + receipts.filter((r) => !r.ok).map((r) => r.path).join(", ") : ""}${broken.length ? "; unreadable: " + broken.map((b) => b.path).join(", ") : ""}`);
note("retained failures read as failures (kept, not hidden)", retainedFailures.every((r) => r.ok) ? "pass" : "fail", retainedFailures.map((r) => `${r.path.replace("docs/cycles/evidence/C108/", "")}=${r.status}`).join(", ") || "none listed");
note("observational records carry a named outcome and none is still running", observational.every((r) => r.ok) ? "pass" : "fail", `${observational.length} records; ${observational.filter((r) => !r.ok).length} running`);

// 2. The catalog's numbers as the handoff/PR state them.
const catalog = json("docs/cycles/evidence/C108/writer-syntax-catalog-01/review.json");
const s = catalog.summary || {};
const claimed = { files: 47, frozenSourceFiles: 42, privateCandidateTextFiles: 5, sites: 3296, definitions: 1193, rawAliases: 153, parserMs: 489, toolLifecycleMs: 8683 };
const mismatches = Object.entries(claimed).filter(([k, v]) => s[k] !== v).map(([k, v]) => `${k}: claimed ${v}, recorded ${s[k]}`);
note("writer-syntax catalog counts and timings match the handoff and PR body", mismatches.length === 0 ? "pass" : "fail", mismatches.join("; ") || "47/42+5/3296/1193/153/489ms/8683ms");
note("catalog is self-described as bounded (no execution, no complete census)", /never executed|not executed|neither a complete/i.test(read("docs/cycles/evidence/C108/writer-syntax-catalog-01/README.md")) ? "pass" : "fail", "README states source bodies were not executed and the listing is not a complete census");

// 3. The final full root run the handoff cites.
const v82 = json("docs/cycles/evidence/C108/verify-82/result.json");
const v82ms = v82.finishedAt && v82.startedAt ? new Date(v82.finishedAt) - new Date(v82.startedAt) : null;
note("verify-82 passed and its duration is within 1s of the claimed 105560ms", v82.status === "passed" && v82ms != null && Math.abs(v82ms - 105560) < 1000 ? "pass" : "warn", `status ${v82.status}, measured ${v82ms}ms`);

// 4. Links in the handoff, the cycle record and the catalog README resolve.
const linkRe = /\]\(([^)\s]+)\)/g;
const checkLinks = (file) => {
  const text = read(file);
  const dir = path.dirname(path.join(root, file));
  const broken = [];
  let total = 0;
  for (const m of text.matchAll(linkRe)) {
    const href = m[1];
    total++;
    if (/^https?:/.test(href) || href.startsWith("#") || href.startsWith("mailto:")) continue;
    const target = path.resolve(dir, href.split("#")[0]);
    if (!fs.existsSync(target)) broken.push(href);
  }
  return { total, broken };
};
for (const file of ["docs/NEXT-AGENT.md", "docs/cycles/C108-windows-media-custody.md", "docs/cycles/evidence/C108/writer-syntax-catalog-01/README.md"]) {
  const { total, broken } = checkLinks(file);
  note(`relative links resolve in ${file}`, broken.length === 0 ? "pass" : "fail", `${total} links, ${broken.length} broken${broken.length ? ": " + broken.slice(0, 5).join(", ") : ""}`);
}

// 5. The published checkpoint and the hosted run, as GitHub reports them now.
const gh = (args) => { try { return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); } catch (e) { return null; } };
const pr81 = gh(["pr", "view", "81", "-R", "FRIKKern/barkdown", "--json", "headRefOid,isDraft,state", "-q", ".headRefOid+\" \"+(.isDraft|tostring)+\" \"+.state"]);
note("PR 81 head is the handoff's checkpoint da787d2c and the PR is still a draft", pr81 && pr81.startsWith("da787d2cd9fc7ebed75f87c2738aaf34a5656e82") && /true OPEN/.test(pr81) ? "pass" : "warn", pr81 || "gh unavailable");
const run = gh(["run", "view", "39015787079", "-R", "FRIKKern/barkdown", "--json", "status,conclusion,headSha", "-q", ".status+\"/\"+.conclusion+\" @\"+.headSha"]);
note("hosted Verify run 39015787079 concluded success", run && /completed\/success/.test(run) ? "pass" : "warn", run || "gh unavailable");
const pr23205 = gh(["pr", "view", "23205", "-R", "FRIKKern/barkpark", "--json", "isDraft,state,mergeable", "-q", ".state+\" draft=\"+(.isDraft|tostring)+\" \"+.mergeable"]);
note("Barkpark PR 23205 is open, a draft, and unmerged (no adoption happened)", pr23205 && /OPEN draft=true/.test(pr23205) ? "pass" : "warn", pr23205 || "gh unavailable");

// 6. The handoff's own limits are stated, not implied.
const handoff = read("docs/NEXT-AGENT.md");
note("handoff states no merge/deploy/adoption and task 0 of 4", /no further merge\/deploy\/private adoption authorized/i.test(handoff) && /task0of4|task 0 of 4/i.test(handoff) ? "pass" : "fail", "limits present in the current handoff");

const status = findings.some((f) => f.status === "fail") ? "findings" : "reviewed";
const record = { at: new Date().toISOString(), reviewer: "Claude Fable 5.1 (non-author; the C108 author is Codex)", scope: "documentation and evidence consistency of the C108 checkpoint (draft PR 81) and the state of Barkpark PR 23205; no proof re-run, no source change, no merge", status, findings, limits: ["Nothing was executed: native, HTTP, PostgreSQL and verify proofs are read from their retained result files, not reproduced", "Counts are compared with the records the author produced; this review cannot establish that the catalog is complete or that runtime settlement is proven — the records themselves say it is not", "PR 23205's code was not reviewed for correctness here; its documentation claims are reviewed in the companion README", "GitHub states are observations at the time of the review"] };
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "review.json"), JSON.stringify(record, null, 2) + "\n");
const lines = findings.map((f) => `- **${f.status}** — ${f.check}: ${f.detail}`).join("\n");
fs.writeFileSync(path.join(out, "README.md"), `# Independent non-author review of the C108 checkpoint\n\nReviewer: Claude (Fable 5.1); the cycle's author is Codex. Read-only: claims in the handoff, the cycle record and draft PR 81 were checked against the retained records and GitHub; nothing was re-run.\n\nResult: **${status}**.\n\n${lines}\n\nLimits: ${record.limits.join(" · ")}\n\nProduced by \`node scripts/c108-independent-review.mjs\` at ${record.at}.\n`);
console.log(JSON.stringify({ status, findings: findings.map((f) => [f.status, f.check]) }, null, 1));
process.exit(status === "reviewed" ? 0 : 1);
