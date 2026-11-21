// The environment a test hands the app it launches: this run's own, with the test's changes on top. A script
// that may say "screenshots checked: 0" never names process (tests/lib/zero-read.mjs); it builds its app's
// environment here.
export const appEnv = changes => ({ ...process.env, ...changes });
