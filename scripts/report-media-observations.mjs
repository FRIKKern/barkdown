import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareMediaObservations } from './media-ownership-observations.mjs';
export function writeMediaObservationReport(inputFile, outputFile) {
  if (!path.isAbsolute(inputFile) || !path.isAbsolute(outputFile) || path.resolve(inputFile) === path.resolve(outputFile)) throw Error('Require distinct absolute input/output paths');
  const stat = fs.lstatSync(inputFile);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) throw Error('Require bounded regular JSON observations');
  // Parse and validate before opening output; wx refuses existing files, including
  // links and aliases. Never operate on the media named inside these observations.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(inputFile));
  const report = compareMediaObservations(JSON.parse(text));
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('Usage: node scripts/report-media-observations.mjs <absolute-input.json> <new-absolute-output.json>');
    const r = writeMediaObservationReport(process.argv[2], process.argv[3]);
    console.log(JSON.stringify({ status: r.status, counts: r.counts, collectionComplete: false, reconciled: false }));
  } catch (error) { console.error(error.code || 'media_observations_refused', error.message); process.exitCode = 1; }
}
