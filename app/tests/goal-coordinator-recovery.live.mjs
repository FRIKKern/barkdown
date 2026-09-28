import { skipUnlessWindows } from './helpers/host.mjs';
skipUnlessWindows("owned goal process host is Windows-only (main/goal-process.js job objects); POSIX twin pending");
// Run the production coordinator journey with actual main-process death during planning.
process.env.BARKDOWN_TEST_COORDINATOR_CRASH = '1';
await import('./goal-coordinator.live.mjs');
