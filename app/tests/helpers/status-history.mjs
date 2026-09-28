import fs from 'node:fs';
import path from 'node:path';

const safeTimestamp = value => String(value || '').replace(/[:.]/g, '-');

export function archiveStatusManifest(outputDir, manifest) {
  if (!manifest?.capturedAt) throw Error('Status manifest history requires capturedAt');
  const history = path.join(outputDir, 'history');
  fs.mkdirSync(history, { recursive: true });
  const target = path.join(history, `${safeTimestamp(manifest.capturedAt)}.json`);
  // uiExemptions are annotations added after a capture (main-process-only commits the
  // pictures need not follow); the archive keeps the manifest as captured, without them.
  const { uiExemptions: _annotations, ...captured } = manifest;
  const bytes = JSON.stringify(captured, null, 2) + '\n';
  try {
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    if (fs.readFileSync(target, 'utf8') !== bytes) throw Error(`Status history collision: ${target}`);
  }
  return target;
}
