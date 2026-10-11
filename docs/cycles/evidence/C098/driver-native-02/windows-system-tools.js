const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
// Packaged runtimes deliberately remove developer PATH. These are OS tools, not dependencies.
const systemRoot = () => process.env.SystemRoot || 'C:\\Windows';
const systemTool = name => path.join(systemRoot(), 'System32', name);
const powershell = () => systemTool(path.join('WindowsPowerShell', 'v1.0', 'powershell.exe'));
const shortPaths = new Map();
function nativePath(file) {
  if (process.platform !== 'win32' || /^[\x00-\x7f]*$/.test(file)) return file;
  // PostgreSQL's Windows bootstrap embeds its native installation path in UTF8 SQL.
  // Use the OS's existing ASCII alias, never copy/rebind a profile or create a junction.
  const same = alias => {
    const original=fs.statSync(file,{bigint:true}), resolved=fs.statSync(alias,{bigint:true});
    return original.dev===resolved.dev && original.ino===resolved.ino;
  };
  const cached=shortPaths.get(file);
  if (cached && same(cached)) return cached;
  const code=`Add-Type -TypeDefinition 'using System; using System.Text; using System.Runtime.InteropServices; public static class BarkdownShortPath { [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern uint GetShortPathName(string p,StringBuilder s,uint n); }'; $b=New-Object System.Text.StringBuilder 32768; $n=[BarkdownShortPath]::GetShortPathName($env:BARKDOWN_NATIVE_PATH,$b,32768); if ($n -eq 0 -or $n -ge 32768) { exit 2 }; Write-Output $b.ToString()`;
  const alias=execFileSync(powershell(),['-NoProfile','-NonInteractive','-Command',code],{env:{...process.env,BARKDOWN_NATIVE_PATH:file},encoding:'utf8',windowsHide:true,timeout:15000}).trim();
  if (!alias || !/^[\x20-\x7e]+$/.test(alias) || !same(alias)) throw Object.assign(new Error('The carried PostgreSQL folder needs an ASCII installation path or existing Windows short names. Move the runtime folder to an ASCII path; profile data was not moved.'),{code:'runtime_native_path'});
  shortPaths.set(file,alias);return alias;
}
module.exports = { systemRoot, systemTool, powershell, nativePath };
