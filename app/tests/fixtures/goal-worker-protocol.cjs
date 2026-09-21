const net = require('node:net');
const fs = require('node:fs');
const [pipe, nonce] = process.argv.slice(2);
const socket = net.connect(pipe, () => send({ type: 'hello', nonce }));
function send(m) { socket.write(JSON.stringify(m) + '\n'); }
let buffer='',params,sequence=0;
function event(value) { send({ type:'event',event:{ ...value,profileId:params.profileId,chatId:params.chatId,provider:params.provider,runId:'child-fixture',sequence:++sequence } }); }
socket.setEncoding('utf8'); socket.on('data', chunk => {
  buffer+=chunk;let n;
  while((n=buffer.indexOf('\n'))>=0) {
    const m=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);
    if(m.type==='start') {
      params=m.params;
      if(params.prompt==='malformed-after-completion') {event({type:'done'});send({type:'complete',result:{status:'completed'}});socket.write('not-json\n');continue;}
      if(params.images?.length) event({type:'text_delta',text:JSON.stringify({imageBytes:fs.statSync(params.images[0].path).size,historyLength:params.messages[0].content.length,imageDescriptorKeys:Object.keys(params.images[0])})});
      event({type:'text_delta',text:'Observed worker output'});
      event({type:'approval',approvalId:'child-approval',request:{kind:'command',command:'fixture only'}});
    } else if(m.type==='approval') {
      event({type:'text_delta',text:m.approved?' approved':' declined'});
      event({type:'done',session:'owned-session',history:params.messages});send({type:'complete',result:{status:'completed'}});socket.end(()=>process.exit(0));
    }
  }
});socket.on('error',()=>process.exit(2));
