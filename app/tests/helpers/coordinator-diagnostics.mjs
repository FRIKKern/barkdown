import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export function descendants(rows, rootPid) {
  const owned = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) if (owned.has(row.ParentProcessId) && !owned.has(row.ProcessId)) {
      owned.add(row.ProcessId); changed = true;
    }
  }
  return rows.filter(row => owned.has(row.ProcessId));
}

// Fixture diagnostics never collect command lines, environment or unrelated process rows.
export async function coordinatorDiagnostics({ store, rootPid, stderr, platform = process.platform, readProcesses }) {
  const result = { capturedAt: new Date().toISOString(), rootPid, stderr, files: [] };
  if (store) {
    try {
      const dir = path.join(store, 'goal-processes');
      for (const name of fs.readdirSync(dir).filter(name => /\.(launch|receipt)\.json$/.test(name))) {
        try { result.files.push({ name, value: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) }); }
        catch (error) { result.files.push({ name, error: error.message }); }
      }
    } catch (error) { result.filesError = error.message; }
  }
  if (platform === 'win32' && Number.isInteger(rootPid)) {
    try {
      const read = readProcesses || (async () => {
        const { stdout } = await promisify(execFile)(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
          ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CreationDate | ConvertTo-Json -Compress'],
          { windowsHide: true, timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' });
        return JSON.parse(stdout.replace(/^\uFEFF/, ''));
      });
      const rows = await read();
      result.processes = descendants(Array.isArray(rows) ? rows : [rows], rootPid);
    } catch (error) { result.processesError = error.message; }
  }
  return result;
}
