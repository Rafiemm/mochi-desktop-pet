// Tiny static server for local testing: node serve.cjs [dir] [port]
const http=require("http"),fs=require("fs"),path=require("path");
const dir=path.resolve(process.argv[2]||"../mascot"),port=+(process.argv[3]||5174);
const types={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".webp":"image/webp",".png":"image/png",".json":"application/json"};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split("?")[0]);if(p==="/")p="/index.html";const f=path.join(dir,p);
  if(!f.startsWith(dir)){r.writeHead(403);return r.end()}
  fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end("not found")}r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream","Cache-Control":"no-store"});r.end(d)})}).listen(port,"127.0.0.1",()=>console.log("serving",dir,"on",port));
