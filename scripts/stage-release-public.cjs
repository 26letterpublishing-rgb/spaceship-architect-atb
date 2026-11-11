'use strict';
// Public assets only. Never removes source files, notes or previous staged versions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=fs.realpathSync(path.resolve(__dirname,'..'));
const {resolvePublicAsset}=require('../public-assets');
const tools=require('../debug-tools-manifest.json').runtimeFiles;
const toolDirectories=require('../debug-tools-manifest.json').runtimeDirectories||[];
const project=require('../package.json').name;
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
function container(input,create=false){
 if(!input)throw Error('Set SA_RELEASE_PUBLIC_DIR or supply an explicit staging directory.');
 const requested=path.resolve(input);
 // Resolve the existing parent before creating anything; reject symlink aliases into source.
 const root=fs.existsSync(requested)?fs.realpathSync(requested):path.join(fs.realpathSync(path.dirname(requested)),path.basename(requested));
 const dedicated=path.join(source,'.release-public');
 if(root.toLowerCase()===source.toLowerCase()||inside(root,source)||(inside(source,root)&&root.toLowerCase()!==dedicated.toLowerCase()))throw Error('Public staging must be separate from source files; only .release-public is permitted inside the checkout.');
 if(fs.existsSync(requested)&&fs.lstatSync(requested).isSymbolicLink())throw Error('Staging directory cannot be a symlink.');
 const marker=path.join(root,'staging-owner.json');
 if(!fs.existsSync(root)){
  if(!create)throw Error('Public staging does not exist.');
  fs.mkdirSync(root);fs.writeFileSync(marker,JSON.stringify({project,kind:'public-release-assets/v1'}),{flag:'wx'});
 }
 if(!fs.lstatSync(marker).isFile()||fs.lstatSync(marker).isSymbolicLink())throw Error('Unsafe staging owner marker.');
 const owner=JSON.parse(fs.readFileSync(marker,'utf8'));
 if(owner.project!==project||owner.kind!=='public-release-assets/v1')throw Error('Unrecognized public staging directory.');
 return root;
}
function checkedProfile(profile){if(!['release','shared'].includes(profile))throw Error('Unknown public build profile');return profile;}
function records(profile='release'){
 checkedProfile(profile);
 const candidates=fs.readdirSync(source,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name);
 for(const dir of ['fonts','vendor','data'])if(fs.existsSync(path.join(source,dir)))for(const e of fs.readdirSync(path.join(source,dir),{withFileTypes:true}))if(e.isFile())candidates.push(dir+'/'+e.name);
 if(profile==='shared'){
  function walk(relative){const absolute=path.join(source,relative);if(fs.lstatSync(absolute).isSymbolicLink())throw Error('Unsafe Debug source: '+relative);if(fs.statSync(absolute).isDirectory()){for(const name of fs.readdirSync(absolute))walk(relative+'/'+name);}else candidates.push(relative);}
  for(const dir of toolDirectories)walk(dir);
 }
 const files=new Set();
 for(const candidate of candidates){const file=resolvePublicAsset(source,'/'+candidate,{debugTools:profile==='shared'});if(file&&fs.existsSync(file)){
  if(!inside(source,file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink())throw Error('Unsafe public source: '+candidate);
  files.add(path.relative(source,file).split(path.sep).join('/'));
 }}
 return [...files].sort().map(file=>({file,sha256:digest(path.join(source,file))}));
}
function resolveStage(input,expectedProfile){
 const root=container(input),pointer=path.join(root,'current.json');
 if(!fs.lstatSync(pointer).isFile()||fs.lstatSync(pointer).isSymbolicLink())throw Error('Unsafe release pointer.');
 const current=JSON.parse(fs.readFileSync(pointer,'utf8'));
 if(!/^version-[a-zA-Z0-9_-]+$/.test(current.directory))throw Error('Invalid release version.');
 const stage=path.join(root,current.directory);
 if(!fs.lstatSync(stage).isDirectory()||fs.lstatSync(stage).isSymbolicLink())throw Error('Unsafe release version directory.');
 verifyContents(stage,expectedProfile);
 return stage;
}
function verifyContents(stage,expectedProfile){
 for(const file of ['index.html','home-screen.js','transit-console-ui.js','console-common.js','warp-effects.js'])if(!fs.statSync(path.join(stage,file)).isFile())throw Error('Missing production asset: '+file);
 const manifestFile=path.join(stage,'release-assets.json');
 if(fs.lstatSync(manifestFile).isSymbolicLink())throw Error('Unsafe release manifest.');
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 if(manifest.project!==project||!Array.isArray(manifest.files))throw Error('Invalid release manifest.');
 const profile=checkedProfile(manifest.profile||'release');
 if(expectedProfile&&profile!==checkedProfile(expectedProfile))throw Error('Public build profile mismatch: expected '+expectedProfile+', found '+profile);
 if(profile==='release'){
  for(const file of tools)if(fs.existsSync(path.join(stage,file)))throw Error('Debug tool present in release: '+file);
  for(const dir of toolDirectories)if(fs.existsSync(path.join(stage,dir)))throw Error('Debug capture directory present in release: '+dir);
 }else{
  for(const file of tools)if(!fs.existsSync(path.join(stage,file)))throw Error('Missing shared Debug asset: '+file);
  for(const dir of toolDirectories)if(!fs.existsSync(path.join(stage,dir)))throw Error('Missing shared Debug directory: '+dir);
 }
 const expected=new Set(['release-assets.json']);
 for(const entry of manifest.files){const file=path.resolve(stage,entry.file);if(!inside(stage,file)||expected.has(entry.file)||!fs.lstatSync(file).isFile()||fs.lstatSync(file).isSymbolicLink()||digest(file)!==entry.sha256)throw Error('Release integrity failed: '+entry.file);expected.add(entry.file);}
 function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isSymbolicLink())throw Error('Unexpected release symlink');if(item.isDirectory())walk(file);else if(!expected.delete(path.relative(stage,file).split(path.sep).join('/')))throw Error('Unexpected release asset: '+file);}}
 walk(stage);if(expected.size)throw Error('Missing release assets.');
 return {stage,profile,files:manifest.files.length,excluded:profile==='release'?tools.length:0};
}
function verify(input,expectedProfile){return verifyContents(resolveStage(input,expectedProfile),expectedProfile);}
function build(input,profile='release'){
 checkedProfile(profile);
 const root=container(input,true),files=records(profile);
 if(fs.existsSync(path.join(root,'current.json'))){const checked=verify(root),previous=JSON.parse(fs.readFileSync(path.join(checked.stage,'release-assets.json'),'utf8'));if(checked.profile===profile&&JSON.stringify(previous.files)===JSON.stringify(files))return {...checked,reused:true};}
 const stage=fs.mkdtempSync(path.join(root,'version-'));
 for(const record of files){const destination=path.join(stage,record.file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(source,record.file),destination,fs.constants.COPYFILE_EXCL);if(digest(destination)!==record.sha256)throw Error('Copy verification failed: '+record.file);}
 fs.writeFileSync(path.join(stage,'release-assets.json'),JSON.stringify({project,profile,files},null,2),{flag:'wx'});
 verifyContents(stage,profile);
 // Atomic pointer replacement; previous complete versions remain recoverable.
 const pending=path.join(root,'current-'+crypto.randomUUID()+'.tmp');
 fs.writeFileSync(pending,JSON.stringify({directory:path.basename(stage)}),{flag:'wx'});
 fs.renameSync(pending,path.join(root,'current.json'));
 return {...verify(root,profile),reused:false};
}
module.exports={build,verify,resolveStage,records};
if(require.main===module){try{const [mode,target,...extra]=process.argv.slice(2);if(extra.length||!['--build','--verify'].includes(mode))throw Error('Usage: stage-release-public.cjs --build|--verify [directory]');const profile=String(process.env.SA_APP_MODE||'').trim().toLowerCase()==='shared'?'shared':'release';console.log(JSON.stringify((mode==='--build'?build:verify)(target||process.env.SA_RELEASE_PUBLIC_DIR,profile),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
