// The failure helper. It takes the picture with the page's own screenshot call, the one the screenshot check
// watches, then ends the run as failed (exit 1), whatever the picture call did: kept, refused, thrown or stuck.
// A script whose only picture calls are this helper may report 0 checked pictures (tests/screenshot-count.test.mjs).
const LIMIT = 5000;

export async function failureShot(page, file, why) {
  const fail = () => process.exit(1);
  setTimeout(fail, LIMIT + 1000);
  try {
    if (why !== undefined) console.error(why);
    await page.screenshot({ path: file, timeout: LIMIT });
  } catch (error) {
    console.error(`failure picture not kept: ${error?.message ?? error}`);
  } finally {
    fail();
  }
}
