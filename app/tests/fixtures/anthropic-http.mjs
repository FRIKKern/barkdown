import http from 'node:http';
// Deterministic transport only; exercises the actual SDK/tool-loop in owned jobs.
export async function createAnthropicFixture() {
  const gates = new Map(), connections = new Set(), requests = [];
  const server = http.createServer(async (req, res) => {
    try {
      let bytes='';for await(const part of req) bytes+=part;
      const body=JSON.parse(bytes);requests.push(body);
      const content=body.messages.at(-1).content;
      const text=typeof content==='string'?content:content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
      const n=Number([...text.matchAll(/Return fixture result (\d)/g)].at(-1)?.[1]);
      if(req.url!=='/v1/messages'||!n)throw new Error('Unexpected fixture request');
      res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});
      const event=(type,value)=>res.write(`event: ${type}\ndata: ${JSON.stringify({type,...value})}\n\n`);
      event('message_start',{message:{id:`fixture-${n}`,type:'message',role:'assistant',model:'fixture',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}});
      event('content_block_start',{index:0,content_block:{type:'text',text:''}});
      const delta=text=>event('content_block_delta',{index:0,delta:{type:'text_delta',text}});
      gates.set(n,{text:delta,release(){delta(`Finished ${n}.`);event('content_block_stop',{index:0});event('message_delta',{delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});event('message_stop',{});res.end();}});
      delta(`Worker ${n} started. `);
    }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:{type:'invalid_request_error',message:error.message}}));}
  });
  server.on('connection',socket=>{connections.add(socket);socket.on('close',()=>connections.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}`,gates,requests,async close(){for(const s of connections)s.destroy();await new Promise(resolve=>server.close(resolve));}};
}
