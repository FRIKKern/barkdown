// This pin records a reviewed whole-archive/member/text association, not a
// reproducible build or a compiled source revision. No archive tool or DLL runs.
import fs from 'node:fs';
const pin = JSON.parse(fs.readFileSync(new URL('./windows-winpthreads-pin.json', import.meta.url)));

function exact(actual, expected) {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected).sort();
  return JSON.stringify(Object.keys(actual).sort()) === JSON.stringify(keys) && keys.every(key => exact(actual[key], expected[key]));
}

export function bindWinpthreadsPublisher(artifacts, payload, keep) {
  if (artifacts === undefined) return [];
  if (!Array.isArray(artifacts) || artifacts.length !== 1 || !exact(artifacts[0], pin)) throw Error('Unsupported/changed winpthreads publisher association');
  const native = payload.find(row => row.path === pin.native.path);
  if (!native || !exact(native, pin.native)) throw Error('Winpthreads publisher native bytes differ from payload');
  const texts = pin.files.map(file => keep(structuredClone(file), {
    component: pin.component, source: pin.url, artifact: pin.artifact,
    archiveSha256: pin.archive.sha256, archivePath: file.archivePath,
    sourceRevision: null, kind: 'publisher'
  }));
  // Callers may annotate reports; do not expose mutable aliases to the pin.
  return structuredClone([{component:pin.component,artifact:pin.artifact,source:pin.url,archive:pin.archive,native:pin.native,members:pin.members,texts,sourceRevision:null,
    limits:['Exact reviewed publisher artifact/native/notice association; archive authenticity is HTTPS origin and observed digest, not a vendor signature',
      'Compiled source revision and patches remain unresolved; publisher toolchain label is not the library source version']}]);
}
