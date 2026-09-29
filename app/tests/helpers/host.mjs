// Recorded, owned platform gaps for live tests (D-hosts). A skip here is visible in the
// chain output as "SKIP <file>: <reason>" and counted by the skip ratchet; it is never silent.
import path from 'node:path';
export function skipUnlessWindows(reason, file = process.argv[1]) {
  if (process.platform === 'win32') return;
  // Investigation only: BARKDOWN_HOST_SKIPS=off runs the Windows-only tour on this host to see what its twin needs.
  if (process.env.BARKDOWN_HOST_SKIPS === 'off') { console.log(`RUN ${path.basename(file)} despite: ${reason} (host: ${process.platform}, BARKDOWN_HOST_SKIPS=off)`); return; }
  console.log(`SKIP ${path.basename(file)}: ${reason} (host: ${process.platform})`);
  process.exit(0);
}
