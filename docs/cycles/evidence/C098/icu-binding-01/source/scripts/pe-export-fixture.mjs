// Synthetic, inert PE files for static identity contracts; no production imports.
export function libxsltImage(arch='x64'){
  const b=Buffer.alloc(0xc00),pe=0x80,opt=pe+24,is32=arch==='x86',optSize=is32?224:240,dir=is32?96:112;
  b.write('MZ');b.writeUInt32LE(pe,0x3c);b.writeUInt32LE(0x4550,pe);b.writeUInt16LE(is32?0x14c:arch==='arm64'?0xaa64:0x8664,pe+4);b.writeUInt16LE(3,pe+6);b.writeUInt16LE(optSize,pe+20);b.writeUInt16LE(is32?0x10b:0x20b,opt);
  if(is32)b.writeUInt32LE(0x10000000,opt+28);else b.writeBigUInt64LE(0x180000000n,opt+24);b.writeUInt32LE(0x4000,opt+56);b.writeUInt32LE(0x400,opt+60);b.writeUInt32LE(16,opt+dir-4);b.writeUInt32LE(0x1020,opt+dir);b.writeUInt32LE(0x200,opt+dir+4);
  const sections=[['.rdata',0x1000,0x400,0x400,0x40000040],['.data',0x2000,0x200,0x800,0xc0000040],['.text',0x3000,0x200,0xa00,0x60000020]];
  sections.forEach(([name,rva,size,offset,flags],i)=>{const at=opt+optSize+i*40;b.write(name,at);b.writeUInt32LE(size,at+8);b.writeUInt32LE(rva,at+12);b.writeUInt32LE(size,at+16);b.writeUInt32LE(offset,at+20);b.writeUInt32LE(flags,at+36);});
  b.writeUInt32LE(2,0x420+20);b.writeUInt32LE(2,0x420+24);b.writeUInt32LE(0x1080,0x420+28);b.writeUInt32LE(0x1090,0x420+32);b.writeUInt32LE(0x10a0,0x420+36);
  b.writeUInt32LE(0x2000,0x480);b.writeUInt32LE(0x2010,0x484);b.writeUInt32LE(0x10b0,0x490);b.writeUInt32LE(0x10e0,0x494);b.writeUInt16LE(0,0x4a0);b.writeUInt16LE(1,0x4a2);b.write('xsltEngineVersion\0',0x4b0);b.write('xsltLibxsltVersion\0',0x4e0);
  if(is32)b.writeUInt32LE(0x10001300,0x800);else b.writeBigUInt64LE(0x180001300n,0x800);b.writeUInt32LE(10145,0x810);b.write('10145\0',0x700);return b;
}

export function icuToolImage(){
  const b=Buffer.alloc(0x1400),seed=libxsltImage();seed.copy(b,0,0,0x400);
  const opt=0x98,section=opt+240;
  for(const [i,rva,size,raw,flags] of [[0,0x1000,0x800,0x400,0x40000040],[1,0x2000,0x200,0x1200,0xc0000040],[2,0x3000,0x600,0xc00,0x60000020]]){
    const at=section+i*40;b.writeUInt32LE(size,at+8);b.writeUInt32LE(rva,at+12);b.writeUInt32LE(size,at+16);b.writeUInt32LE(raw,at+20);b.writeUInt32LE(flags,at+36);
  }
  b.writeUInt32LE(2,0x420+20);b.writeUInt32LE(2,0x420+24);b.writeUInt32LE(0x1080,0x420+28);b.writeUInt32LE(0x1090,0x420+32);b.writeUInt32LE(0x10a0,0x420+36);
  b.writeUInt32LE(0x3000,0x480);b.writeUInt32LE(0x3040,0x484);b.writeUInt32LE(0x10b0,0x490);b.writeUInt32LE(0x10e0,0x494);b.writeUInt16LE(1,0x4a2);
  b.write('udbg_getSystemParameterNameByIndex\0',0x4b0);b.write('udbg_getSystemParameterValueByIndex\0',0x4e0);
  Buffer.from('83f91477134863c1488d0d0000000048c1e005488b0408c333c0c3','hex').copy(b,0xc00);b.writeInt32LE(0x1400-0x3000-15,0xc0b);
  Buffer.from('83f914771a4863c14c8d150000000048c1e0054a8d0c104a8b44100848ffe033c0c3','hex').copy(b,0xc40);b.writeInt32LE(0x1400-0x3040-15,0xc4b);
  Buffer.from('48896c2410488974241848897c242041564883ec20488b4110','hex').copy(b,0xd00);
  let cursor=0x1200;
  const string=text=>{const offset=cursor;b.write(text+'\0',offset);cursor+=Buffer.byteLength(text)+1;return 0x180000000n+BigInt(0x2000+offset-0x1200);};
  const keys=['copyright','product','product.full','version','version.unicode'],values=['Copyright fixture','icu4c','ICU tool fixture','77.1','16.0'];
  for(let i=0;i<21;i++){const at=0x800+i*32;b.writeBigUInt64LE(string(keys[i]||'param'+i),at);b.writeBigUInt64LE(0x180003100n,at+8);if(i<5)b.writeBigUInt64LE(string(values[i]),at+16);}
  if(cursor>0x1400)throw Error('Synthetic ICU strings exceeded section');return b;
}
