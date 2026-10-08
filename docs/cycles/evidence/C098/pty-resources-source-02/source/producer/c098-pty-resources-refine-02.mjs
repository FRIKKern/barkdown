import fs from 'node:fs';
const read=f=>fs.readFileSync(f,'utf8');
const prior=JSON.parse(read('docs/cycles/evidence/C098/pty-resources-native-01/result.json'));if(prior.status!=='passed'||!prior.inputsUnchanged)throw Error('Prior run not closed');
let probe=read('.git/c098-pty-resource-probe-01.exs');
const old='  record.(Map.merge(receipt, %{status: "component-observed", late_messages: inspect(elem(Process.info(self(), :messages), 1)), lifecycle_accepted: false}))';
if(!probe.includes(old))throw Error('Probe layout changed');
probe=probe.replace(old,`  record.(Map.merge(receipt, %{status: "measure", phase: "wrappers-stopped"}))
  C098PtyResourceProbe.wait_file(Path.join(data, "ack-wrappers-stopped"), nonce, System.monotonic_time(:millisecond) + 30000)
`+old);
fs.writeFileSync('.git/c098-pty-resource-probe-02.exs',probe,{flag:'wx'});
let parent=read('.git/c098-pty-resources-native-01.mjs').replaceAll('pty-resources-native-01','pty-resources-native-02').replaceAll('pty-resources-source-01','pty-resources-source-02').replaceAll('c098-pty-resource-probe-01.exs','c098-pty-resource-probe-02.exs');
parent=parent.replace("'.git/c098-pty-resources-body-01.txt'", "'.git/c098-pty-resources-body-01.txt','.git/c098-pty-resources-refine-02.mjs'");
const step=" component=await waitFile(path.join(data,'component.json'),r=>r.status==='component-observed',10000);";
if(!parent.includes(step))throw Error('Parent layout changed');
parent=parent.replace(step,` component=await waitFile(path.join(data,'component.json'),r=>r.status==='measure'&&r.phase==='wrappers-stopped',10000);assert.equal(component.children.length,3);for(const r of component.children)assert.equal(r.pty_stopped,true);
 await sample('wrappers-stopped');fs.writeFileSync(path.join(data,'ack-wrappers-stopped'),nonce,{flag:'wx'});
`+step);
fs.writeFileSync('.git/c098-pty-resources-native-02.mjs',parent,{flag:'wx'});
console.log(JSON.stringify({priorElapsedMs:prior.elapsedMs,reason:'Observe resources after all three GenServers stop, before BEAM exit; prior samples precede current wrapper stop'}));
