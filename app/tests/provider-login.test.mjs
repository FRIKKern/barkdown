import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createProviderLogin } = require('../main/provider-login');
const { resolveProviderCli, commandArgs, authenticated, statusState } = require('../main/provider-cli');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function harness(options = {}) {
  const ready = deferred(), finished = deferred(), launched = deferred();
  let onMessage, calls=0, sends=[], stops=0;
  const host = { ready: ready.promise, finished: finished.promise, send: m => sends.push(m), stop: () => { stops++; } };
  const service = createProviderLogin({storeDir: os.tmpdir(), platform:'win32', ...options, launch: async options => { calls++; onMessage=options.onMessage; return launched.promise; }});
  return {service,ready,finished,launched,host,result: state => onMessage({type:'result',state}),get calls(){return calls;},get sends(){return sends;},get stops(){return stops;}};
}
test('fixed commands and strict successful status avoid shell input and malformed status', () => {
  assert.deepEqual(commandArgs('codex','login'),['login']);
  assert.deepEqual(commandArgs('claude','status'),['auth','status','--json']);
  assert.throws(()=>commandArgs('codex; bad','login'));
  assert.equal(authenticated('claude',0,'{"loggedIn":false}'),false);
  assert.equal(authenticated('claude',0,'bad data'),false);
  assert.equal(authenticated('claude',1,'{"loggedIn":true}'),false);
  assert.equal(authenticated('claude',0,'{"loggedIn":true}'),true);
  assert.equal(authenticated('codex',0,'discarded account details'),true);
  assert.equal(statusState('codex',1,'Not logged in\n'),'signed-out');
  assert.equal(statusState('codex',1,'credential storage unavailable'),'failed');
  assert.equal(statusState('claude',0,'malformed status'),'failed');
  assert.equal(statusState('claude',1,'{"loggedIn":false}'),'signed-out');
});
test('resolver ignores relative PATH and Windows shell wrappers', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-login-cli-'));
  fs.writeFileSync(path.join(root,'claude.cmd'),'not a native executable');
  const options={platform:'win32',env:{PATH:'.'+path.delimiter+root},home:root};
  assert.equal(resolveProviderCli('claude',options),null);
  fs.writeFileSync(path.join(root,'claude.exe'),'fixture');
  assert.equal(resolveProviderCli('claude',options),path.join(root,'claude.exe'));
  assert.throws(()=>resolveProviderCli('arbitrary',options));
});
test('double start reuses one operation and success waits for verified job drain', async () => {
  const h=harness(), first=await h.service.start('codex');
  assert.equal((await h.service.start('codex')).id,first.id); assert.equal(h.calls,1);
  h.launched.resolve(h.host);h.ready.resolve();await new Promise(setImmediate);
  assert.deepEqual(h.sends,[{type:'start',provider:'codex',operation:'login'}]);
  h.result('signed-in');assert.equal(h.service.status('codex').state,'waiting');assert.equal(h.service.hasSessions(),true);
  h.finished.resolve();await new Promise(setImmediate);
  assert.equal(h.service.status('codex').state,'signed-in');assert.equal(h.service.hasSessions(),false);
});
test('cancel during launch prevents login dispatch and waits for cleanup',async()=>{
  const h=harness(), first=await h.service.start('claude');let done=false;
  const cancellation=h.service.cancel('claude',first.id).then(()=>{done=true;});
  h.launched.resolve(h.host);h.ready.resolve();await new Promise(setImmediate);
  assert.equal(h.sends.length,0);assert.ok(h.stops);assert.equal(done,false);
  h.finished.resolve();await cancellation;assert.equal(h.service.status('claude').state,'cancelled');
});
test('stale cancellation cannot stop a later login and shutdown prevents new launches',async()=>{
  const h=harness(), first=await h.service.start('codex');
  await assert.rejects(h.service.cancel('codex','another-id'),/changed/);assert.equal(h.stops,0);
  h.launched.resolve(h.host);h.ready.resolve();await new Promise(setImmediate);
  const shutdown=h.service.shutdown();h.finished.resolve();await shutdown;
  await assert.rejects(h.service.start('claude'),/closing/);
  assert.equal(h.service.status('codex').id,first.id);
});
test('unverified cleanup remains visible and cannot be replaced by another operation',async()=>{
  const h=harness(), first=await h.service.start('codex');h.launched.resolve(h.host);h.ready.resolve();await new Promise(setImmediate);
  h.result('signed-in');h.finished.reject(new Error('fixture receipt mismatch'));await new Promise(setImmediate);
  assert.equal(h.service.status('codex').state,'shutdown-unverified');assert.equal(h.service.hasSessions(),true);
  assert.equal((await h.service.start('codex')).id,first.id);assert.equal(h.calls,1);
  await assert.rejects(h.service.shutdown(),/shutdown could not be verified/);
});
test('missing executable and provider failure remain explicit without emitting raw output',async()=>{
  for (const state of ['unavailable','failed','signed-out']) {
    const h=harness();await h.service.start('claude');h.launched.resolve(h.host);h.ready.resolve();await new Promise(setImmediate);
    h.result(state);h.finished.resolve();await new Promise(setImmediate);
    assert.equal(h.service.status('claude').state,state);
    assert.deepEqual(Object.keys(h.service.status('claude')).sort(),['id','operation','provider','state']);
  }
});

test('timeout waits for owned cleanup and cannot turn a late successful result into success', async()=>{
  const h=harness({loginTimeout:10});await h.service.start('codex');h.launched.resolve(h.host);h.ready.resolve();
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(h.service.status('codex').state,'timed-out');assert.ok(h.stops);assert.equal(h.service.hasSessions(),true);
  h.result('signed-in');h.finished.resolve();await new Promise(setImmediate);
  assert.equal(h.service.status('codex').state,'timed-out');assert.equal(h.service.hasSessions(),false);
});

test('startup known not dispatched permits retry, uncertain startup remains blocked',async()=>{
  for(const known of [true,false]) {
    const h=harness();await h.service.start('claude');h.launched.reject(Object.assign(Error('fixture startup failure'),{ownedProcessNotDispatched:known}));await new Promise(setImmediate);
    assert.equal(h.service.status('claude').state,known?'failed':'shutdown-unverified');assert.equal(h.service.hasSessions(),!known);
  }
});

test('POSIX authentication host verifies its own process group stopped', {skip:process.platform==='win32',timeout:10000},async()=>{
  const {launchLoginProcess}=require('../main/provider-login-process');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bd-auth-posix-')),script=path.join(root,'worker.cjs');
  fs.writeFileSync(script,"process.send({type:'hello'});process.on('message',()=>process.send({type:'result',state:'signed-in'}));setInterval(()=>{},1000);\n");
  const result=deferred();const host=await launchLoginProcess({script,onMessage:message=>result.resolve(message)});
  try{await host.ready;host.send({type:'start'});assert.equal((await result.promise).state,'signed-in');}finally{host.stop();await host.finished;}
});
