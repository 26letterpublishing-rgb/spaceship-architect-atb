const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('personal effects use confirmed rolls, preserve clock pauses and survive campaign restore',{timeout:30000},async t=>{
 const child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'sa-personal-effects-'))},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const demo=await post('/api/campaign/showcase/start',{}),auth={code:demo.code,token:demo.gmToken},gm=b=>post('/api/action',{roomCode:demo.code,gmToken:demo.gmToken,...b});
 const saved=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json()),initial=saved.campaign.encounter;
 const ids=initial.units.filter(u=>u.team==='npc').slice(0,2).map(u=>u.id);assert.equal(ids.length,2);
 async function restore(configure){const c=structuredClone(saved.campaign),s=c.encounter;s.units=s.units.filter(u=>ids.includes(u.id));s.starships=[];s.shipPositions=[];s.shipDistances=[];s.arena=require('../combat-arena').normalize({width:40,height:10,floors:Array.from({length:400},(_,i)=>i)});s.fog={enabled:false};Object.assign(s,{activeId:null,activeAction:null,attackResolution:null,itemResolution:null,pausedForTurn:false,hardPaused:true,running:false,resumeAfterTurn:false,areaEffects:[]});s.units.forEach((u,i)=>Object.assign(u,{speed:1,atb:0,location:{arenaId:'surface',starshipId:'',square:41+i,mesh:4},currentHp:200,maximumHp:200,damageReduction:0,items:[],raceId:'',statuses:{},timedAction:null,delayedAction:null,weaponTimers:[],personalEffects:[],burning:null,defeatedAt:null}));configure(s,c);await post('/api/campaign/restore',{...auth,backup:{...saved,campaign:c}});}
 const actor=ids[0],target=ids[1];
 await t.test('fire boundary waits for dice and confirmation, then grows exactly once',async()=>{
  await restore(s=>s.units[0].burning={intensity:2,maximum:5,remaining:8,source:'Fire'});
  let s;for(let i=0;i<7;i++)s=await gm({action:'step'});assert.equal(s.attackResolution,null);
  s=await gm({action:'step'});assert.equal(s.attackResolution?.plan.damageFormula,'2D10');assert.equal(s.units[0].currentHp,200);
  const attackId=s.attackResolution.id;s=await gm({action:'submitAttackDamage',id:actor,attackId,rolledDamage:11});assert.equal(s.attackResolution.phase,'gmDamage');assert.equal(s.units[0].burning.intensity,2);
  s=await gm({action:'confirmNpcDamage',attackId,finalDamage:s.attackResolution.damageSummary.applied});assert.equal(s.units[0].currentHp,189);assert.equal(s.units[0].burning.intensity,3);assert.equal(s.hardPaused,true);
  await post('/api/action',{roomCode:demo.code,gmToken:demo.gmToken,action:'submitAttackDamage',id:actor,attackId,rolledDamage:11},409);
 });
 await t.test('NPC suit overflow and Wet electricity are included once in GM confirmation',async()=>{
  await restore(s=>{s.units[1].items=[{id:'suit',catalogId:'space-suit',quantity:1}];s.units[1].statuses.wet=true;s.activeId=actor;s.pausedForTurn=true;s.attackResolution={id:'armor',phase:'damage',attackerId:actor,defenderId:target,attackerName:'Attacker',defenderName:'Target',weaponId:'standard-sidearm',weaponName:'Test electricity',attackType:'ranged',plan:{damageFormula:'3D10',damageFormulaSupported:true,element:'Electricity'},attackResult:{hit:true,critical:false}};});
  let s=await gm({action:'submitAttackDamage',id:actor,attackId:'armor',rolledDamage:16});assert.equal(s.attackResolution.damageSummary.applied,12);assert.equal(s.attackResolution.damageSummary.suitAbsorbed,20);
  s=await gm({action:'confirmNpcDamage',attackId:'armor',finalDamage:12});assert.equal(s.units.find(u=>u.id===target).currentHp,188);assert.equal(s.units.find(u=>u.id===target).suitHp.suit,0);
 });
 await t.test('grenade blast uses the placed origin and solid cover blocks it',async()=>{
  await restore(s=>{s.units[0].location.square=41;s.units[1].location.square=44;s.arena.walls=['42:43'];s.units[0].thrownEffects=[{id:'grenade',weaponId:'grenade',label:'Grenade',origin:{arenaId:'surface',starshipId:'',square:42,mesh:4},remaining:1,total:1}];});
  let s=await gm({action:'step'});assert.equal(s.attackResolution?.plan.damageFormula,'3D8');s=await gm({action:'submitAttackDamage',id:actor,attackId:s.attackResolution.id,rolledDamage:10});assert.equal(s.units.find(u=>u.id===actor).currentHp,160);assert.equal(s.units.find(u=>u.id===target).currentHp,200);assert.equal(s.attackResolution,null);
 });

 await t.test('removing an explosive owner retains fuse across restore and damage still resolves',async()=>{
  await restore(s=>{s.units[0].thrownEffects=[{id:'orphan',weaponId:'grenade',label:'Grenade',origin:structuredClone(s.units[1].location),remaining:2,total:2}];});
  await gm({action:'removeUnit',id:actor});
  const backup=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());assert.equal(backup.campaign.encounter.areaEffects.find(e=>e.kind==='detached-ordnance').thrownEffects[0].remaining,2);
  await post('/api/campaign/restore',{...auth,backup});let s=await gm({action:'step'});assert.equal(s.attackResolution,null);s=await gm({action:'step'});assert.equal(s.attackResolution?.plan.damageFormula,'3D8');
  s=await gm({action:'submitAttackDamage',id:target,attackId:s.attackResolution.id,rolledDamage:10});assert.equal(s.units.find(u=>u.id===target).currentHp,150);assert.equal(s.attackResolution,null);assert.equal(s.units.some(u=>u.id===actor),false);
 });
 await t.test('Thunder accuracy and damage-count use distinct validated dice phases',async()=>{
  await restore(s=>{s.activeId=actor;s.pausedForTurn=true;s.units[0].weapons=require('../combat-engine').normalizeWeaponRows([{inventoryId:'thunder',weaponId:'thunder-rifle'}]);s.units[0].heldWeaponId='thunder';});
  let s=await gm({action:'playerCombatAction',id:actor,kind:'fire',targetId:target});let attackId=s.attackResolution.id;
  s=await gm({action:'submitAttackRoll',id:actor,attackId,rollRole:'attacker',score:40});s=await gm({action:'submitAttackRoll',id:target,attackId,rollRole:'defender',score:1});
  assert.equal(s.attackResolution.followup.kind,'accuracy');attackId=s.attackResolution.id;
  await post('/api/action',{roomCode:demo.code,gmToken:demo.gmToken,action:'submitAttackDamage',id:actor,attackId,rolledDamage:11},400);
  s=await gm({action:'submitAttackDamage',id:actor,attackId,rolledDamage:5});assert.equal(s.attackResolution.followup.kind,'damageCount');assert.equal(s.attackResolution.plan.damageFormula,'1D4');
  s=await gm({action:'submitAttackDamage',id:actor,attackId:s.attackResolution.id,rolledDamage:3});assert.equal(s.attackResolution.plan.damageFormula,'3D12');assert.equal(s.units.find(u=>u.id===target).currentHp,200);
 });
 await t.test('automatic defeated-NPC cleanup keeps already placed explosives',async()=>{
  await restore(s=>{s.units[0].currentHp=0;s.units[0].defeatedAt=Date.now()-6000;s.units[0].defeatRemovesAt=Date.now()-100;s.units[0].thrownEffects=[{id:'defeated-owner',weaponId:'grenade',label:'Grenade',origin:structuredClone(s.units[1].location),remaining:10,total:10}];});
  let copy;for(let i=0;i<40;i++){copy=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());if(!copy.campaign.encounter.units.some(u=>u.id===actor))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(copy.campaign.encounter.units.some(u=>u.id===actor),false);assert.equal(copy.campaign.encounter.areaEffects.find(e=>e.kind==='detached-ordnance').thrownEffects[0].remaining,10);
 });
 await t.test('two Bizi targets resolve separate rolls and consume exactly one action',async()=>{
  await restore(s=>{const third={...structuredClone(s.units[1]),id:'second-target',location:{arenaId:'surface',starshipId:'',square:43,mesh:4}};s.units.push(third);s.activeId=actor;s.pausedForTurn=true;s.units[0].atb=100;s.units[0].weapons=require('../combat-engine').normalizeWeaponRows([{inventoryId:'bizi',weaponId:'multi-lock-bizi-21'}]);s.units[0].heldWeaponId='bizi';});
  let s=await gm({action:'playerCombatAction',id:actor,kind:'fire',targetId:target,weaponOptions:{secondTarget:'second-target'}});
  for(const defender of [target,'second-target']){const attackId=s.attackResolution.id;assert.equal(s.attackResolution.defenderId,defender);s=await gm({action:'submitAttackRoll',id:actor,attackId,rollRole:'attacker',score:10});s=await gm({action:'submitAttackRoll',id:defender,attackId,rollRole:'defender',score:100});if(defender===target)assert.equal(s.units.find(u=>u.id===actor).atb,100);}
  assert.equal(s.attackResolution,null);assert.equal(s.units.find(u=>u.id===actor).atb,0);
 });
 await t.test('Rubber bombs independently check each target in a 3x3 area and roll per-target wall damage',async()=>{
  await restore(s=>{s.units[0].location.square=81;s.units[1].location.square=86;s.units.push({...structuredClone(s.units[1]),id:'rubber-second',location:{arenaId:'surface',starshipId:'',square:87,mesh:4}});s.activeId=actor;s.pausedForTurn=true;s.units[0].atb=100;s.units[0].weapons=require('../combat-engine').normalizeWeaponRows([{inventoryId:'rubber',weaponId:'rubber-bouncy-bombs'},{inventoryId:'launcher',weaponId:'mine-launcher'}]);s.units[0].launcherAmmo={launcher:['rubber']};s.units[0].heldWeaponId='launcher';});
  let s=await gm({action:'playerCombatAction',id:actor,kind:'fire',targetId:target});
  let attackId=s.attackResolution.id;s=await gm({action:'submitAttackRoll',id:actor,attackId,rollRole:'attacker',score:1});s=await gm({action:'submitAttackRoll',id:target,attackId,rollRole:'defender',score:100});
  assert.equal(s.attackResolution.defenderId,'rubber-second');assert.equal(s.units.find(u=>u.id===target).currentHp,200);
  attackId=s.attackResolution.id;s=await gm({action:'submitAttackRoll',id:actor,attackId,rollRole:'attacker',score:100});s=await gm({action:'submitAttackRoll',id:'rubber-second',attackId,rollRole:'defender',score:1});assert.equal(s.attackResolution.plan.damageFormula,'1D8');assert.equal(s.attackResolution.plan.damageScale,10);
  s=await gm({action:'submitAttackDamage',id:actor,attackId,rolledDamage:4});assert.equal(s.attackResolution.damageSummary.applied,40);s=await gm({action:'confirmNpcDamage',attackId,finalDamage:40});assert.equal(s.units.find(u=>u.id==='rubber-second').currentHp,160);assert.equal(s.units.find(u=>u.id===target).currentHp,200);assert.equal(s.attackResolution,null);
 });
 await t.test('GM net adjustment rejects players and persists the chosen difficulty',async()=>{
  await restore(s=>{s.units[0].net={difficulty:10};});
  await post('/api/action',{roomCode:demo.code,characterId:demo.players[0].id,characterToken:demo.players[0].token,action:'configureNet',id:actor,difficulty:15},403);
  const s=await gm({action:'configureNet',id:actor,difficulty:15});assert.equal(s.units.find(u=>u.id===actor).net.difficulty,15);
  const copy=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());assert.equal(copy.campaign.encounter.units.find(u=>u.id===actor).net.difficulty,15);
 });
 await t.test('Silent Scope reload consumes ship minerals and preserves ammunition on backup',async()=>{
  await restore((s,c)=>{const ship=structuredClone(initial.starships[0]);ship.ship.minerals={Iron:3,Magnesium:9};s.starships=[ship];c.starships=[ship];s.activeId=actor;s.pausedForTurn=true;s.units[0].location={starshipId:ship.id,square:ship.ship.gridCells[0],mesh:4};s.units[0].weapons=require('../combat-engine').normalizeWeaponRows([{inventoryId:'silent',weaponId:'silent-scope-sniper-rifle',ammoRemaining:2}]);s.units[0].heldWeaponId='silent';});
  const s=await gm({action:'playerCombatAction',id:actor,kind:'reloadWeapon',ammoMineral:'Iron'});assert.equal(s.units.find(u=>u.id===actor).weapons[0].ammoRemaining,5);assert.equal(s.starships[0].ship.minerals.Iron,0);assert.equal(s.starships[0].ship.minerals.Magnesium,9);
  const copy=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());assert.equal(copy.campaign.encounter.units.find(u=>u.id===actor).weapons[0].ammoRemaining,5);assert.equal(copy.campaign.encounter.starships[0].ship.minerals.Iron,0);
 });
 await t.test('Assassin programming is GM-only and survives campaign backup',async()=>{
  await restore(s=>{s.activeId=actor;s.pausedForTurn=true;s.units[0].weapons=require('../combat-engine').normalizeWeaponRows([{inventoryId:'assassin',weaponId:'mk-u-id-assassin'}]);s.units[0].heldWeaponId='assassin';});
  await post('/api/action',{roomCode:demo.code,characterId:demo.players[0].id,characterToken:demo.players[0].token,action:'configurePersonalWeapon',id:actor,inventoryId:'assassin',program:{kind:'target',value:target}},403);
  await post('/api/action',{roomCode:demo.code,gmToken:demo.gmToken,action:'playerCombatAction',id:actor,kind:'fire',targetId:target},409);
  let s=await gm({action:'configurePersonalWeapon',id:actor,inventoryId:'assassin',program:{kind:'target',value:target}});assert.deepEqual(s.units.find(u=>u.id===actor).weapons[0].targetProgram,{kind:'target',value:target});
  s=await gm({action:'playerCombatAction',id:actor,kind:'fire',targetId:target});assert.equal(s.attackResolution.weaponId,'mk-u-id-assassin');
  const copy=await fetch(`${base}/api/campaign/backup?code=${demo.code}&token=${demo.gmToken}`).then(r=>r.json());assert.equal(copy.campaign.encounter.units.find(u=>u.id===actor).weapons[0].targetProgram.value,target);
 });
});
