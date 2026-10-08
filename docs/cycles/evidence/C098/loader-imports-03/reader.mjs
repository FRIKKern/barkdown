import assert from 'node:assert/strict';
// Fixed dumpbin evidence dialect; reject unfamiliar table content rather than
// silently concluding that an API or loader policy is absent.
export function nativeImports(text) {
 assert.match(text,/^File Type: (?:DLL|EXECUTABLE IMAGE)\s*$/m);assert.match(text,/^  Summary\s*$/m);
 let active=null,kind=null;const rows=[];
 for(const line of text.split(/\r?\n/)) {
  if(line==='  Section contains the following imports:'){kind='direct';active=null;continue;}
  if(line==='  Section contains the following delay load imports:'){kind='delayed';active=null;continue;}
  if(/^  Summary\s*$/.test(line)){active=null;kind=null;continue;}
  const module=/^    (\S+)$/.exec(line)?.[1];
  if(module&&kind){active={module,kind,symbols:[]};rows.push(active);continue;}
  if(!active||!line.trim())continue;
  if(/^\s+[0-9A-F]+ (?:Import Address Table|Import Name Table|time date stamp|Index of first forwarder reference|Characteristics|Address of HMODULE|Bound Import Name Table|Unload Import Name Table)\s*$/.test(line))continue;
  const ordinal=(kind==='delayed'?/^\s+[0-9A-F]{8}(?:[0-9A-F]{8})?\s+Ordinal\s+(\d+)\s*$/:/^\s+Ordinal\s+(\d+)\s*$/).exec(line);if(ordinal){active.symbols.push({ordinal:Number(ordinal[1])});continue;}
  const named=(kind==='delayed'?/^\s+[0-9A-F]{8}(?:[0-9A-F]{8})?\s+([0-9A-F]+) (\S+)\s*$/:/^\s+([0-9A-F]+) (\S+)\s*$/).exec(line);assert.ok(named,'Unrecognized import line '+line);active.symbols.push({name:named[2],hint:parseInt(named[1],16)});
 }
 return rows;
}
export const loaderApis=Object.freeze(['LoadLibraryA','LoadLibraryW','LoadLibraryExA','LoadLibraryExW','LoadPackagedLibrary','GetProcAddress','FreeLibrary','FreeLibraryAndExitThread','AddDllDirectory','RemoveDllDirectory','SetDllDirectoryA','SetDllDirectoryW','SetDefaultDllDirectories','GetDllDirectoryA','GetDllDirectoryW','LdrLoadDll','LdrGetProcedureAddress']);
export function selectLoaderReferences(rows) {
 return rows.flatMap(row=>row.symbols.filter(s=>loaderApis.includes(s.name)).map(s=>({module:row.module,kind:row.kind,...s})));
}
