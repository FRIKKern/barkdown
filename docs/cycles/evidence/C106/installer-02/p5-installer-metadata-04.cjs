const fs=require('fs'),{spawnSync}=require('child_process'),assert=require('assert/strict');
const base='C:/Users/Frikk/Documents/GitHub/barkdown/.git/C106-extract-02/inspection';
const script=base+'/native-metadata-04.ps1';
fs.writeFileSync(script,'\uFEFF'+String.raw`$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$artifactPath='C:/Users/Frikk/Documents/GitHub/barkdown/.git/C106 NSIS Chø 02/Barkdown-0.6.0-x64-setup.exe'
$applicationPath='C:/Users/Frikk/Documents/GitHub/barkdown/.git/C106-extract-02/payload/Barkdown.exe'
$installerSignature=Get-AuthenticodeSignature -LiteralPath $artifactPath
$appSignature=Get-AuthenticodeSignature -LiteralPath $applicationPath
$version=(Get-Item -LiteralPath $applicationPath).VersionInfo
[pscustomobject]@{installerSignature=$installerSignature.Status.ToString();appSignature=$appSignature.Status.ToString();product=$version.ProductName;version=$version.ProductVersion;description=$version.FileDescription}|ConvertTo-Json -Compress
`,{flag:'wx'});
const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,PSModulePath:process.env.SystemRoot+'/System32/WindowsPowerShell/v1.0/Modules'}});fs.writeFileSync(base+'/native-metadata-04.stdout.log',r.stdout);fs.writeFileSync(base+'/native-metadata-04.stderr.log',r.stderr);fs.writeFileSync(base+'/native-metadata-04-command.json',JSON.stringify({at:new Date().toISOString(),exitCode:r.status,error:r.error?.message||null})+'\n');assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.installerSignature,'NotSigned');assert.equal(result.appSignature,'NotSigned');assert.equal(result.product,'Barkdown');assert.equal(result.version,'0.6.0.0');fs.writeFileSync(base+'/native-signature-metadata.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
