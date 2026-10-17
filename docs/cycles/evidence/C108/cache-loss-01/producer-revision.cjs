const fs=require('fs'),vm=require('vm');
const p=fs.readFileSync(__dirname+'/media-cache-loss-prepare460.cjs','utf8');
const start=p.indexOf('let producer='),end=p.indexOf("fs.writeFileSync(__dirname+'/C108-cache-loss-entry460.json'");
if(start<0||end<start)throw Error('producer boundary absent');
const code="const fs=require('fs'),assert=require('assert/strict');"+p.slice(start,end).replace("{flag:'wx'}","{flag:'w'}");
vm.runInNewContext(code,{require,__dirname,console});
