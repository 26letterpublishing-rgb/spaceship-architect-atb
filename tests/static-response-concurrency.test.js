const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const source=fs.readFileSync(process.env.SA_STATIC_MODULE||path.join(__dirname,'../static-response.js'),'utf8');
function fixture(initial=Buffer.from('const unchanged = "same bytes";\n'.repeat(2000))){
 const stats={reads:0,gzips:0},state={data:initial,mtime:1,readError:false,gzipError:false,statError:false};
 const fakeFs={stat(file,done){const current={mtimeMs:state.mtime,size:state.data.length};setImmediate(()=>done(state.statError?Error('missing'):null,current));},readFile(file,done){stats.reads++;const data=state.data,failed=state.readError;setImmediate(()=>done(failed?Error('read failed'):null,data));}};
 const fakeZlib={gzip(data,done){stats.gzips++;if(state.gzipError)setImmediate(()=>done(Error('gzip failed')));else zlib.gzip(data,done);}};
 const context={module:{exports:{}},require:name=>name==='node:fs'?fakeFs:name==='node:zlib'?fakeZlib:require(name)};vm.runInNewContext(source,context);
 const send=({encoding='gzip',method='GET',etag,file='/same.js',type='application/javascript',destroyed=false}={})=>new Promise(resolve=>{
  const response={destroyed,writeHead(status,headers){this.status=status;this.headers=headers||{};},end(body){resolve({status:this.status,headers:this.headers,body});}};
  context.module.exports.serve({method,headers:{'accept-encoding':encoding,...(etag?{'if-none-match':etag}:{})}},response,file,type);
 });
 return {stats,state,send};
}
test('concurrent cold requests share one read and compression while preserving each response',async()=>{
 const f=fixture(),responses=await Promise.all(Array.from({length:24},(_,i)=>f.send({encoding:i%2?'gzip':'identity',method:i===23?'HEAD':'GET'})));
 assert.equal(f.stats.reads,1);assert.equal(f.stats.gzips,1);
 for(let i=0;i<responses.length;i++){const r=responses[i];assert.equal(r.status,200);assert.equal(r.headers['Cache-Control'],'public, no-cache');assert.equal(r.headers.Vary,'Accept-Encoding');if(i===23){assert.equal(r.body,undefined);continue;}assert.deepEqual(i%2?zlib.gunzipSync(r.body):r.body,f.state.data);assert.equal(r.headers['Content-Length'],r.body.length);}
 assert.equal(new Set(responses.map(r=>r.headers.ETag)).size,1);
 const cached=await f.send({etag:responses[0].headers.ETag});assert.equal(cached.status,304);assert.equal(cached.body,undefined);assert.equal(f.stats.reads,1);
});
test('simultaneous different assets do not share a load',async()=>{const f=fixture();await Promise.all([f.send({file:'/a.js'}),f.send({file:'/b.js'})]);assert.equal(f.stats.reads,2);assert.equal(f.stats.gzips,2);});
test('concurrent image responses share raw bytes without compression',async()=>{const f=fixture(Buffer.from([1,2,3,4]));const replies=await Promise.all(Array.from({length:12},()=>f.send({file:'/a.png',type:'image/png'})));assert.equal(f.stats.reads,1);assert.equal(f.stats.gzips,0);for(const r of replies){assert.deepEqual(r.body,f.state.data);assert.equal(r.headers['Content-Encoding'],undefined);}});
test('changed modification time reloads the asset and changes ETag',async()=>{const f=fixture();const old=await f.send();f.state.data=Buffer.from('new contents');f.state.mtime++;const replies=await Promise.all([f.send({etag:old.headers.ETag}),f.send()]);assert.equal(f.stats.reads,2);assert.equal(f.stats.gzips,2);assert.notEqual(replies[0].headers.ETag,old.headers.ETag);for(const r of replies){assert.equal(r.status,200);assert.deepEqual(zlib.gunzipSync(r.body),f.state.data);}});
test('shared read failure answers every waiter and permits a later retry',async()=>{const f=fixture();f.state.readError=true;const replies=await Promise.all([f.send(),f.send(),f.send()]);assert.equal(f.stats.reads,1);for(const r of replies){assert.equal(r.status,404);assert.equal(r.body,'Not found');}f.state.readError=false;assert.equal((await f.send()).status,200);assert.equal(f.stats.reads,2);});
test('shared compression failure answers every waiter and permits a later retry',async()=>{const f=fixture();f.state.gzipError=true;const replies=await Promise.all([f.send(),f.send(),f.send()]);assert.equal(f.stats.reads,1);assert.equal(f.stats.gzips,1);for(const r of replies){assert.equal(r.status,500);assert.equal(r.body,'Asset compression failed. Please retry.');}f.state.gzipError=false;assert.equal((await f.send()).status,200);assert.equal(f.stats.reads,2);assert.equal(f.stats.gzips,2);});
test('missing assets retain the existing 404 response',async()=>{const f=fixture();f.state.statError=true;assert.equal((await f.send()).status,404);assert.equal(f.stats.reads,0);});
test('assets exceeding the cache budget are shared in flight but are not retained',async()=>{const f=fixture(Buffer.alloc(33*1024*1024,7));const options={file:'/large.png',type:'image/png'};await Promise.all([f.send(options),f.send(options)]);assert.equal(f.stats.reads,1);await f.send(options);assert.equal(f.stats.reads,2);assert.equal(f.stats.gzips,0);});
