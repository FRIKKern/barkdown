const http=require('http'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../preview'),port=Number(process.env.PORT||4173);
const server=http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end('Bad URL');}const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(error,body)=>{if(error){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);});});
server.listen(port,'127.0.0.1',()=>console.log('Barkdown concept: http://127.0.0.1:'+port));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
