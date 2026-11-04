const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
async function launch(data){const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});let errors='';child.stderr.on('data',c=>errors+=c);const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(errors||'startup timeout')),12000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});return{base,async stop(){if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}};}
test('GM additive ship arrival preserves active encounter across duplicates, failure and restart',{timeout:45000},async t=>{const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-reinforce-http-'));let h=await launch(data);t.after(()=>h.stop());const post=async(route,body,status=200)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),v=await r.json();assert.equal(r.status,status,JSON.stringify(v).slice(0,500));return v;};const demo=await post('campaign/showcase/start',{}),act=b=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...b}),read=()=>fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json());let s=await read();const own=s.starships[0],enemy=s.starships[1],crew=s.units.filter(u=>u.location?.starshipId===own.id),incoming=s.units.filter(u=>u.location?.starshipId===enemy.id);
 await act({action:'prepareEncounter',mode:'starship',preparationId:crypto.randomUUID(),expectedEncounterId:s.encounterId,confirmCampaignName:'Explore Features',starships:[own],units:crew.map(u=>({...u,preparationUnitId:u.id})),shipPositions:[{id:own.id,q:0,r:0}]});await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});s=await read();await act({action:'nudge',id:s.units[0].id,amount:100});s=await read();
 const body={action:'addEncounterShip',mode:'starship',preparationId:crypto.randomUUID(),expectedEncounterId:s.encounterId,starships:[enemy],units:incoming.map(u=>({...u,npcRosterId:u.id,preparationUnitId:u.id})),shipPositions:[{id:enemy.id,q:18,r:3}]};const stable=v=>({encounterId:v.encounterId,activeId:v.activeId,pausedForTurn:v.pausedForTurn,hardPaused:v.hardPaused,running:v.running,own:v.starships.find(x=>x.id===own.id),crew:v.units.filter(u=>u.location?.starshipId===own.id),position:v.shipPositions.find(x=>x.id===own.id)}),before=stable(s);
 await post('action',{...body,roomCode:demo.code,characterId:demo.players[0].id,characterToken:demo.players[0].token},403);
 await post('action',{...body,roomCode:demo.code,gmToken:demo.gmToken,shipPositions:[{id:enemy.id,q:Infinity,r:0}]},400);assert.deepEqual(stable(await read()),before);
 const results=await Promise.all([act(body),act(body)]);for(const v of results)assert.equal(v.starships.length,2);s=await read();assert.deepEqual(stable(s),before);assert.equal(s.units.filter(u=>u.location?.starshipId===enemy.id).length,incoming.length);assert.deepEqual(s.shipPositions.find(v=>v.id===enemy.id),{id:enemy.id,q:18,r:3});assert.equal(s.shipDistances.find(v=>[v.a,v.b].includes(enemy.id)).units,21);
 await post('action',{...body,roomCode:demo.code,gmToken:demo.gmToken,preparationId:crypto.randomUUID()},400);
 const pcResponse=await fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.players[0].token);assert.equal(pcResponse.status,200);const pc=await pcResponse.json();assert.equal(pc.accessRole,'character');assert(pc.starships.some(v=>v.id===own.id));assert(!pc.units.some(u=>u.location?.starshipId===enemy.id));assert(!pc.log.some(e=>e.text?.includes('ship and crew added')));
 await h.stop();h=await launch(data);s=await read();assert.equal(s.encounterId,before.encounterId);assert.equal(s.activeId,before.activeId);assert.equal(s.starships.length,2);await act(body);assert.equal((await read()).units.filter(u=>u.location?.starshipId===enemy.id).length,incoming.length);

});

test('arrival preserves actual powered movement and a live attack resolution',{timeout:40000},async t=>{
 const h=await launch(fs.mkdtempSync(path.join(os.tmpdir(),'sa-reinforce-active-')));t.after(()=>h.stop());
 const post=async(route,body)=>{const r=await fetch(h.base+'/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,200,JSON.stringify(d).slice(0,600));return d;};
 for(const kind of ['movement','attack']){
  const demo=await post('campaign/showcase/start',{});await require('./helpers/combat-demo.cjs')(h.base,demo);
  const act=b=>post('action',{roomCode:demo.code,gmToken:demo.gmToken,...b}),read=()=>fetch(h.base+'/api/state?room='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
  const backup=await fetch(h.base+'/api/campaign/backup?code='+demo.code+'&token='+demo.gmToken).then(r=>r.json());
  const incoming=structuredClone(backup.campaign.starships[1]);incoming.id='arrival-'+kind;incoming.ship.id=incoming.id;incoming.title='Reinforcement';incoming.crewCharacterIds=[];incoming.crewNpcUnitIds=[];incoming.characterLocations={};backup.campaign.starships.push(incoming);
  await post('campaign/restore',{code:demo.code,token:demo.gmToken,backup});
  const setup=await read();await act({action:'prepareEncounter',mode:'starship',preparationId:crypto.randomUUID(),expectedEncounterId:setup.encounterId,confirmCampaignName:'Explore Features',starships:setup.starships,units:setup.units.map(u=>({...u,preparationUnitId:u.id})),shipPositions:setup.shipPositions});
  await act({action:'setRunning',running:true});await act({action:'setHardPaused',paused:true});let s=await read();
  const pc=s.units.find(u=>u.team==='pc'),npc=s.units.find(u=>u.team==='npc'),own=s.starships.find(v=>v.id===pc.location.starshipId),maps=require('../ship-map-core');
  if(kind==='movement'){
   const bridge=own.ship.sicInventory.find(i=>i.type==='bridge-1'),square=own.ship.placements.find(p=>p.sicId===bridge.id).cell;
   await act({action:'setCombatLocation',id:pc.id,location:{starshipId:own.id,square,mesh:0,stationed:true}});await act({action:'nudge',id:pc.id,amount:100});
   s=await act({action:'playerCombatAction',kind:'moveStarship',id:pc.id,destination:{q:80,r:0}});
   for(let n=0;n<15&&s.units.find(u=>u.id===pc.id).delayedAction;n++)s=await act({action:'step'});
   assert.equal(s.starships.find(v=>v.id===own.id).navigation.phase,'powered');
   await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
   await new Promise(r=>setTimeout(r,220));
  }else{
   const layout=maps.buildLayout(own.ship),square=[...layout.hull].find(cell=>!layout.footprint.get(cell));assert(Number.isInteger(square));
   for(const [u,mesh]of [[pc,4],[npc,5]])await act({action:'setCombatLocation',id:u.id,location:{starshipId:own.id,square,mesh,stationed:false}});
   await act({action:'nudge',id:npc.id,amount:100});s=await act({action:'gmBeginNpcAttack',attackerId:npc.id,defenderId:pc.id,distance:1,weaponName:'Unarmed',damageFormula:'1D4'});assert(s.attackResolution?.id);
   await act({action:'setHardPaused',paused:false});await act({action:'setRunning',running:true});
  }
  const observedAt=performance.now(),before=await read(),arrival={action:'addEncounterShip',mode:'starship',expectedEncounterId:before.encounterId,preparationId:crypto.randomUUID(),starships:[incoming],shipPositions:[{id:incoming.id,q:30,r:5}],units:[{team:'npc',preparationUnitId:'arrival-crew-'+kind,characterName:'Arrival crew',speed:3,currentHp:20,maximumHp:20,location:{starshipId:incoming.id,square:incoming.ship.gridCells[0],mesh:4}}]};
  assert.equal(before.hardPaused,false,'insertion is not shielded by a GM hard pause');
  if(kind==='movement')assert.equal(before.running,true,'movement clock is running during insertion');
  else{assert.equal(before.pausedForTurn,true,'pending melee rolls retain their required turn pause');assert(before.attackResolution?.id);}
  const after=await act(arrival);assert.equal(after.starships.length,3);assert.equal(after.encounterId,before.encounterId);assert.equal(after.hardPaused,before.hardPaused);assert.equal(after.running,before.running);
  for(const u of before.units)assert(after.units.some(v=>v.id===u.id));
  if(kind==='movement'){
   const nav=after.starships.find(v=>v.id===own.id).navigation;assert.equal(nav.phase,'powered');assert.deepEqual(before.starships.find(v=>v.id===own.id).navigation.target,{q:80,r:0});assert.deepEqual(nav.target,{q:80,r:0},'arrival preserves the real navigation target');
   const a=before.shipPositions.find(v=>v.id===own.id),b=after.shipPositions.find(v=>v.id===own.id);assert(b.q>=a.q);
   await new Promise(r=>setTimeout(r,250));const next=await read();assert(next.shipPositions.find(v=>v.id===own.id).q>b.q,'ship continues on the real clock after insertion');
  }else{
   const previousRemaining=before.attackResolution.defenderCommand.remaining,remaining=after.attackResolution.defenderCommand.remaining;
   assert(Number.isFinite(remaining)&&remaining>0);assert(remaining<=previousRemaining,'arrival must not reset the defender deadline');assert(previousRemaining-remaining<=(performance.now()-observedAt)/1000+.05,'arrival must not consume extra defender time');
   const expectedAttack=structuredClone(before.attackResolution);expectedAttack.defenderCommand.remaining=remaining;
   assert.deepEqual(after.attackResolution,expectedAttack);assert.equal(after.activeId,before.activeId);assert.equal(after.pausedForTurn,before.pausedForTurn);
   await act({action:'submitAttackRoll',id:pc.id,rollRole:'defender',attackId:after.attackResolution.id,score:100});
   s=await act({action:'submitAttackRoll',id:npc.id,rollRole:'attacker',attackId:after.attackResolution.id,score:0});assert.equal(s.attackResolution,null,'original attack can still resolve after arrival');assert.equal(s.starships.length,3);
  }
 }
});
