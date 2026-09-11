const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const cache=new Map();let cacheBytes=0;
function serve(req,res,file,type){
  fs.stat(file,(error,stat)=>{
    if(error){res.writeHead(404);res.end('Not found');return;}
    let asset=cache.get(file);
    const send=()=>{
      const compressed=/text\/|javascript|json|svg/.test(type)&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
      const headers={'Content-Type':type,'Cache-Control':'public, no-cache','ETag':asset.etag,'Vary':'Accept-Encoding'};
      if(req.headers['if-none-match']===asset.etag){res.writeHead(304,headers);res.end();return;}
      const data=compressed?asset.gzip:asset.data;if(compressed)headers['Content-Encoding']='gzip';
      headers['Content-Length']=data.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:data);
    };
    if(asset?.mtime===stat.mtimeMs){send();return;}
    fs.readFile(file,(error,data)=>{
      if(error){res.writeHead(404);res.end('Not found');return;}
      const resident=cache.get(file);
      if(resident){cacheBytes-=resident.bytes;cache.delete(file);}
      const gzip=/text\/|javascript|json|svg/.test(type)?zlib.gzipSync(data):data;
      asset={data,gzip,mtime:stat.mtimeMs,etag:'W/"'+crypto.createHash('sha256').update(data).digest('hex')+'"',bytes:data.length+(gzip===data?0:gzip.length)};
      while(cache.size&&cacheBytes+asset.bytes>32*1024*1024){const key=cache.keys().next().value;cacheBytes-=cache.get(key).bytes;cache.delete(key);}
      if(asset.bytes<=32*1024*1024){cache.set(file,asset);cacheBytes+=asset.bytes;}send();
    });
  });
}
module.exports={serve};
