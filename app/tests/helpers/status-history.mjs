import fs from 'node:fs';
import path from 'node:path';

const safeTimestamp = value => String(value || '').replace(/[:.]/g, '-');

export function archiveStatusManifest(outputDir, manifest) {
  if (!manifest?.capturedAt) throw Error('Status manifest history requires capturedAt');
  const history = path.join(outputDir, 'history');
  fs.mkdirSync(history, { recursive: true });
  const target = path.join(history, `${safeTimestamp(manifest.capturedAt)}.json`);
  const bytes = JSON.stringify(manifest, null, 2) + '\n';
  try {
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    if (fs.readFileSync(target, 'utf8') !== bytes) throw Error(`Status history collision: ${target}`);
  }
  return target;
}
