import test from 'node:test';
import assert from 'node:assert/strict';
import discovery from '../main/provider-discovery.js';

test('initial keyring discovery waits, shares work and tracks explicit rechecks', async () => {
  let release; const gate = new Promise(resolve => { release=resolve; });
  const states = {claude:'idle',codex:'idle'}, calls=[];
  const service = {status:provider=>({state:states[provider]}),async check(provider){calls.push(provider);await gate;states[provider]=provider==='claude'?'signed-in':'signed-out';}};
  const found = discovery.createProviderDiscovery({service:()=>service,env:{}});
  assert.equal(found.available('claude'),false);
  const first=found.initialize(); assert.equal(found.initialize(),first);
  assert.deepEqual(calls,['claude','codex']); release(); await first;
  assert.equal(found.available('claude'),true); assert.equal(found.available('codex'),false);
  states.claude='signed-out'; assert.equal(found.available('claude'),false);
  await found.initialize(); assert.equal(calls.length,2);
});

test('failed inspection is not a signed-in claim and supported environment credentials remain available', async () => {
  const service = {status:()=>({state:'failed'}),async check(){throw Error('unavailable');}};
  const found = discovery.createProviderDiscovery({service:()=>service,env:{}});
  await found.initialize(); assert.equal(found.available('claude'),false);
  for (const name of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','CLAUDE_CODE_OAUTH_TOKEN']) {
    const envFound=discovery.createProviderDiscovery({service:()=>service,env:{[name]:'synthetic'}});
    assert.equal(envFound.available('claude'),true); assert.equal(envFound.available('codex'),false);
  }
  assert.equal(discovery.createProviderDiscovery({service:()=>service,env:{CODEX_API_KEY:'synthetic'}}).available('codex'),true);
});
