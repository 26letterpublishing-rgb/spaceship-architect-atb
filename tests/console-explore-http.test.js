const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('expanded Explore crew, compact sensor ranges and authorized ship removal preserve campaign records',{timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-counter-http-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};

 const demo=await post('campaign/showcase/start',{});assert.equal(demo.players.length,2);
 const state=()=>fetch(`${base}/api/state?room=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());let s=await state();assert.equal(s.units.filter(u=>u.team==='npc').length,4);
 const selected=s.starships[1],pc=demo.players[0];
 await post('action',{roomCode:demo.code,characterId:pc.id,characterToken:pc.token,action:'removeStarship',starshipId:selected.id},403);
 await post('action',{roomCode:demo.code,gmToken:demo.gmToken,action:'removeStarship',starshipId:selected.id});s=await state();assert.ok(!s.starships.some(v=>v.id===selected.id));assert.ok(!s.units.some(u=>u.location?.starshipId===selected.id));assert.ok(!s.shipPositions.some(v=>v.id===selected.id));
 const campaign=await fetch(`${base}/api/campaign/state?code=${demo.code}&token=${demo.gmToken}&compact=1`).then(r=>r.json());assert.ok(campaign.starships.some(v=>v.id===selected.id));const scout=campaign.starships.find(v=>v.title==='Scout');assert.ok(scout.sensorSummary.range>0);
});
