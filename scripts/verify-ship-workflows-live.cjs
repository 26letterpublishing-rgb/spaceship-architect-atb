// Bounded code-only deployment check; avoid redownloading the artwork catalog.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=process.env.SA_VERIFY_BASE||'https://spaceship-architect-atb.onrender.com',root=path.resolve(__dirname,'..');
const files=['app.js','character.js','starship.js','ship-navigation.js','ship-navigation-ui.js','ship-sensors.js','ship-map-core.js','ship-combat-map.js','space-map.js','ship-print.js','ship-pass2.css','console-common.js','console-feedback.js','combat-actions.js','combat-feedback.js','combat-feedback.css','lock-console-ui.js','sensor-console-ui.js','view-ready.js','starship.html','character.html','index.html','gm.html','showcase.html'];
const digest=text=>crypto.createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
async function main(){
  const wanted=digest(fs.readFileSync(path.join(root,'app.js'),'utf8'));let response;
  for(let attempt=0;attempt<20;attempt++){
    response=await fetch(base+'/app.js',{signal:AbortSignal.timeout(45000)});
    if(response.ok&&digest(await response.text())===wanted)break;
    if(attempt===19)throw Error('Deployment did not become current within ten minutes');
    await new Promise(resolve=>setTimeout(resolve,30000));
  }
  const cached=await fetch(base+'/app.js',{headers:{'If-None-Match':response.headers.get('etag')},signal:AbortSignal.timeout(30000)});assert.equal(cached.status,304);
  for(const file of files){const r=await fetch(base+'/'+file,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,file);assert.equal(digest(await r.text()),digest(fs.readFileSync(path.join(root,file),'utf8')),file+' differs');}
  console.log(`PASS ${files.length} hosted code/style/page files match; conditional app.js request returned 304.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
