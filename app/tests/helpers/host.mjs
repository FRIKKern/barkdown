// Recorded, owned platform gaps for live tests (D-hosts). A skip here is visible in the
// chain output as "SKIP <file>: <reason>" and counted by the skip ratchet; it is never silent.
import path from 'node:path';
export function skipUnlessWindows(reason, file = process.argv[1]) {
  if (process.platform === 'win32') return;
  console.log(`SKIP ${path.basename(file)}: ${reason} (host: ${process.platform})`);
  process.exit(0);
}
