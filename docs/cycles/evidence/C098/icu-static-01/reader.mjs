// Fixed-candidate evidence reader, not a production or arbitrary-PE API.
import assert from 'node:assert/strict';
import {peArchitecture} from '../scripts/audit-windows-imports.mjs';
export function image(bytes){
 const arch=peArchitecture(bytes),pe=bytes.readUInt32LE(0x3c),opt=pe+24,size=bytes.readUInt16LE(pe+20),is64=bytes.readUInt16LE(opt)===0x20b;
 const dirs=opt+(is64?112:96),count=bytes.readUInt32LE(opt+(is64?108:92)),sections=[];
 assert.ok(count>=14 && dirs+14*8<=opt+size,'Missing directories');
 const table=opt+size;
 for(let i=0;i<bytes.readUInt16LE(pe+6);i++){
  const p=table+i*40;sections.push({virtualSize:bytes.readUInt32LE(p+8),rva:bytes.readUInt32LE(p+12),bytes:bytes.readUInt32LE(p+16),offset:bytes.readUInt32LE(p+20)});
 }
 function raw(rva,n=1){
  assert.ok(Number.isSafeInteger(rva)&&rva>0&&n>=0,'Invalid RVA');
  const matches=sections.filter(s=>rva>=s.rva&&rva-s.rva+n<=s.bytes);
  assert.equal(matches.length,1,'Unmapped/ambiguous raw RVA');
  const s=matches[0],offset=s.offset+rva-s.rva;
  assert.ok(offset+n<=bytes.length,'Truncated raw RVA');return offset;
 }
 function ascii(rva,limit=4096){
  const off=raw(rva),s=sections.find(s=>off>=s.offset&&off<s.offset+s.bytes);
  const end=bytes.indexOf(0,off);assert.ok(end>=off&&end<Math.min(off+limit,s.offset+s.bytes),'Unterminated string');
  const v=bytes.toString('latin1',off,end);assert.match(v,/^[\x21-\x7e]+$/,'Nonprintable/empty name');return v;
 }
 const directory=i=>({rva:bytes.readUInt32LE(dirs+i*8),size:bytes.readUInt32LE(dirs+i*8+4)});
 function thunks(rva){
  const rows=[],width=is64?8:4,flag=is64?0x8000000000000000n:0x80000000n;
  for(let i=0;i<100000;i++){
   const off=raw(rva+i*width,width),value=is64?bytes.readBigUInt64LE(off):BigInt(bytes.readUInt32LE(off));
   if(!value)return rows;
   if(value&flag){assert.equal(value & ~(flag|65535n),0n,'Reserved ordinal bits');rows.push({ordinal:Number(value&65535n)});}
   else{assert.ok(value<=0x7fffffffn,'Invalid name RVA');const nameRva=Number(value);raw(nameRva,2);rows.push({name:ascii(nameRva+2),hint:bytes.readUInt16LE(raw(nameRva,2))});}
  }
  throw Error('Unterminated thunk table');
 }
 function imports(){
  const result={direct:[],delayed:[]};
  for(const [kind,index,width] of [['direct',1,20],['delayed',13,32]]){
   const d=directory(index);if(!d.rva){assert.equal(d.size,0);continue;}raw(d.rva,d.size);let ended=false;
   for(let p=0;p+width<=d.size;p+=width){
    const off=raw(d.rva+p,width),fields=[];for(let n=0;n<width;n+=4)fields.push(bytes.readUInt32LE(off+n));
    if(fields.every(v=>v===0)){ended=true;break;}
    let nameRva,lookup;
    if(kind==='direct'){nameRva=fields[3];lookup=fields[0];if(!lookup){assert.equal(fields[1],0,'Bound IAT without lookup table');lookup=fields[4];}}
    else{assert.equal(fields[0],1,'Unsupported delay-import VA attributes');nameRva=fields[1];lookup=fields[4];assert.ok(lookup,'Missing delay lookup');}
    result[kind].push({module:ascii(nameRva),symbols:thunks(lookup)});
   }
   assert.ok(ended,'Unterminated import descriptor directory');
  }
  return result;
 }
 function exports(){
  const d=directory(0);assert.ok(d.rva&&d.size>=40,'Missing exports');raw(d.rva,d.size);
  const p=raw(d.rva,40),base=bytes.readUInt32LE(p+16),functions=bytes.readUInt32LE(p+20),names=bytes.readUInt32LE(p+24);
  assert.ok(functions>0&&functions<100000&&names<=functions,'Invalid export counts');
  const eat=raw(bytes.readUInt32LE(p+28),functions*4),npt=raw(bytes.readUInt32LE(p+32),names*4),ot=raw(bytes.readUInt32LE(p+36),names*2),rows=[];
  for(let i=0;i<functions;i++){
   const rva=bytes.readUInt32LE(eat+i*4);let forwarder=null;
   if(rva>=d.rva&&rva<d.rva+d.size)forwarder=ascii(rva,Math.min(4096,d.rva+d.size-rva));
   else if(rva){const matches=sections.filter(s=>rva>=s.rva&&rva-s.rva<Math.max(s.virtualSize,s.bytes));assert.equal(matches.length,1,'Unmapped/ambiguous virtual export RVA');assert.ok(rva<bytes.readUInt32LE(opt+56),'Export outside image');}
   rows.push({ordinal:base+i,rva,names:[],forwarder});
  }
  for(let i=0;i<names;i++){
   const idx=bytes.readUInt16LE(ot+i*2);assert.ok(idx<functions,'Export ordinal index');
   const name=ascii(bytes.readUInt32LE(npt+i*4));assert.ok(!rows.some(r=>r.names.includes(name)),'Duplicate export name');rows[idx].names.push(name);
  }
  return {module:ascii(bytes.readUInt32LE(p+12)),base,functions,names,rows};
 }
 return {arch,linker:{major:bytes[opt+2],minor:bytes[opt+3],limit:'PE linker fields are not an established compiler/runtime minimum'},imports,exports,raw,directory};
}
