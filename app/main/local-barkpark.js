// Lifecycle only; the driver runs the real Barkpark and its migrations.
const { EventEmitter } = require('events');
const { setTimeout: delay } = require('timers/promises');

class LocalBarkpark extends EventEmitter {
  // A runtime is in recovery after `misses` probes in a row fail, not after one: a request that takes
  // seconds under load is not a runtime that stopped answering.
  constructor(driver, { interval = 5000, startupTimeout = 180000, retries = 3, misses = 3 } = {}) {
    super(); Object.assign(this, { driver, interval, startupTimeout, retries, misses });
    this.state = { phase: 'stopped', attempts: 0, error: null }; this.missed = 0;
  }
  status() { return { ...this.state, server: this.driver.server, dataDir: this.driver.dataDir }; }
  update(phase, error = null) { this.state = { ...this.state, phase, error }; this.emit('status', this.status()); }
  start() {
    if (this.operation) return this.operation;
    if (this.state.phase === 'ready') return Promise.resolve(this.status());
    this.abort = new AbortController(); this.state.attempts = 0;
    this.operation = this.boot(this.abort.signal).finally(() => { this.operation = null; });
    return this.operation;
  }
  async boot(signal) {
    try {
      await this.driver.acquire();
      for (;;) {
        signal.throwIfAborted();
        this.update(this.state.attempts ? 'recovering' : 'starting');
        try {
          await this.driver.start(signal);
          const deadline = Date.now() + this.startupTimeout;
          while (Date.now() < deadline) {
            signal.throwIfAborted();
            if (await this.driver.healthy(signal)) {
              this.missed = 0; this.update('ready'); this.schedule(); return this.status();
            }
            await this.driver.checkFailure();
            await delay(Math.min(this.interval, 1000), null, { signal });
          }
          throw new Error('Local Barkpark did not become ready before the startup deadline. See its log.');
        } catch (error) {
          await this.driver.stop();
          signal.throwIfAborted();
          // Restarting cannot make a different PostgreSQL major read this profile.
          if (error.code === 'runtime_database_major') throw error;
          if (++this.state.attempts > this.retries) throw error;
          this.update('recovering', error.message);
          await delay(Math.min(this.interval * this.state.attempts, 10000), null, { signal });
        }
      }
    } catch (error) {
      try { await this.driver.release(); } catch (cleanup) { error = cleanup; }
      if (!signal.aborted) this.update('failed', error.message);
      throw error;
    }
  }
  schedule(soon = false) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.monitor(), soon ? Math.min(this.interval, 1000) : this.interval); this.timer.unref?.();
  }
  async monitor() {
    if (this.abort?.signal.aborted || this.operation) return;
    const signal = this.abort.signal;
    this.operation = (async () => {
      try {
        if (await this.driver.healthy(signal)) { this.missed = 0; this.schedule(); return; }
        signal.throwIfAborted();
        if (++this.missed < this.misses) { this.schedule(true); return; }
        this.missed = 0;
        this.update('recovering', 'Local Barkpark stopped answering; restarting its private runtime.');
        await this.driver.stop();
        if (++this.state.attempts > this.retries) throw new Error('Local Barkpark recovery limit reached. Retry from Settings.');
        await this.boot(signal);
      } catch (error) {
        if (!signal.aborted) { try { await this.driver.release(); } catch (cleanup) { error = cleanup; } this.update('failed', error.message); }
      }
    })().finally(() => { this.operation = null; });
    await this.operation;
  }
  async ready() {
    if (this.state.phase === 'ready') return;
    if (this.operation) await this.operation;
    if (this.state.phase !== 'ready') throw new Error(this.state.error || 'Local Barkpark is not running. Start it in Settings → Barkpark.');
  }
  async stop() {
    clearTimeout(this.timer); this.abort?.abort();
    await this.operation?.catch(() => {});
    this.update('stopping');
    try { await this.driver.stop(); await this.driver.release(); this.update('stopped'); }
    catch (error) { this.update('failed', error.message); throw error; }
  }
}
module.exports = { LocalBarkpark };
