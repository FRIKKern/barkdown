// Engineering assembly only. Complete notices, the app driver and installation are separate gates.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unusedDestination, inventory, sha256 } from './runtime-postgres-bundle.mjs';
import { buildReaderAssets, attachReaderAssets } from './runtime-wasm-assets.mjs';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function batchPath(value) {
  // cmd.exe expands percent/bang even inside quotes; reject shell syntax before launching.
  if (!value || /[%!"&|<>^\r\n]/.test(value)) throw new Error('Unsupported batch path: shell expansion or control character');
  return path.resolve(value);
}

export function releaseInput(checkoutArg, outputArg) {
  const checkout = batchPath(checkoutArg), api = path.join(checkout, 'api');
  if (!fs.existsSync(path.join(api, 'mix.exs'))) throw new Error('Not a Barkpark checkout');
  const git = args => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
  const upstream = git(['rev-parse', 'HEAD']);
  const pin = fs.readFileSync(path.join(root, 'app/BARKPARK_REF'), 'utf8').trim();
  if (upstream !== pin) throw new Error('Checkout must match app/BARKPARK_REF');
  if (git(['status', '--porcelain', '--untracked-files=no'])) throw new Error('Tracked checkout changes refuse assembly');
  const out = unusedDestination(batchPath(outputArg || path.join(root, 'runtime', `barkpark-${upstream.slice(0,9)}-win32-x64`)));
  const build = unusedDestination(out + '.build');
  return { checkout, api, git, upstream, out, build, lockSha256: sha256(path.join(api, 'mix.lock')) };
}

export function buildWindowsRelease(checkout, output, { elixir, erlangBin, vsdev, go }) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Windows x64 host required');
  const input = releaseInput(checkout, output);
  elixir = batchPath(elixir); erlangBin = batchPath(erlangBin); vsdev = batchPath(vsdev);
  if (!go) throw new Error('Pinned Go executable required for the generated reader assets');
  go = batchPath(go);
  for (const file of [elixir, path.join(erlangBin,'erl.exe'), vsdev, go]) if (!fs.statSync(file).isFile()) throw new Error('Toolchain file missing: ' + file);
  const driver = batchPath(path.join(root, 'scripts/runtime-release-windows.exs'));
  fs.mkdirSync(input.build, { recursive: true });
  const commandFile = path.join(input.build, 'build.cmd');
  fs.writeFileSync(commandFile, '@echo off\r\nsetlocal DisableDelayedExpansion\r\ncall "%BARKDOWN_BUILD_VSDEV%" -arch=x64 -host_arch=x64\r\nif errorlevel 1 exit /b %errorlevel%\r\ncall "%BARKDOWN_BUILD_ELIXIR%" "%BARKDOWN_BUILD_DRIVER%" "%BARKDOWN_BUILD_API%" "%BARKDOWN_BUILD_ROOT%" "%BARKDOWN_BUILD_OUTPUT%"\r\nexit /b %errorlevel%\r\n');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path' && !/^(MIX|ELIXIR|ERL|RELEASE|BARKDOWN_BUILD)/i.test(key)));
  Object.assign(env, { PATH: [path.dirname(elixir), erlangBin, process.env.PATH].join(';'), MIX_ENV:'prod', BARKDOWN_BUILD_VSDEV:vsdev, BARKDOWN_BUILD_ELIXIR:elixir, BARKDOWN_BUILD_DRIVER:driver, BARKDOWN_BUILD_API:input.api, BARKDOWN_BUILD_ROOT:input.build, BARKDOWN_BUILD_OUTPUT:input.out });
  const startedAt = new Date().toISOString(), log = path.join(input.build,'build.log');
  const report = { status:'failed', startedAt, exitCode:null, upstream:input.upstream, output:input.out, build:input.build, log, elixir, erlangBin, vsdev, go, lockSha256:input.lockSha256 };
  try {
    const reader = buildReaderAssets({ checkout:input.checkout, upstream:input.upstream, directory:path.join(input.build,'reader'), go });
    report.reader = reader;
    const fd = fs.openSync(log,'wx');
    let result;
    try { result = spawnSync(process.env.ComSpec, ['/d','/s','/c', '""' + commandFile + '""'], { env, cwd:input.api, windowsHide:true, windowsVerbatimArguments:true, stdio:['ignore',fd,fd], timeout:30*60*1000 }); }
    finally { fs.closeSync(fd); }
    Object.assign(report,{exitCode:result.status,signal:result.signal,error:result.error?.message});
    if (result.status !== 0 || result.error) throw new Error('Native build failed; inspect retained build.log');
    if (input.git(['rev-parse','HEAD']) !== input.upstream || input.git(['status','--porcelain','--untracked-files=no']) || sha256(path.join(input.api,'mix.lock')) !== input.lockSha256) throw new Error('Source or lock changed during assembly');
    const erts = fs.readdirSync(input.out).find(n => /^erts-/.test(n));
    if (!erts || !fs.existsSync(path.join(input.out,erts,'bin/erl.exe')) || !fs.existsSync(path.join(input.out,'bin/barkpark.bat'))) throw new Error('Release lacks carried ERTS or Windows launcher');
    const application = fs.readdirSync(path.join(input.out,'lib')).filter(name => /^barkpark-/.test(name));
    if (application.length !== 1) throw new Error('Release reader application is ambiguous or missing');
    const readerFiles = attachReaderAssets(reader.assets,path.join(input.out,'lib',application[0],'priv/static/assets'));
    report.finishedAt = new Date().toISOString();
    const files = inventory(input.out);
    if (fs.readdirSync(input.out,{recursive:true,withFileTypes:true}).some(e=>e.isSymbolicLink())) throw new Error('Release contains build-host links');
    const toolchain = JSON.parse(fs.readFileSync(path.join(input.build,'toolchain.json'),'utf8'));
    const mark = { version:1, upstream:input.upstream, matchesPin:true, builtAt:report.finishedAt, platform:'win32', arch:'x64', os:os.release(), erts, toolchain, mixLockSha256:input.lockSha256, builderSha256:sha256(fileURLToPath(import.meta.url)), driverSha256:sha256(driver), buildOptions:{include_executables_for:['windows'],include_erts:true,steps:['assemble']}, readerAssets:{goVersion:reader.goVersion,compilerSha256:reader.compilerSha256,sourceArchiveSha256:reader.archiveSha256,files:readerFiles}, purpose:'engineering-validation', limits:['Application packaged driver and installer not accepted','Complete Windows runtime notices required before distribution','Developer host build is not clean-machine acceptance'] };
    fs.writeFileSync(path.join(input.out,'barkdown-release.json'),JSON.stringify(mark,null,2)+'\n',{flag:'wx'});
    fs.writeFileSync(path.join(input.build,'inventory.json'),JSON.stringify(files,null,2)+'\n',{flag:'wx'});
    Object.assign(report,{status:'passed',erts,toolchain,files:files.length,bytes:files.reduce((sum,f)=>sum+f.bytes,0)});
  } catch (error) { report.error = error.message; }
  report.finishedAt = new Date().toISOString();
  report.elapsedMs = Date.parse(report.finishedAt)-Date.parse(startedAt);
  fs.writeFileSync(path.join(input.build,'result.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  if (report.status !== 'passed') throw new Error(report.error + ': ' + input.build);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [checkout,output,elixir,erlangBin,vsdev,go] = process.argv.slice(2);
  if (!checkout || !output || !elixir || !erlangBin || !vsdev || !go) { console.error('Usage: node scripts/build-runtime-release-windows.mjs <pinned checkout> <new output> <elixir.bat> <erlang bin> <VsDevCmd.bat> <pinned go.exe>'); process.exitCode=2; }
  else try { console.log(JSON.stringify(buildWindowsRelease(checkout,output,{elixir,erlangBin,vsdev,go}))); } catch(error) { console.error(error.message); process.exitCode=1; }
}
