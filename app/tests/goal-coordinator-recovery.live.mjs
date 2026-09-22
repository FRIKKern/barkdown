// Run the production coordinator journey with actual main-process death during planning.
process.env.BARKDOWN_TEST_COORDINATOR_CRASH = '1';
await import('./goal-coordinator.live.mjs');
