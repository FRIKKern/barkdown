const fs = require('node:fs'),
  { spawn } = require('node:child_process');
const [marker, role = 'root'] = process.argv.slice(2);
const children = [];
if (role !== 'leaf')
  children.push(
    spawn(process.execPath, [__filename, marker, role === 'root' ? 'child' : 'leaf'], {
      windowsHide: true,
      stdio: 'ignore',
    }),
  );
fs.appendFileSync(marker, JSON.stringify({ role, pid: process.pid }) + '\n');
setInterval(() => fs.appendFileSync(marker + '.effects', role + '\n'), 50);
