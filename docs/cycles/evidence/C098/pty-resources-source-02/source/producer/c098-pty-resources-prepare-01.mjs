import fs from 'node:fs';
let resolver=fs.readFileSync('.git/c098-nif-resolve-01.ps1','utf8');
const begin=resolver.indexOf('  $taskChild=TaskIdentity');
const end=resolver.indexOf("  [IO.File]::WriteAllText($taskOut+'/result.json'");
if(begin<0||end<0)throw Error('Resolver layout changed');
resolver=resolver.slice(0,begin)+`  $taskChild=$null;$taskChildParent=$null
  if($null -ne $taskInput.child) {
    $taskChild=TaskIdentity $taskInput.child.pid
    if($taskChild.startedAt -cne $taskInput.child.startedAt -or -not [string]::Equals($taskChild.path,$taskInput.child.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Terminal child identity mismatch'}
    $taskChildRow=Get-CimInstance Win32_Process -Filter ('ProcessId='+$taskChild.pid)
    if($null -eq $taskChildRow -or $taskChildRow.ParentProcessId -ne $taskBeam.pid){throw 'Terminal child is outside owned BEAM'}
    $taskChildParent=[int]$taskChildRow.ParentProcessId
  }
  $taskResult=[pscustomobject]@{status='passed';observedAt=[DateTime]::UtcNow.ToString('o');launcher=$taskLauncher;ancestry=$taskChain;child=$taskChild;childParentPid=$taskChildParent;targets=@([pscustomobject]@{role='beam';pid=$taskBeam.pid;startedAt=$taskBeam.startedAt;path=$taskBeam.path})}
`+resolver.slice(end);
resolver=resolver.replace("  $taskBeam=TaskIdentity $taskInput.beamPid", "  if(-not [string]::Equals($taskLauncher.path,$taskInput.launcher.path,[StringComparison]::OrdinalIgnoreCase)){throw 'Launcher executable identity mismatch'}\n  $taskBeam=TaskIdentity $taskInput.beamPid");
fs.writeFileSync('.git/c098-pty-resources-resolve-01.ps1',resolver,{flag:'wx'});
let text=fs.readFileSync('.git/c098-nif-native-01.mjs','utf8');
text=text.replaceAll('nif-native-01','pty-resources-native-01').replaceAll('nif-source-01','pty-resources-source-01').replaceAll('crt-detection-review-02','baseline-review-01');
text=text.replace("const sourceFiles=", "const sourceFiles=");
const a=text.indexOf('const sourceFiles=');const b=text.indexOf(';const inputs=',a);
text=text.slice(0,a)+"const sourceFiles=['.git/c098-pty-resources-native-01.mjs','.git/c098-pty-resources-prepare-01.mjs','.git/c098-pty-resource-probe-01.exs','.git/c098-pty-metrics-01.ps1','.git/c098-pty-resources-resolve-01.ps1','.git/c098-nif-child-01.ps1','.git/c098-nif-identity-01.ps1','.git/c098-modules-observer-01.ps1','app/main/local-barkpark-launch.ps1','app/main/windows-system-tools.js','app/main/local-barkpark-source.js']"+text.slice(b);
text=text.replaceAll('.git/c098-nif-probe-01.exs','.git/c098-pty-resource-probe-01.exs').replace('Barkdown NIF Chø ','Barkdown PTY resources Chø ');
const limA=text.indexOf('limits:['),limB=text.indexOf(']},save=',limA);
text=text.slice(0,limA)+"limits:['Actual carried ExPTY component eval, not SourceDriver server/GUI/Studio tmux or ordinary installation','Three natural child exits with explicit owned identity/absence checks; callbacks sampled for 500ms, prior 15second callback proof remains separate','BEAM CPU ticks/thread/handle counts sampled twice per phase; CPU normalized to one logical processor, no causal or whole-machine percentage claim','Current disk module hashes are not mapped-memory/dynamic closure/ABI/minimum proof','Fresh disposable data/device/cache/cwd; no database/HTTP/provider/account/real-profile/library/sibling/candidate/installer change']"+text.slice(limB);
// Remove duplicate array close introduced by replacement.
text=text.replace("change']]},save=", "change']},save=");
text=text.replace('let child,launcher,component,childIdentity;let finished;', 'let child,launcher,component;const childIdentities=[];let finished;');
const bodyA=text.indexOf(' component=await waitFile('),bodyB=text.indexOf("}catch(error){report.status='failed'",bodyA);
const body=fs.readFileSync('.git/c098-pty-resources-body-01.txt','utf8');
text=text.slice(0,bodyA)+body+text.slice(bodyB);
text=text.replace("if(fs.existsSync(path.join(data,'child-identity.json')))fs.copyFileSync(path.join(data,'child-identity.json'),out+'/child-identity.json');", "for(let i=1;i<=3;i++){const file=path.join(data,'child-identity-'+i+'.json');if(fs.existsSync(file))fs.copyFileSync(file,out+'/child-identity-'+i+'.json');}");
fs.writeFileSync('.git/c098-pty-resources-native-01.mjs',text,{flag:'wx'});
let hosted=fs.readFileSync('.git/c098-guest-hosted-35.mjs','utf8').replaceAll('hosted-driver-35','hosted-driver-36').replaceAll('017b4bfd1732efe7d10aec0f2ce64b2214fa21bc','4668cfa03f2ae7e585bc8990ee265e2d40fe0f1c').replaceAll('.git/c098-guest-hosted-35.mjs','.git/c098-pty-resources-hosted-36.mjs');
fs.writeFileSync('.git/c098-pty-resources-hosted-36.mjs',hosted,{flag:'wx'});
