'use strict';
// Operates only on an explicitly marked disposable release copy, never this checkout.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=require('../debug-tools-manifest.json');
const checkout=fs.realpathSync(path.resolve(__dirname,'..'));
const project=require('../package.json').name;
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function contained(root,file){const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);}
function stageRoot(input,mutating=false){
 if(!input)throw Error('Supply an explicit release staging directory.');
 const root=fs.realpathSync(path.resolve(input));
 if(!fs.statSync(root).isDirectory())throw Error('Release staging path must be a directory.');
 if(mutating){
  if(root.toLowerCase()===checkout.toLowerCase()||contained(checkout,root)||contained(root,checkout))throw Error('Refusing to modify this checkout or its parent/child directories.');
  if(fs.existsSync(path.join(root,'.git')))throw Error('Refusing to modify a Git checkout.');
  const marker=path.join(root,'.sa-release-staging.json');
  if(!fs.existsSync(marker)||fs.lstatSync(marker).isSymbolicLink())throw Error('Missing explicit disposable staging marker.');
  const value=JSON.parse(fs.readFileSync(marker,'utf8'));
  if(value.project!==project||value.disposable!==true)throw Error('Staging marker must name this project and disposable:true.');
 }
 for(const file of manifest.preservedProductionFiles){const target=path.resolve(root,file);if(!contained(root,target)||!fs.existsSync(target)||!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('Missing or unsafe production file: '+file);}
 return root;
}
function toolFiles(root){const files=manifest.runtimeFiles.filter(file=>fs.existsSync(path.join(root,file)));function walk(relative){const absolute=path.resolve(root,relative);if(!contained(root,absolute)||fs.lstatSync(absolute).isSymbolicLink())throw Error('Unsafe tool path: '+relative);if(fs.lstatSync(absolute).isDirectory()){for(const name of fs.readdirSync(absolute))walk(path.join(relative,name));}else if(fs.lstatSync(absolute).isFile())files.push(relative);else throw Error('Unsafe tool path: '+relative);}for(const dir of manifest.runtimeDirectories||[])if(fs.existsSync(path.join(root,dir)))walk(dir);return files;}
function check(input){const root=stageRoot(input),remaining=toolFiles(root);if(remaining.length)throw Error('Development tools remain in release copy: '+remaining.join(', '));return {root,excluded:manifest.runtimeFiles.length};}
function strip(input){
 const root=stageRoot(input,true),preserved=Object.fromEntries(manifest.preservedProductionFiles.map(file=>[file,hash(path.join(root,file))]));
 const files=toolFiles(root).map(file=>({file,target:path.resolve(root,file)}));
 for(const {file,target}of files)if(!contained(root,target)||!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('Unsafe tool path: '+file);
 if(!files.length)return {...check(root),alreadyExcluded:true};
 const backup=fs.mkdtempSync(root+'.debug-tools-backup-');
 const records=files.map(({file,target})=>({file,sha256:hash(target)}));
 for(const {file,target}of files){const copy=path.resolve(backup,file);if(!contained(backup,copy))throw Error('Invalid backup path');fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(target,copy);if(hash(copy)!==records.find(r=>r.file===file).sha256)throw Error('Backup verification failed: '+file);}
 fs.writeFileSync(path.join(backup,'restore-manifest.json'),JSON.stringify({project,source:root,files:records,preserved},null,2));
 fs.writeFileSync(path.join(backup,'RESTORE.txt'),'Verified recovery copies of development-only assets. To restore, copy the listed files to the recorded staging source only after confirming its identity. Do not overwrite newer files. This backup is outside the release directory.\n');
 // Every source and recovery copy has been checked before removing these six exact files.
 for(const {file,target}of files){if(hash(target)!==records.find(r=>r.file===file).sha256)throw Error('Source changed during preparation: '+file);fs.unlinkSync(target);}
 for(const [file,before]of Object.entries(preserved))if(hash(path.join(root,file))!==before)throw Error('Production file changed: '+file);
 return {...check(root),backup,removed:records.length};
}
module.exports={check,strip,stageRoot};
if(require.main===module){try{const [mode,target,...extra]=process.argv.slice(2);if(extra.length||!['--check','--strip'].includes(mode))throw Error('Usage: release-debug-tools.cjs --check|--strip <staging-directory>');console.log(JSON.stringify(mode==='--strip'?strip(target):check(target),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
