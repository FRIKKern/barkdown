// electron-builder's afterSign hook (set by build-mac-app.mjs when it signs with a Developer ID): the signed
// application is notarized through scripts/notarize.mjs and stapled before the zip and the image are built
// from it, in place of electron-builder's own notarization, which gives up at the first dropped connection.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function notarizeAfterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const zip = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}-notarize.zip`);
  execFileSync('ditto', ['-c', '-k', '--keepParent', app, zip]);
  const { notarize } = await import('./notarize.mjs');
  try { await notarize(zip); } finally { fs.rmSync(zip, { force: true }); }
  execFileSync('xcrun', ['stapler', 'staple', app], { stdio: 'inherit' });
};
