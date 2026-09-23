const { fork } = require('node:child_process');
// POSIX authentication gets its own process group. Never signal the app's group.
// Windows uses the stronger existing Job Object host instead.
async function launchLoginProcess({ script, onMessage }) {
  let child;
  try { child = fork(script, [], { detached: true, silent: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }); }
  catch (error) { error.ownedProcessNotDispatched = true; throw error; }
  child.stdout.resume(); child.stderr.resume();
  let resolveReady, rejectReady, resolveFinished, rejectFinished, stopping = false;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const finished = new Promise((resolve, reject) => { resolveFinished = resolve; rejectFinished = reject; });
  ready.catch(() => {}); finished.catch(() => {});
  function stop() {
    if (stopping) return;
    stopping = true;
    if (!child.pid) return;
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if (error.code !== 'ESRCH') rejectFinished(new Error('Sign-in process group could not be stopped')); }
  }
  child.on('message', message => { if (message?.type === 'hello') resolveReady(); else onMessage(message); });
  child.on('error', error => { rejectReady(error); if (!child.pid) resolveFinished(); else stop(); });
  child.on('exit', () => { rejectReady(new Error('Sign-in worker exited')); stop(); });
  child.on('close', () => {
    const deadline = Date.now() + 2000;
    const verify = () => {
      if (!child.pid) return resolveFinished();
      try { process.kill(-child.pid, 0); }
      catch (error) { if (error.code === 'ESRCH') return resolveFinished(); return rejectFinished(error); }
      if (Date.now() >= deadline) return rejectFinished(new Error('Sign-in process group termination is unverified'));
      setTimeout(verify, 25);
    };
    verify();
  });
  return { ready, finished, stop, send: message => { if (!stopping) child.send(message); } };
}
module.exports = { launchLoginProcess };
