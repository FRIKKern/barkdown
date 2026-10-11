// Offline interpretation of explicitly captured HKLM views. This does not read
// the registry, choose a supported minimum or decide whether installation is safe.
const registryPath = 'SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64';
const names = ['Installed', 'Version', 'Major', 'Minor', 'Bld', 'Rbld'];
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw Error('Unsupported registration record shape');
  }
}
function uint(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw Error('Invalid DWORD version component');
  return value;
}
export function parseVcVersion(value) {
  if (typeof value !== 'string' || !/^v?\d{1,10}\.\d{1,10}\.\d{1,10}\.\d{1,10}$/.test(value)) {
    throw Error('Expected four numeric VC version components');
  }
  return value.replace(/^v/, '').split('.').map(part => uint(Number(part)));
}
export function compareVcVersions(left, right) {
  const a = parseVcVersion(left), b = parseVcVersion(right);
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
export function normalizeVcRegistration(record) {
  keys(record, ['hive', 'path', 'architecture', 'views']);
  if (record.hive !== 'HKLM' || record.path !== registryPath || record.architecture !== 'x64') {
    throw Error('Unsupported registry identity');
  }
  if (!Array.isArray(record.views) || record.views.length !== 2) throw Error('Require both explicit registry views');
  const seen = new Set();
  const views = record.views.map(row => {
    keys(row, row.status === 'unreadable' ? ['view', 'status', 'values', 'error'] : ['view', 'status', 'values']);
    if (!['Registry32', 'Registry64'].includes(row.view) || seen.has(row.view)) throw Error('Invalid or duplicate registry view');
    seen.add(row.view);
    if (!Array.isArray(row.values)) throw Error('Expected typed values');
    if (row.status === 'missing' || row.status === 'unreadable') {
      if (row.values.length || (row.status === 'unreadable' && (typeof row.error !== 'string' || !row.error))) {
        throw Error('Invalid unavailable view');
      }
      return { view: row.view, status: row.status, version: null };
    }
    if (row.status !== 'present' || row.values.length !== names.length) throw Error('Invalid present view');
    const values = new Map();
    for (const item of row.values) {
      if (typeof item?.present !== 'boolean') throw Error('Invalid value presence');
      keys(item, item.present ? ['name', 'present', 'kind', 'value'] : ['name', 'present']);
      if (!names.includes(item.name) || values.has(item.name)) throw Error('Invalid or duplicate value name');
      if (item.present) {
        if (item.name === 'Version') {
          if (item.kind !== 'String') throw Error('Version must be REG_SZ');
          parseVcVersion(item.value);
        } else {
          if (item.kind !== 'DWord') throw Error('Numeric value must be REG_DWORD');
          uint(item.value);
          if (item.name === 'Installed' && item.value !== 0 && item.value !== 1) throw Error('Invalid Installed flag');
        }
      }
      values.set(item.name, item);
    }
    if (names.some(name => !values.get(name).present) || values.get('Installed').value !== 1) {
      return { view: row.view, status: 'incomplete', version: null };
    }
    const tuple = ['Major', 'Minor', 'Bld', 'Rbld'].map(name => values.get(name).value);
    if (tuple[0] !== 14 || tuple.some((part, i) => part !== parseVcVersion(values.get('Version').value)[i])) {
      throw Error('Version string and DWORD tuple disagree or family is unsupported');
    }
    return { view: row.view, status: 'registered', version: tuple.join('.') };
  }).sort((a, b) => a.view.localeCompare(b.view));
  const registered = views.filter(row => row.status === 'registered');
  const conflict = registered.length === 2 && registered[0].version !== registered[1].version;
  const status = conflict ? 'conflict' : views.some(row => row.status === 'unreadable') ? 'unreadable' :
    views.every(row => row.status === 'missing') ? 'missing' :
    views.some(row => row.status === 'incomplete') ? 'incomplete' : 'registered';
  return { status, version: status === 'registered' ? registered[0].version : null, views,
    minimumVersion: null, loaderCompatibility: 'unknown', installationReady: 'unknown' };
}
