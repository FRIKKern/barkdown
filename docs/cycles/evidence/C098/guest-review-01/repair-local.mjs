import fs from 'node:fs';
let ps=fs.readFileSync('.git/c098-guest-capability-01.ps1','utf8').replace('Get-VMHost -ErrorAction Stop','Get-VMHost -ComputerName . -ErrorAction Stop').replace('Get-VM -ErrorAction Stop','Get-VM -ComputerName . -ErrorAction Stop');
fs.writeFileSync('.git/c098-guest-capability-local-01.ps1',ps);
let n=fs.readFileSync('.git/c098-guest-native-02.mjs','utf8').replaceAll('guest-native-02','guest-native-03').replaceAll('c098-guest-capability-01.ps1','c098-guest-capability-local-01.ps1');fs.writeFileSync('.git/c098-guest-native-03.mjs',n);
console.log('Selected explicit local Hyper-V computer; native01/02 and error remain');
