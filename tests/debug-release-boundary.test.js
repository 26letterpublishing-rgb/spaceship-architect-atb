'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),manifest=require('../debug-tools-manifest.json'),{resolvePublicAsset,debugToolsEnabled}=require('../public-assets'),release=require('../scripts/release-debug-tools.cjs');
test('release mode cannot enable Debug tools; development remains available unless explicitly disabled',()=>{
 assert(debugToolsEnabled({}));assert(debugToolsEnabled({NODE_ENV:'development'}));
 for(const env of [{NODE_ENV:'production',SA_DEBUG_TOOLS:'1'},{SA_APP_MODE:'release',SA_DEBUG_TOOLS:'1'},{NODE_ENV:' Production '},{SA_DEBUG_TOOLS:'0'},{SA_DEBUG_TOOLS:'false'},{SA_DEBUG_TOOLS:'off'}])assert.equal(debugToolsEnabled(env),false);
 for(const file of manifest.runtimeFiles){assert(resolvePublicAsset(root,'/'+file,{debugTools:true}));for(const alias of ['/'+file,'/'+file.toUpperCase(),'/'+encodeURIComponent(file[0])+file.slice(1),'/'+file.replace('c','%63')])assert.equal(resolvePublicAsset(root,alias,{debugTools:false}),null,alias);}
 for(const file of ['index.html','home-screen.js','transit-console-ui.js','transit-console.css','console-common.js','warp-effects.js'])assert(resolvePublicAsset(root,'/'+file,{debugTools:false}),file);
 assert.equal(resolvePublicAsset(root,'/debug-tools-manifest.json'),null);
 for(const file of ['alma-snapshots/catalog.json','alma-snapshots/bridge-2.json']){assert(resolvePublicAsset(root,'/'+file,{debugTools:true}));assert.equal(resolvePublicAsset(root,'/'+file,{debugTools:false}),null);assert.equal(resolvePublicAsset(root,'/'+file.toUpperCase(),{debugTools:false}),null);}
});
test('release stripping is staging-only, recoverable, exact and preserves production files and notes',()=>{
 assert.throws(()=>release.strip(root),/checkout/);
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),'sa-release-stage-'));
 for(const file of [...manifest.runtimeFiles,...manifest.preservedProductionFiles])fs.copyFileSync(path.join(root,file),path.join(stage,file));
 const notes='Personal notes stay untouched';fs.writeFileSync(path.join(stage,'saved-notes.txt'),notes);
 assert.throws(()=>release.strip(stage),/marker/);assert.throws(()=>release.check(stage),/Development tools remain/);
 fs.writeFileSync(path.join(stage,'.sa-release-staging.json'),JSON.stringify({project:require('../package.json').name,disposable:true}));
 const before=Object.fromEntries(manifest.preservedProductionFiles.map(f=>[f,fs.readFileSync(path.join(stage,f))]));
 fs.mkdirSync(path.join(stage,'alma-snapshots'));fs.writeFileSync(path.join(stage,'alma-snapshots','example.json'),'Sample capture');
 const result=release.strip(stage);assert.equal(result.removed,manifest.runtimeFiles.length+1);assert(!result.backup.startsWith(stage+path.sep));assert.equal(release.check(stage).excluded,manifest.runtimeFiles.length);
 assert.equal(fs.readFileSync(path.join(result.backup,'alma-snapshots','example.json'),'utf8'),'Sample capture');assert(!fs.existsSync(path.join(stage,'alma-snapshots','example.json')));
 for(const f of manifest.runtimeFiles){assert(!fs.existsSync(path.join(stage,f)));assert.deepEqual(fs.readFileSync(path.join(result.backup,f)),fs.readFileSync(path.join(root,f)));}
 for(const f of manifest.preservedProductionFiles)assert.deepEqual(fs.readFileSync(path.join(stage,f)),before[f]);
 assert.equal(fs.readFileSync(path.join(stage,'saved-notes.txt'),'utf8'),notes);assert(release.strip(stage).alreadyExcluded);
 const unsafe=fs.mkdtempSync(path.join(os.tmpdir(),'sa-release-unsafe-'));for(const file of manifest.preservedProductionFiles)fs.copyFileSync(path.join(root,file),path.join(unsafe,file));fs.writeFileSync(path.join(unsafe,'.sa-release-staging.json'),JSON.stringify({project:require('../package.json').name,disposable:true}));fs.mkdirSync(path.join(unsafe,manifest.runtimeFiles[0]));assert.throws(()=>release.strip(unsafe),/Unsafe tool path/);
});
async function server(env){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-release-http-')),child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,NODE_ENV:'development',SA_APP_MODE:'',SA_DEBUG_TOOLS:'',SA_RELEASE_PUBLIC_DIR:'',...env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',c=>stderr+=c);
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Startup timeout '+stderr));},20000);child.once('exit',()=>{clearTimeout(timer);reject(Error(stderr));});child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 return {base,stop:()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);child.kill();})};
}
test('actual development/release HTTP routes enforce quarantine before static cache and generic HTML/CSS rules',async()=>{
 for(const [env,enabled]of [[{},true],[{NODE_ENV:'production',SA_DEBUG_TOOLS:'1'},false],[{SA_APP_MODE:'release'},false]]){
  const s=await server(env);try{
   const config=await fetch(s.base+'/runtime-config.js');assert.equal(config.status,200);assert.equal(config.headers.get('cache-control'),'no-store');assert.match(await config.text(),new RegExp('debugTools:'+enabled));
   for(const file of manifest.runtimeFiles){for(const method of ['GET','HEAD']){const r=await fetch(s.base+'/'+file+'?stage=1',{method,headers:{'Accept-Encoding':'gzip','If-None-Match':'"old-dev-etag"','Range':'bytes=0-30'}});assert.equal(r.status,enabled?200:404,file+' '+method);await r.arrayBuffer();}
    if(!enabled){for(const alias of [file.toUpperCase(),file.replace('c','%63')]){const r=await fetch(s.base+'/'+alias);assert.equal(r.status,404,alias);await r.arrayBuffer();}}
   }
   for(const file of ['index.html','home-screen.js','transit-console-ui.js','transit-console.css','console-common.js','warp-effects.js']){const r=await fetch(s.base+'/'+file);assert.equal(r.status,200,file);await r.arrayBuffer();}
   assert.equal((await fetch(s.base+'/ping')).status,200);
   for(const file of ['alma-snapshots/catalog.json','alma-snapshots/bridge-2.json']){const r=await fetch(s.base+'/'+file);assert.equal(r.status,enabled?200:404);await r.arrayBuffer();}
  }finally{await s.stop();}
 }
});
test('release staging preserves source and prior versions, verifies artifacts and serves the staged release',async()=>{
 const staging=require('../scripts/stage-release-public.cjs'),parent=fs.mkdtempSync(path.join(os.tmpdir(),'sa-public-stage-')),target=path.join(parent,'public');
 assert.throws(()=>staging.build(root),/separate/);
 assert.throws(()=>staging.build(path.join(root,'data')),/separate/);
 assert.throws(()=>staging.build(path.dirname(root)),/separate/);
 const before=fs.readFileSync(path.join(root,'debug-tools-manifest.json'));
 const result=staging.build(target);assert(result.files>100);assert.equal(result.excluded,manifest.runtimeFiles.length);assert.equal(staging.verify(target).stage,result.stage);assert(staging.build(target).reused);
 for(const file of manifest.runtimeFiles)assert(!fs.existsSync(path.join(result.stage,file)));
 for(const dir of manifest.runtimeDirectories)assert(!fs.existsSync(path.join(result.stage,dir)));
 for(const file of ['index.html','home-screen.js','transit-console-ui.js','console-common.js','warp-effects.js'])assert.deepEqual(fs.readFileSync(path.join(result.stage,file)),fs.readFileSync(path.join(root,file)));
 assert.deepEqual(fs.readFileSync(path.join(root,'debug-tools-manifest.json')),before);
 assert(!fs.existsSync(path.join(result.stage,'server.js')));assert(!fs.existsSync(path.join(result.stage,'data/campaigns.json')));
 const s=await server({SA_APP_MODE:'release',SA_RELEASE_PUBLIC_DIR:target});try{
  const config=await fetch(s.base+'/runtime-config.js');assert.match(await config.text(),/debugTools:false/);
  for(const file of manifest.runtimeFiles)assert.equal((await fetch(s.base+'/'+file)).status,404);
  assert.equal(await (await fetch(s.base+'/home-screen.js')).text(),fs.readFileSync(path.join(root,'home-screen.js'),'utf8'));
  assert.equal((await fetch(s.base+'/ping')).status,200);
 }finally{await s.stop();}
 // Tamper only with this disposable copy: build must not bless or overwrite it.
 fs.appendFileSync(path.join(result.stage,'home-screen.js'),'\n// tamper');assert.throws(()=>staging.verify(target),/integrity/);assert.throws(()=>staging.build(target),/integrity/);
 // Model a valid older build, then prove rebuilding retains that complete version.
 const oldManifestPath=path.join(result.stage,'release-assets.json'),oldManifest=JSON.parse(fs.readFileSync(oldManifestPath,'utf8'));
 oldManifest.files.find(e=>e.file==='home-screen.js').sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(result.stage,'home-screen.js'))).digest('hex');
 fs.writeFileSync(oldManifestPath,JSON.stringify(oldManifest));staging.verify(target);
 const newer=staging.build(target);assert.notEqual(newer.stage,result.stage);assert.equal(newer.reused,false);assert.match(fs.readFileSync(path.join(result.stage,'home-screen.js'),'utf8'),/tamper/);assert.deepEqual(fs.readFileSync(path.join(newer.stage,'home-screen.js')),fs.readFileSync(path.join(root,'home-screen.js')));
 assert(fs.existsSync(path.join(root,'console-viewer.html')));
 const yaml=fs.readFileSync(path.join(root,'render.yaml'),'utf8');assert.match(yaml,/release:stage && npm run release:verify-stage/);assert.match(yaml,/key: SA_APP_MODE\s+value: release/);assert.match(yaml,/key: SA_RELEASE_PUBLIC_DIR\s+value: \.release-public/);assert.match(fs.readFileSync(path.join(root,'.gitignore'),'utf8'),/^\.release-public\/$/m);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(html.indexOf('src="runtime-config.js"')<html.indexOf('src="home-screen.js"'));
});
