import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import {baselineConfiguration,prepareBaseline} from './windows-sandbox-baseline.mjs';

test('configuration maps only baseline input and output with fixed guest command',()=>{
  const xml=baselineConfiguration('C:\\Proof & Chø\\input','C:\\Proof & Chø\\output');
  assert.equal((xml.match(/<MappedFolder>/g)||[]).length,2);
  assert.match(xml,/<HostFolder>C:\\Proof &amp; Chø\\input<\/HostFolder>/);
  assert.match(xml,/<ReadOnly>true<\/ReadOnly>/);assert.match(xml,/<ReadOnly>false<\/ReadOnly>/);
  assert.match(xml,/-File &quot;C:\\BarkdownBaselineInput\\collector.ps1&quot;/);
  assert.match(xml,/-Role candidate-guest/);
  for(const name of ['vGPU','Networking','AudioInput','VideoInput','PrinterRedirection','ClipboardRedirection']) assert.ok(xml.includes(`<${name}>Disable</${name}>`));
  assert.ok(!xml.includes('Barkdown.exe')&&!xml.includes('runtime'));
});
for(const bad of ['relative','\\\\host\\share','C:\\%USERPROFILE%\\input','C:\\a\ninput','C:\\a\\..\\input','C:\\a\\\\input','C:/input','C:input','C:\\input\0',null]) {
  test('refuse unsafe literal mapping '+JSON.stringify(bad),()=>assert.throws(()=>baselineConfiguration(bad,'D:\\output')));
}
for(const [input,output] of [['C:\\input','c:\\INPUT'],['C:\\data','c:\\DATA\\nested'],['C:\\data\\nested','c:\\DATA']]) {
  test('refuse overlap '+input+' / '+output,()=>assert.throws(()=>baselineConfiguration(input,output),/separate/));
}
test('XML escapes apostrophe and ampersand without changing the fixed command',()=>{
  const xml=baselineConfiguration("C:\\Owner's & Chø\\input","C:\\Owner's & Chø\\output");
  assert.ok(xml.includes('Owner&apos;s &amp; Chø'));
  assert.equal((xml.match(/<LogonCommand>/g)||[]).length,1);
});
test('physical preparation preserves input bytes and never claims launch or acceptance',{skip:process.platform!=='win32'},()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown baseline tests ')),output=path.join(root,'New & Chø');
  const result=prepareBaseline(output);
  assert.equal(result.status,'prepared');assert.equal(result.sandboxLaunched,false);
  assert.equal(result.cleanMachineAccepted,false);assert.equal(result.installationAccepted,false);
  assert.deepEqual(fs.readdirSync(output).sort(),['baseline.wsb','input','output','preparation.json']);
  assert.equal(fs.readdirSync(path.join(output,'output')).length,0);
  assert.deepEqual(fs.readFileSync(path.join(output,'input/collector.ps1')),fs.readFileSync(new URL('./windows-machine-baseline.ps1',import.meta.url)));
  const before=fs.readFileSync(path.join(output,'preparation.json'));
  assert.throws(()=>prepareBaseline(output),/EEXIST/);assert.deepEqual(fs.readFileSync(path.join(output,'preparation.json')),before);
});
test('existing file and junction ancestor refuse before creating a child',{skip:process.platform!=='win32'},()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'Barkdown baseline refusal '));
  const sentinel=path.join(root,'sentinel');fs.writeFileSync(sentinel,'keep');
  assert.throws(()=>prepareBaseline(sentinel),/EEXIST/);assert.equal(fs.readFileSync(sentinel,'utf8'),'keep');
  const original=path.join(root,'original'),link=path.join(root,'link');fs.mkdirSync(original);fs.symlinkSync(original,link,'junction');
  assert.throws(()=>prepareBaseline(path.join(link,'child')),/Unsafe/);assert.deepEqual(fs.readdirSync(original),[]);
  assert.throws(()=>prepareBaseline('relative'),/Absolute/);
});
