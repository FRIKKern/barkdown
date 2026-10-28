// Apple's notary service, with patience. A submission is polled rather than waited on in one call, so a
// dropped connection (a hosted runner logged "The Internet connection appears to be offline" mid-wait) or a
// slow queue (a new team's first images took over 90 minutes) costs a retry, not the release. Uses the
// APPLE_API_KEY (path to the .p8), APPLE_API_KEY_ID and APPLE_API_ISSUER the build is signed under.
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function notarize(file, { minutes = 120, poll = 30000, retry = 60000, log = console.log } = {}) {
  const key = ['--key', process.env.APPLE_API_KEY, '--key-id', process.env.APPLE_API_KEY_ID, '--issuer', process.env.APPLE_API_ISSUER];
  const tool = (...args) => { const r = spawnSync('xcrun', ['notarytool', ...args, ...key, '--output-format', 'json'], { encoding: 'utf8' }); try { return JSON.parse(r.stdout); } catch { return { failed: (r.stderr || r.stdout || '').trim().slice(0, 300) }; } };
  const name = path.basename(file);
  let id = null;
  for (let attempt = 1; !id; attempt++) {
    const submitted = tool('submit', file);
    id = submitted.id || null;
    if (id) break;
    if (attempt === 3) throw new Error(`notarytool could not submit ${name}: ${submitted.failed || JSON.stringify(submitted)}`);
    log(`notarize: submitting ${name} failed (${submitted.failed || JSON.stringify(submitted)}); again in a minute`);
    await sleep(retry);
  }
  log(`notarize: ${name} submitted as ${id}`);
  const started = Date.now();
  for (let unreadable = 0; ;) {
    await sleep(poll);
    const info = tool('info', id);
    if (info.status === 'Accepted') { log(`notarize: ${name} accepted after ${Math.round((Date.now() - started) / 60000)} minutes`); return id; }
    if (info.status && info.status !== 'In Progress') {
      const record = spawnSync('xcrun', ['notarytool', 'log', id, ...key], { encoding: 'utf8' });
      throw new Error(`Apple did not accept ${name} (${info.status}, ${id}):\n${record.stdout || record.stderr}`);
    }
    // A failed read (no status) is a connection that dropped, not a verdict; say so now and then.
    if (!info.status && ++unreadable % 10 === 1) log(`notarize: could not read ${id} (${info.failed}); still asking`);
    if (Date.now() - started > minutes * 60000) throw new Error(`Apple had not finished ${name} (${id}) after ${minutes} minutes`);
  }
}
