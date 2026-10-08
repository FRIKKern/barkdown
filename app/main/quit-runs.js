// Retain driver acknowledgements across quit attempts: a finished run leaves
// the live registry even when its cleanup failed. Absence is not a receipt.
function createQuitRuns({ runs, agent }) {
  const completions = new Map();
  function settle() {
    const owned = [...runs.values()];
    for (const run of owned) {
      if (completions.has(run.id)) continue;
      const { id, chatId, provider } = run, profileId = run.scope.profileId;
      let pending;
      try { pending = agent.waitForRunFinish(run.id); }
      catch (error) { pending = Promise.reject(error); }
      const completion = Promise.resolve(pending).then(result => {
        if (!result || result.runId !== id || result.profileId !== profileId || result.chatId !== chatId || result.provider !== provider) {
          throw refusal('Run completion ownership mismatch');
        }
        if (result.cleanupFailed || result.status === 'cleanup-failed') throw refusal('Run cleanup is unconfirmed');
        return result;
      });
      completion.catch(() => {});
      completions.set(run.id, completion);
    }
    for (const run of owned) agent.cancel(run.id);
    return Promise.all(completions.values());
  }
  return Object.freeze({ settle });
}

function refusal(message) {
  const error = new Error(message);
  error.code = 'QUIT_RUN_UNCONFIRMED';
  return error;
}

module.exports = { createQuitRuns };
