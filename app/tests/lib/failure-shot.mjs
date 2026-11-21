// The one way a chain script takes a picture on its way to failing. The picture goes through the page's own
// screenshot call, so the screenshot check looks at it like any other; then the run ends as failed (exit 1),
// whatever the picture call did: kept, refused, thrown or stuck. A script whose only pictures are these calls may
// say "screenshots checked: 0" on a passing run (tests/screenshot-count.test.mjs).
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
