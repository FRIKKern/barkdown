import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { compareMediaObservations } from './media-ownership-observations.mjs';
const require = createRequire(import.meta.url), { powershell, systemRoot, systemTool } = require('../app/main/windows-system-tools');
const native = fileURLToPath(new URL('./windows-media-file-observation.ps1', import.meta.url));
function shape(v, keys, label) { if (!v || Object.getPrototypeOf(v) !== Object.prototype || Object.keys(v).sort().join('\0') !== [...keys].sort().join('\0')) throw Error('Unsupported ' + label); }
export function validateWindowsFileRequest(v) {
  shape(v, ['version', 'root', 'rootIdentity', 'key', 'region', 'maxBytes'], 'file request');
  shape(v.rootIdentity, ['volume', 'inode'], 'root identity');
  if (v.version !== 1 || typeof v.root !== 'string' || !v.root.isWellFormed() || !/^[A-Z]:\\/.test(v.root) || v.root.endsWith('\\') || v.root.length > 24000 || path.win32.normalize(v.root) !== v.root) throw Error('Unsupported root path');
  const parts = v.root.slice(3).split('\\');
  // Reuse conservative physical-key rules for root segments and the supplied key.
  for (const key of [...parts, v.key]) {
    compareMediaObservations({ version: 1, source: { id: 'file-request-validation', platform: 'win32' }, bounds: { maxRows: 1, maxFiles: 1 }, rows: [], files: [{ key, region: v.region, state: 'unsupported', bytes: null, sha256: null, identity: null }] });
    if (key.split('/').some(s => /^(?:COM|LPT)[¹²³](?:\.|$)/i.test(s))) throw Error('Reserved native device segment');
  }
  for (const field of ['volume', 'inode']) if (typeof v.rootIdentity[field] !== 'string' || v.rootIdentity[field].length > 20 || !/^(0|[1-9]\d*)$/.test(v.rootIdentity[field])) throw Error('Invalid root identity');
  if (BigInt(v.rootIdentity.volume) > 0xffffffffn || BigInt(v.rootIdentity.inode) < 1n || BigInt(v.rootIdentity.inode) > 0xffffffffffffffffn) throw Error('Unsupported root identity');
  if (!Number.isSafeInteger(v.maxBytes) || v.maxBytes < 1 || v.maxBytes > 64 * 1024 * 1024) throw Error('Unsupported byte bound');
  return structuredClone(v);
}
export function observeWindowsMediaFile(input) {
  const request = validateWindowsFileRequest(input);
  if (process.platform !== 'win32') throw Error('Windows native observation unavailable');
  const temp = fs.realpathSync(os.tmpdir());
  if (temp.toLowerCase() === request.root.toLowerCase() || temp.toLowerCase().startsWith(request.root.toLowerCase() + '\\')) throw Error('Media root overlaps private execution storage');
  const executionRoot = fs.mkdtempSync(path.join(temp, 'Barkdown file observation '));
  const env = { PATH: [systemTool(''), systemRoot()].join(';'), SystemRoot: systemRoot(), WINDIR: systemRoot(), ComSpec: systemTool('cmd.exe'), TEMP: executionRoot, TMP: executionRoot,
    USERPROFILE: executionRoot, APPDATA: executionRoot, LOCALAPPDATA: executionRoot, PSModuleAnalysisCachePath: path.join(executionRoot, 'ModuleAnalysisCache') };
  const result = spawnSync(powershell(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', native], { env, input: Buffer.from(JSON.stringify(request), 'utf8'), windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw Error('Native file observation refused: ' + new TextDecoder('utf-8', { fatal: true }).decode(result.stderr || Buffer.alloc(0)).slice(0, 4096));
  const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(result.stdout).trim());
  shape(raw, ['state', 'reason', 'win32Error', 'bytes', 'sha256', 'identity', 'finalPath'], 'native observation');
  if (typeof raw.reason !== 'string' || (raw.win32Error !== null && (!Number.isInteger(raw.win32Error) || raw.win32Error < 0)) || (raw.finalPath !== null && typeof raw.finalPath !== 'string')) throw Error('Invalid native diagnostics');
  const file = { key: request.key, region: request.region, state: raw.state, bytes: raw.bytes, sha256: raw.sha256, identity: raw.identity };
  compareMediaObservations({ version: 1, source: { id: 'bounded-windows-handle', platform: 'win32' }, bounds: { maxRows: 1, maxFiles: 1 }, rows: [], files: [file] });
  if (file.state === 'readable' && (file.bytes > request.maxBytes || raw.win32Error !== null || raw.finalPath !== '\\\\?\\' + path.win32.join(request.root, request.key.replaceAll('/', '\\')))) throw Error('Native result exceeds bound or path binding');
  return { version: 1, file, diagnostics: raw, rootDeclaration: request.rootIdentity, executionRoot, collectionComplete: false, reconciled: false, deletionAllowed: false, recoveryAllowed: false,
    limitations: ['One explicitly selected offline NTFS file; no full directory inventory or runtime writer lease', 'Caller supplies root identity and region; declarations do not grant trusted ownership', 'Windows volume serial and64-bit NTFS index are scoped identities, not global clone-safe provenance', 'Other filesystems/path aliases/reparse/offline/hardlinks/bounds remain unsupported; native errors retain uncertainty', 'No general filesystem race/network/ACL/remote-storage or production adoption acceptance'] };
}
