const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
async function startFixture(){
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-melee-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);
 const base=await new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error(log+stderr)),15000);child.once('error',reject);child.stdout.on('data',b=>{log+=b;const m=log.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});
 const post=async(route,body,status=200)=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;};
 const created=await post('/api/campaign/create',{name:'Melee isolated QA',gmCode:'owned-test'},201),code=created.campaign.code,token=created.token;
 const act=(body,status=200)=>post('/api/action',{roomCode:code,gmToken:token,...body},status);
 const state=()=>fetch(base+'/api/state?room='+code+'&token='+token).then(r=>r.json());
 await act({action:'addUnit',team:'npc',characterName:'Attacker',speed:5,maximumHp:30});
 let backup;for(let n=0;n<40;n++){backup=await fetch(base+'/api/campaign/backup?code='+code+'&token='+token).then(r=>r.json());if(backup.campaign.encounter?.units.length)break;await new Promise(r=>setTimeout(r,50));}
 const E=require('../combat-engine'),A=require('../combat-arena');
 function encounter(square=25){
  const u=(id,sq)=>({id,team:'npc',characterName:id,currentHp:30,maximumHp:30,speed:5,atb:100,exertionCurrent:2,exertionMax:2,location:{arenaId:'surface',square:sq,mesh:4},weapons:[{inventoryId:id+'-weapon',weaponId:'unarmed'}],heldWeaponId:id+'-weapon'});
  const a=u('attacker',24),b=u('defender',square);E.migrateUnitCombat(a);E.migrateUnitCombat(b);
  return {...structuredClone(backup.campaign.encounter),arena:A.normalize({width:7,height:7,floors:Array.from({length:49},(_,i)=>i)}),units:[a,b],starships:[],vehicles:[],activeId:a.id,activeSource:'manual',running:false,hardPaused:false,pausedForTurn:true,resumeAfterTurn:false,attackResolution:null,fog:{enabled:false},victory:null};
 }
 const restore=async e=>{const b=structuredClone(backup);b.campaign.encounter=e;await post('/api/campaign/restore',{code,token,backup:b});return state();};
 return {base,code,token,act,state,post,encounter,restore,stderr:()=>stderr,stop:async()=>{if(child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}};
}
module.exports={startFixture};
if(require.main===module)test('HTTP rejects illegal melee and cancels moved pending targets without damage or spending',{timeout:60000},async t=>{
 const f=await startFixture();t.after(f.stop);
 for(const square of [16,18,30,32,24,26]){await f.restore(f.encounter(square));await f.act({action:'playerCombatAction',id:'attacker',kind:'melee',targetId:'defender'},409);await f.act({action:'gmBeginNpcAttack',attackerId:'attacker',defenderId:'defender',distance:1},409);assert.equal((await f.state()).attackResolution,null);}
 await f.restore(f.encounter());let s=await f.act({action:'playerCombatAction',id:'attacker',kind:'melee',targetId:'defender'});assert.ok(s.attackResolution);const attack=s.attackResolution;
 // Save/reload a genuine pending attack after the target changes square.
 const moved=f.encounter(32);moved.attackResolution=attack;await f.restore(moved);
 await f.act({action:'submitAttackRoll',id:'defender',attackId:attack.id,rollRole:'defender',score:3,exertion:1},409);
 s=await f.state();assert.equal(s.attackResolution,null);assert.equal(s.activeId,'attacker');assert.ok(s.units.every(u=>u.currentHp===30&&u.exertionCurrent===2));
 await f.restore(f.encounter());s=await f.act({action:'playerCombatAction',id:'attacker',kind:'melee',targetId:'defender'});
 const id=s.attackResolution.id;await f.act({action:'submitAttackRoll',id:'defender',attackId:id,rollRole:'defender',score:1});s=await f.act({action:'submitAttackRoll',id:'attacker',attackId:id,rollRole:'attacker',score:20});assert.equal(s.attackResolution.phase,'damage');
 s=await f.act({action:'submitAttackDamage',id:'attacker',attackId:s.attackResolution.id,rolledDamage:5});assert.equal(s.attackResolution.phase,'gmDamage');
 s=await f.act({action:'confirmNpcDamage',attackId:s.attackResolution.id,finalDamage:s.attackResolution.damageSummary.applied});assert.equal(s.attackResolution,null);assert.ok(s.units.find(u=>u.id==='defender').currentHp<30);
 assert.equal(f.stderr(),'');
});
