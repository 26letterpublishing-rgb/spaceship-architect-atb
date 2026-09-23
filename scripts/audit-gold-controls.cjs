const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),gold=path.resolve(process.argv[2]||path.join(root,'..','sa-atb-multiplayer_GOLD-STANDARD-BACKUP_20260906-122807'));
const report={reference:gold,missingFiles:[],missingHtmlIds:[],mapControls:[]};
for(const file of fs.readdirSync(gold).filter(f=>/\.(?:html|js)$/.test(f))){
 if(!fs.existsSync(path.join(root,file))){report.missingFiles.push(file);continue;}
 if(!file.endsWith('.html'))continue;
 const old=fs.readFileSync(path.join(gold,file),'utf8'),now=fs.readFileSync(path.join(root,file),'utf8');
 for(const [,id] of old.matchAll(/\bid="([^"]+)"/g))if(!now.includes(`id="${id}"`))report.missingHtmlIds.push({file,id,intentional:id==='enterCombatStation'});
 if(file==='starship.html')for(const [,key] of old.matchAll(/data-map-toggle="([^"]+)"/g))if(!report.mapControls.includes(key)){assert.ok(now.includes(`data-map-toggle="${key}"`),`${key} missing from builder`);report.mapControls.push(key);}
}
assert.deepEqual(report.missingFiles,[]);assert.deepEqual(report.missingHtmlIds.filter(x=>!x.intentional),[]);
console.log(JSON.stringify(report,null,2));
console.log('Static preservation screen passed. Browser access/behavior is covered separately by playtest-ship-workflows.cjs; this is not proof of every historical workflow.');
