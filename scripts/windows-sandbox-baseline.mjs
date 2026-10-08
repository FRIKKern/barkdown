import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const collector = fileURLToPath(new URL('./windows-machine-baseline.ps1', import.meta.url));
const guestInput = 'C:\\BarkdownBaselineInput';
const guestOutput = 'C:\\BarkdownBaselineOutput';
const command = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\\BarkdownBaselineInput\\collector.ps1" -OutputDirectory "C:\\BarkdownBaselineOutput" -Role candidate-guest';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function xml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
export function baselineConfiguration(input, output) {
  for (const item of [input, output]) {
    // Sandbox expands environment variables on recent Windows. Only literal local paths are accepted.
    if (typeof item !== 'string' || !/^[a-z]:\\/i.test(item) || /[%\x00-\x1f]/.test(item) || path.win32.normalize(item) !== item) throw Error('Expected a normalized literal local Windows path');
  }
  if (input.toLowerCase() === output.toLowerCase() || input.toLowerCase().startsWith(output.toLowerCase() + '\\') || output.toLowerCase().startsWith(input.toLowerCase() + '\\')) throw Error('Mapped folders must be separate');
  return `<?xml version="1.0" encoding="utf-8"?>
<Configuration>
  <vGPU>Disable</vGPU>
  <Networking>Disable</Networking>
  <AudioInput>Disable</AudioInput>
  <VideoInput>Disable</VideoInput>
  <PrinterRedirection>Disable</PrinterRedirection>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder><HostFolder>${xml(input)}</HostFolder><SandboxFolder>${guestInput}</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>${xml(output)}</HostFolder><SandboxFolder>${guestOutput}</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>${xml(command)}</Command></LogonCommand>
</Configuration>
`;
}

export function prepareBaseline(outputDirectory) {
  if (process.platform !== 'win32') throw Error('Windows host required');
  if (typeof outputDirectory !== 'string' || !path.isAbsolute(outputDirectory)) throw Error('Absolute new output directory required');
  const target = path.normalize(outputDirectory);
  if (!/^[a-z]:\\/i.test(target) || /[%\x00-\x1f]/.test(target)) throw Error('Literal local output required');
  const parent = path.dirname(target);
  // Reject junctions/symlinks in the entire ancestor chain; map only newly created children.
  for (let item = parent;; item = path.dirname(item)) {
    const info = fs.lstatSync(item);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Unsafe output ancestor');
    if (item === path.dirname(item)) break;
  }
  const input = path.join(target, 'input'), output = path.join(target, 'output');
  const configuration = baselineConfiguration(input, output);
  const source = fs.readFileSync(collector);
  fs.mkdirSync(target); // Atomic refusal also preserves existing/failed runs and symlink targets.
  fs.mkdirSync(input);fs.mkdirSync(output);
  fs.writeFileSync(path.join(input, 'collector.ps1'), source, {flag:'wx'});
  fs.writeFileSync(path.join(target, 'baseline.wsb'), configuration, {flag:'wx'});
  const result = {version:1,status:'prepared',preparedAt:new Date().toISOString(),outputDirectory:target,
    inputs:[{file:'input/collector.ps1',bytes:source.length,sha256:sha(source)},
      {file:'baseline.wsb',bytes:Buffer.byteLength(configuration),sha256:sha(configuration)}],
    sandboxLaunched:false,cleanMachineAccepted:false,installationAccepted:false,
    limits:['Configuration preparation only; host capability and effective guest policy are separate observations',
      'Maps collector read-only and only this new output writable; no package, profile or credential mapping',
      'Guest collector records baseline before application/prerequisite execution; role is not isolation proof']};
  fs.writeFileSync(path.join(target, 'preparation.json'), JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/windows-sandbox-baseline.mjs <absolute-new-output-directory>');
    console.log(JSON.stringify(prepareBaseline(process.argv[2])));
  } catch (error) {console.error(error.message);process.exitCode=1;}
}
