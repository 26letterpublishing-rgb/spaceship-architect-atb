const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),assets=require('../public-assets'),stage=require('../scripts/stage-release-public.cjs'),manifest=require('../debug-tools-manifest.json');
test('shared explicitly enables production Debug, while release and explicit disable remain authoritative',()=>{
 assert.equal(assets.debugToolsEnabled({NODE_ENV:'production',SA_APP_MODE:'shared'}),true);
 assert.equal(assets.debugToolsEnabled({NODE_ENV:'production'}),false);
 assert.equal(assets.debugToolsEnabled({NODE_ENV:'production',SA_APP_MODE:'release',SA_DEBUG_TOOLS:'1'}),false);
 assert.equal(assets.debugToolsEnabled({NODE_ENV:'production',SA_APP_MODE:'shared',SA_DEBUG_TOOLS:'0'}),false);
 for(const file of ['/server.js','/data/campaigns.json','/.env','/debug-tools-manifest.json'])assert.equal(assets.resolvePublicAsset(root,file,{debugTools:true}),null);
});
test('shared and stripped artifacts verify independently, preserve versions and reject profile mismatch/tampering',()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'sa-shared-stage-')),target=path.join(parent,'public'),shared=stage.build(target,'shared');
 assert.equal(shared.profile,'shared');assert.equal(shared.excluded,0);assert.equal(stage.verify(target,'shared').stage,shared.stage);
 for(const f of manifest.runtimeFiles)assert.deepEqual(fs.readFileSync(path.join(shared.stage,f)),fs.readFileSync(path.join(root,f)));
 for(const dir of manifest.runtimeDirectories)assert(fs.existsSync(path.join(shared.stage,dir)));
 assert.throws(()=>stage.resolveStage(target,'release'),/profile mismatch/);assert(stage.build(target,'shared').reused);
 assert(!fs.existsSync(path.join(shared.stage,'server.js')));assert(!fs.existsSync(path.join(shared.stage,'data/campaigns.json')));
 const stripped=stage.build(target,'release');assert.notEqual(stripped.stage,shared.stage);assert(fs.existsSync(path.join(shared.stage,'music-preview.html')));
 assert.equal(stage.verify(target,'release').profile,'release');assert.throws(()=>stage.resolveStage(target,'shared'),/profile mismatch/);
 for(const f of manifest.runtimeFiles)assert(!fs.existsSync(path.join(stripped.stage,f)));
 for(const dir of manifest.runtimeDirectories)assert(!fs.existsSync(path.join(stripped.stage,dir)));
 fs.appendFileSync(path.join(stripped.stage,'home-screen.js'),'\n// isolated integrity probe');assert.throws(()=>stage.verify(target,'release'),/integrity/);assert.throws(()=>stage.build(target,'shared'),/integrity/);
});
