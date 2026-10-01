const test=require('node:test'),assert=require('node:assert/strict');
const {CampaignApi}=require('../campaign-api');
function fixture(){const records=new Map();const store={get:async code=>structuredClone(records.get(code)||null),create:async c=>{if(records.has(c.code))return false;records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]};let api=new CampaignApi({store,storageMode:'test'});
const call=async(path,body={},status=200)=>{let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,code,value)=>{assert.equal(code,status,JSON.stringify(value));result=value;});return result;};
return{call,restart:()=>{api=new CampaignApi({store,storageMode:'test'});},api:()=>api,records};}
test('Crew Log save, connected submission, approval, claim, portable backup and library permissions',async()=>{
 const f=fixture(),created=await f.call('v03/create',{name:'Crew Log test'},201),code=created.campaign.code,token=created.token;
 const joined=await f.call('v03/join',{code,name:'Tester'}),pcToken=joined.token;
 let result=await f.call('v03/character/create',{code,token:pcToken,password:'',character:{phase:'finalized',identity:{characterName:'Nova'},resources:{reverence:4}}});const id=result.campaign.ownCharacterId;
 const log=body=>f.call('crew-log',{code,token:pcToken,session:0,...body});
 result=await log({kind:'save',name:'Flight Notes',text:'Arrived safely.',revision:0});const entry=result.campaign.crewLogs[0];assert.equal(entry.revision,1);
 await f.call('crew-log',{code,token:pcToken,kind:'save',session:0,revision:0,text:'stale'},409);
 await f.call('crew-log',{code,token:pcToken,kind:'submit',session:0,revision:1,text:'Arrived safely.'},409);
 f.api().clients.set(code,new Set([{token,response:{write(){}}}]));
 result=await log({kind:'submit',revision:1,name:'Flight Notes',text:'Arrived safely.'});assert.ok(result.campaign.crewLogs[0].submittedAt);
 await f.call('crew-log',{code,token:pcToken,kind:'approve',id:entry.id},409);
 await f.call('crew-log',{code,token,kind:'approve',id:entry.id});await f.call('crew-log',{code,token,kind:'approve',id:entry.id});
 const c=await f.api().campaign(code),reward=c.privateNotes.find(n=>n.kind==='award');assert.equal(c.awardHistory.length,1);assert.equal(reward.rewardStatus,'pending');
 const before=c.characters[0].character.resources.reverence;await f.call('award/claim',{code,token:pcToken,noteId:reward.id});await f.call('award/claim',{code,token:pcToken,noteId:reward.id});assert.equal(c.characters[0].character.resources.reverence,before+1);
 await f.call('crew-log',{code,token,kind:'data',title:'Chart 7',text:'Avoid the singularity.'});
 c.starships=[{id:'s',title:'Test',crewCharacterIds:[id],ship:{title:'Test',gridCells:[],sicInventory:[],placements:[]}}];
 const archive=await f.call('crew-log',{code,token:pcToken,kind:'library',starshipId:'s'});assert.equal(archive.entries[0].title,'Chart 7');assert.equal(archive.logs.length,1);
 await f.call('crew-log',{code,token:pcToken,kind:'library',starshipId:'another'},409);
 let backup;await f.api().handle({method:'GET'},{},new URL(`http://test/api/campaign/backup?code=${code}&token=${token}`),async()=>{},(_,status,data)=>{assert.equal(status,200);backup=data;});assert.equal(backup.campaign.crewLogs[0].text,'Arrived safely.');assert.equal(backup.campaign.libraryEntries.length,1);
 f.restart();const loaded=await f.api().campaign(code);assert.equal(loaded.crewLogs[0].awardId,reward.awardId);assert.equal(loaded.libraryEntries[0].title,'Chart 7');
});
test('Explore compact state keeps unselected layouts out and explicit details restores selected data only',async()=>{
 const f=fixture(),demo=await f.call('showcase/start',{}),code=demo.code,token=demo.gmToken;let compact;
 await f.api().handle({method:'GET'},{},new URL(`http://test/api/campaign/state?code=${code}&token=${token}&compact=1`),async()=>{},(_,status,data)=>{assert.equal(status,200);compact=data.campaign||data;});
 const lazy=compact.starships.filter(s=>s.lazyLayout);assert.ok(lazy.length>=20);assert.ok(lazy.every(s=>s.ship.gridCells.length===0&&s.hullCount>0));
 const selected=await f.call('starship/details',{code,token,ids:[lazy[0].id]});assert.ok(selected.starships[0].ship.gridCells.length>0);
 const after=f.api().state(await f.api().campaign(code),token);assert.equal(after.starships.find(s=>s.id===lazy[0].id).lazyLayout,undefined);assert.equal(after.starships.find(s=>s.id===lazy[1].id).lazyLayout,true);
});
