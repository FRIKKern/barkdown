import assert from 'node:assert/strict';
import { parseVcVersion, compareVcVersions, normalizeVcRegistration } from './vc-runtime-registration.mjs';
const path = 'SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64';
const view = name => ({view: name, status: 'present', values: [
  { name: 'Installed', present: true, kind: 'DWord', value: 1 },
  { name: 'Version', present: true, kind: 'String', value: 'v14.51.36247.00' },
  ...['Major','Minor','Bld','Rbld'].map((name, i) => ({name, present:true, kind:'DWord', value:[14,51,36247,0][i]}))
]});
const input = () => ({hive:'HKLM', path, architecture:'x64', views:[view('Registry32'),view('Registry64')]});
let cases = 0;
const check = fn => {fn();cases++;};
check(() => assert.deepEqual(parseVcVersion('v14.51.36247.00'), [14,51,36247,0]));
for (const [a,b,want] of [['14.9.1.0','14.10.1.0',-1],['14.51.36247.00','v14.51.36247.0',0],
  ['14.51.36247.1','14.51.36247.0',1],['14.50.35719.0','14.51.36247.0',-1],
  ['14.4294967295.0.0','14.4294967294.0.0',1]]) {
  check(() => assert.equal(compareVcVersions(a,b),want));
  check(() => assert.equal(compareVcVersions(b,a),want === 0 ? 0 : -want));
}
for(const bad of [null, [], {}, 14, '', '14.51.36247','14.51.36247.0 ', ' 14.51.36247.0',
  '14.51.36247.0\n', 'v14.-1.0.0','14.1e2.0.0','14.1.0.4294967296','14.1.0.00000000000',
  'V14.51.36247.0','14.51.36247.0junk','14.51.36247.0.0','14..0.0','NaN.1.0.0']) {
  check(() => assert.throws(() => parseVcVersion(bad)));
}
check(() => {const a=input(), before=structuredClone(a), r=normalizeVcRegistration(a);
  assert.equal(r.status,'registered');assert.equal(r.version,'14.51.36247.0');
  assert.equal(r.minimumVersion,null);assert.equal(r.loaderCompatibility,'unknown');assert.equal(r.installationReady,'unknown');
  r.views[0].version='changed';assert.deepEqual(a,before);a.views[0].values[1].value='v14.1.0.0';assert.equal(r.version,'14.51.36247.0');});
check(() => {const a=input();a.views.reverse();assert.deepEqual(normalizeVcRegistration(a),normalizeVcRegistration(input()));});
for(const unavailable of ['missing','unreadable']) {
  check(() => {const a=input();a.views=a.views.map(row => ({view:row.view,status:unavailable,values:[],...(unavailable==='unreadable'?{error:'AccessDenied'}:{})}));assert.equal(normalizeVcRegistration(a).status,unavailable);});
  check(() => {const a=input();a.views[0]={view:'Registry32',status:unavailable,values:[],...(unavailable==='unreadable'?{error:'AccessDenied'}:{})};assert.equal(normalizeVcRegistration(a).status,unavailable==='missing'?'registered':'unreadable');});
}
for(let i=0;i<6;i++) check(() => {const a=input();a.views[0].values[i]={name:a.views[0].values[i].name,present:false};assert.equal(normalizeVcRegistration(a).status,'incomplete');});
check(() => {const a=input();a.views[0].values[0].value=0;assert.equal(normalizeVcRegistration(a).status,'incomplete');});
check(() => {const a=input();a.views[0].values[1].value='v14.50.35719.0';a.views[0].values[3].value=50;a.views[0].values[4].value=35719;assert.equal(normalizeVcRegistration(a).status,'conflict');});
const mutations = [a=>a.hive='HKCU',a=>a.path=path.replace('SOFTWARE','SOFTWARE\\Wow6432Node'),a=>a.architecture='x86',
 a=>a.extra=true,a=>a.views.pop(),a=>a.views.push(view('Registry64')),a=>a.views={},a=>a.views[0].view='Default',
 a=>a.views[1].view='Registry32',a=>a.views[0].status='unknown',a=>a.views[0].values.pop(),
 a=>a.views[0].values[0].name='Other',a=>a.views[0].values[1].name='Installed',a=>a.views[0].values[0].present=1,
 a=>a.views[0].values[0].kind='String',a=>a.views[0].values[1].kind='ExpandString',a=>a.views[0].values[0].value=2,
 a=>a.views[0].values[2].value=19,a=>a.views[0].values[3].value=52,a=>a.views[0].values[1].value='v14.51.36247',
 a=>a.views[0].values[4].value=-1,a=>a.views[0].values[4].value=1.5,a=>a.views[0].values[4].value='36247',
 a=>a.views[0].values[4].value=4294967296,a=>a.views[0].values[0].extra='junk',
 a=>a.views[0]={view:'Registry32',status:'missing',values:[{}]},
 a=>a.views[0]={view:'Registry32',status:'unreadable',values:[],error:''},
 a=>a.views[0].values[0]={name:'Installed',present:false,value:0},a=>Object.setPrototypeOf(a,null)];
for(const change of mutations) check(() => {const a=input();change(a);assert.throws(()=>normalizeVcRegistration(a));});
console.log(JSON.stringify({status:'passed',cases,limits:'Offline typed metadata and numeric comparison; no minimum or installer policy'}));
