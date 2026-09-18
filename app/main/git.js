// Read-only git access for code review tabs. Nothing here commits, pushes, or approves.
const { execFile } = require('child_process');

function run(root, args, maxBuffer = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: root, maxBuffer, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || error.message || '').trim() || 'git failed'));
      else resolve(stdout);
    });
  });
}

async function isRepo(root) {
  try { return (await run(root, ['rev-parse', '--is-inside-work-tree'])).trim() === 'true'; } catch { return false; }
}

async function status(root) {
  if (!(await isRepo(root))) return { repo: false };
  const [branch, porcelain] = await Promise.all([
    run(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ''),
    run(root, ['status', '--porcelain=v1', '--untracked-files=all']),
  ]);
  const files = porcelain.split('\n').filter(Boolean).map(line => ({ status: line.slice(0, 2).trim() || '??', path: line.slice(3).replace(/^"|"$/g, '') }));
  return { repo: true, branch: branch.trim(), files };
}

function parseDiff(raw) {
  const files = [];
  let file = null;
  let hunk = null;
  for (const line of raw.split('\n')) {
    if (line.startsWith('diff --git')) {
      const m = /diff --git a\/(.*?) b\/(.*)$/.exec(line);
      file = { path: m ? m[2] : line, hunks: [], additions: 0, deletions: 0, binary: false };
      files.push(file);
      hunk = null;
    } else if (!file) {
      continue;
    } else if (line.startsWith('Binary files')) {
      file.binary = true;
    } else if (line.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/.exec(line);
      hunk = { header: line, oldStart: m ? Number(m[1]) : 0, newStart: m ? Number(m[2]) : 0, context: m ? m[3].trim() : '', lines: [] };
      file.hunks.push(hunk);
    } else if (hunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ') || line === '')) {
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      const kind = line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx';
      if (kind === 'add') file.additions++;
      if (kind === 'del') file.deletions++;
      hunk.lines.push({ kind, text: line.slice(1) });
    }
  }
  return files;
}

async function diff(root, options = {}) {
  if (!(await isRepo(root))) return { repo: false, files: [] };
  const args = ['diff', '--no-color', '--no-ext-diff'];
  if (options.base) args.push(options.base);
  else if (options.staged) args.push('--cached');
  if (options.path) args.push('--', options.path);
  let raw = await run(root, args);
  const untracked = [];
  if (!options.base && !options.staged) {
    const porcelain = await run(root, ['status', '--porcelain=v1', '--untracked-files=all']);
    for (const line of porcelain.split('\n')) {
      if (line.startsWith('??')) untracked.push(line.slice(3).replace(/^"|"$/g, ''));
    }
    for (const file of untracked.slice(0, 40)) {
      try { raw += '\n' + (await run(root, ['diff', '--no-color', '--no-index', '--', '/dev/null', file]).catch(e => e.message.startsWith('diff --git') ? e.message : '')); } catch {}
    }
  }
  const files = parseDiff(raw);
  const base = options.base || (options.staged ? 'index' : 'working tree');
  return { repo: true, base, target: options.base ? 'working tree' : 'HEAD', files, raw, untracked };
}

async function log(root, limit = 20) {
  if (!(await isRepo(root))) return [];
  const out = await run(root, ['log', `-${limit}`, '--pretty=format:%h%x1f%s%x1f%an%x1f%ad', '--date=short']);
  return out.split('\n').filter(Boolean).map(line => { const [hash, subject, author, date] = line.split('\x1f'); return { hash, subject, author, date }; });
}

// Undo one file the assistant touched: a tracked file goes back to HEAD, an untracked one is removed.
// Confined to the working folder; refuses outside it or when the folder is not a repository.
async function revertFile(root, rel) {
  const path = require('path');
  const fs = require('fs');
  const abs = path.resolve(root, rel);
  const inside = path.relative(root, abs);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) throw Object.assign(new Error('That path is outside the working folder'), { code: 'outside_folder' });
  if (!(await isRepo(root))) throw Object.assign(new Error('The working folder is not a git repository, so there is no known previous version to restore'), { code: 'not_a_repo' });
  let tracked = true;
  try { await run(root, ['ls-files', '--error-unmatch', '--', inside]); } catch { tracked = false; }
  if (tracked) { await run(root, ['checkout', '--', inside]); return { path: inside, action: 'restored' }; }
  if (fs.existsSync(abs)) { fs.rmSync(abs, { force: true }); return { path: inside, action: 'removed' }; }
  return { path: inside, action: 'absent' };
}

module.exports = { isRepo, status, diff, log, parseDiff, revertFile };
