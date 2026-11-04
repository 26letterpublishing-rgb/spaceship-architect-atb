const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('NPC Exertion HTTP authorization, automation transitions, single spending and durable reload',{timeout:45000},async t=>{
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'sa-npc-exertion-')),root=path.resolve(__dirname,'..');let child;
  async function boot(){child=spawn(process.execPath,['server.js'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:data},stdio:['ignore','pipe','pipe']});return new Promise((resolve,reject)=>{let log='';const timer=setTimeout(()=>reject(Error(log||'startup timeout')),12000);child.once('error',reject);child.stderr.on('data',b=>log+=b);child.stdout.on('data',b=>{log+=b;const m=log.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});});}
  async function stop(){if(child&&child.exitCode===null){const exit=once(child,'exit');child.kill();await exit;}}
  t.after(stop);let base=await boot();
  async function post(route,body,status=200){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j;}
  const created=await post('/api/campaign/create',{name:'NPC Exertion QA',gmCode:'owned-test'},201),code=created.campaign.code;let token=created.token;
  const act=(body,status=200)=>post('/api/action',{roomCode:code,gmToken:token,...body},status);
  const pending=await post('/api/campaign/join/request',{code,character:{id:'owned-pc',phase:'finalized',access:{pcCode:'owned-pc-code'},identity:{characterName:'Owned PC'},attributes:{health:[1,1],willpower:[3,0,0,0]},health:{current:20},resources:{exertionCurrent:1,exertionMax:2}}},201);
  await post('/api/campaign/join/respond',{code,token,requestId:pending.requestId,decision:'approve'});
  const joined=await post('/api/campaign/join/status',{code,characterId:'owned-pc',pcCode:'owned-pc-code'});

  const state=()=>fetch(base+'/api/state?room='+code+'&token='+token).then(r=>r.json());
  let s=await act({action:'addUnit',team:'npc',controlledBy:'gm',characterName:'Exertion NPC',mentalAttribute:5,physicalAttribute:4,speed:5,maximumHp:40,currentHp:40});const id=s.units.find(u=>u.characterName==='Exertion NPC').id;
  assert.equal(s.units.find(u=>u.id===id).exertionCurrent,4);
  await act({action:'setNpcCombatStat',id,field:'exertionCurrent',value:0,gmToken:'wrong'},403);
  await act({action:'setNpcCombatStat',id,field:'exertionCurrent',value:5},400);
  await act({action:'setNpcCombatStat',id,field:'exertionCurrent',value:0,gmToken:joined.token,characterId:'owned-pc',characterToken:joined.token},403);
  s=await act({action:'setNpcCombatStat',id,field:'exertionCurrent',value:2});assert.equal(s.units.find(u=>u.id===id).exertionCurrent,2);
  // Owned backup seeds a pending real Defense step and recovery without live encounter mutation.
  let backup;const initialDeadline=Date.now()+5000;do{backup=await fetch(base+'/api/campaign/backup?code='+code+'&token='+token).then(r=>r.json());if(backup.campaign.encounter?.units.find(u=>u.id===id)?.exertionCurrent===2)break;await new Promise(r=>setTimeout(r,50));}while(Date.now()<initialDeadline);
  assert.ok(backup.campaign.encounter);const u=backup.campaign.encounter.units.find(u=>u.id===id);u.frozenSeconds=100;u.exertionCurrent=2;
  backup.campaign.encounter.attackResolution={id:'owned-defense',phase:'checks',attackerId:'other',defenderId:id,attackerName:'Other',defenderName:'Exertion NPC',weaponName:'Unarmed'};
  await post('/api/campaign/restore',{code,token,backup});
  await act({action:'submitAttackRoll',id,attackId:'owned-defense',rollRole:'defender',score:12,exertion:3},400);
  await act({action:'submitAttackDamage',id,attackId:'owned-defense',rolledDamage:12,exertion:1},400);
  await act({action:'setAutomation',id,mode:'npc'});
  await act({action:'submitAttackRoll',id,attackId:'owned-defense',rollRole:'defender',score:12,exertion:1},400);
  await act({action:'cancelPersonalRecovery',id},409);
  assert.equal((await state()).units.find(u=>u.id===id).exertionCurrent,2);
  await act({action:'setAutomation',id,mode:'off'});
  s=await act({action:'submitAttackRoll',id,attackId:'owned-defense',rollRole:'defender',score:12,exertion:1});assert.equal(s.units.find(u=>u.id===id).exertionCurrent,1);
  await act({action:'submitAttackRoll',id,attackId:'owned-defense',rollRole:'defender',score:12,exertion:1},409);
  s=await act({action:'cancelPersonalRecovery',id});assert.equal(s.units.find(u=>u.id===id).exertionCurrent,0);await act({action:'cancelPersonalRecovery',id},409);
  // Wait for the existing durable write queue, then restart ONLY this owned process.
  const deadline=Date.now()+5000;let saved;
  do{saved=JSON.parse(fs.readFileSync(path.join(data,'campaigns.json'),'utf8')).find(c=>c.code===code);if(saved.encounter?.units.find(u=>u.id===id)?.exertionCurrent===0)break;await new Promise(r=>setTimeout(r,50));}while(Date.now()<deadline);
  assert.equal(saved.encounter.units.find(u=>u.id===id).exertionCurrent,0);
  assert.equal(saved.npcRoster.find(u=>u.id===id).exertionCurrent,0);
  await stop();base=await boot();const login=await post('/api/campaign/open',{name:'NPC Exertion QA',gmCode:'owned-test'});token=login.token;
  s=await state();assert.equal(s.units.find(u=>u.id===id).exertionCurrent,0);assert.equal(s.units.find(u=>u.id===id).exertionMax,4);
  const campaign=await fetch(base+'/api/campaign/state?code='+code+'&token='+token).then(r=>r.json());assert.equal(campaign.characters.find(c=>c.id==='owned-pc').character.resources.exertionCurrent,1);
  const unit={team:'npc',npcRosterId:id,characterName:'Exertion NPC',mentalAttribute:5,physicalAttribute:4,speed:5,maximumHp:40,currentHp:40,exertionCurrent:4,location:{arenaId:'surface',square:0,mesh:4}};
  s=await act({action:'prepareEncounter',preparationId:'owned-exertion-preparation',mode:'surface',starships:[],units:[unit],arena:{width:4,height:4,floors:[0,1,20,21]}});assert.equal(s.units.find(u=>u.id===id).exertionCurrent,0,'Re-preparation cannot refill an existing NPC');
  await act({action:'removeUnit',id});
  s=await act({action:'addUnit',...unit,exertionCurrent:99});assert.equal(s.units.find(u=>u.id===id).exertionCurrent,0,'Re-adding the saved NPC retains authoritative spent balance');

});
