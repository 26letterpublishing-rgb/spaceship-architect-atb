const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{once}=require('node:events');
test('GM portable roster and Story imports work in Explore and preserve shops and commands',{timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sa-files-http-')),child=spawn(process.execPath,['server.js'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,PORT:'0',DATABASE_URL:'',SA_LOCAL_DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',c=>{const url=String(c).match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];if(url){clearTimeout(timer);resolve(url);}});});
 const post=async(p,b,status=200)=>{const r=await fetch(base+'/api/campaign/'+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;};
 const demo=await post('showcase/start',{}),gm={code:demo.code,token:demo.gmToken},pc={code:demo.code,token:demo.players[0].token};
 const state=()=>fetch(`${base}/api/campaign/state?code=${gm.code}&token=${gm.token}`).then(r=>r.json());
 const before=await state(),character=structuredClone(before.characters[0].character);character.identity.characterName='Imported Pilot';
 const roster={format:'sa2roster',version:1,characters:[character],npcs:[{name:'Imported Sentinel',maximumHp:42,physicalAttribute:8,mentalAttribute:6,physicalSkill:2,mentalSkill:1,speed:5,moveSpeed:3,heldWeaponId:'power-drill'}]};
 const denied=await fetch(base+'/api/campaign/roster/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...pc,file:roster})});assert.ok([403,409].includes(denied.status));
 const loaded=await post('roster/import',{...gm,file:roster});assert.equal(loaded.added,2);assert.equal(loaded.campaign.characters.length,before.characters.length+1);assert.ok(loaded.campaign.characters.some(c=>c.character.identity.characterName==='Imported Pilot'));assert.ok(loaded.campaign.npcRoster.some(n=>n.characterName==='Imported Sentinel'&&n.maximumHp===42));
 await post('roster/import',{...gm,file:{format:'sa2roster',version:1,characters:[{}],npcs:[]}},400);assert.equal((await state()).characters.length,loaded.campaign.characters.length);
 const story={format:'sa2story',version:1,chapters:[{id:'arrival',name:'Arrival',script:'Visit ::Shop:outpost::'}],actions:[{id:'action',keyword:'Greeting',kind:'message',message:'Welcome',attribute:'Charisma',skill:'Persuasion',difficulty:5}],shops:[{id:'outpost',name:'Outpost',active:true,modifier:-25}]};
 await post('script/import',{...gm,file:story});let after=await state();assert.equal(after.scriptChapters[0].script,story.chapters[0].script);assert.equal(after.conditionalActions[0].keyword,'Greeting');assert.equal(after.shops.list.find(s=>s.id==='outpost').active,false);
 await post('shops',{...gm,operation:'activate',shopId:'outpost',active:true});after=await state();assert.equal(after.shops.list.find(s=>s.id==='outpost').active,true);
});
