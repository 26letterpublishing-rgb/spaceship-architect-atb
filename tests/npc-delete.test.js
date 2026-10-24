const test=require('node:test'),assert=require('node:assert/strict');
const {CampaignApi}=require('../campaign-api');
test('GM NPC deletion clears assignments, preserves templates and survives normalization/reload',async()=>{
 const records=new Map(),store={get:async k=>structuredClone(records.get(k)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]};
 let live=null,api=new CampaignApi({store,liveEncounter:()=>live});
 async function call(path,body,status=200){let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,s,v)=>{assert.equal(s,status,JSON.stringify(v));result=v;});return result;}
 const room=await call('v03/create',{name:'Delete NPC QA'},201),auth={code:room.campaign.code,token:room.token},templates=[{id:'ally',name:'Ally',allyNpc:true},{id:'enemy',name:'Enemy',allyNpc:false}];
 const saved=await call('npc-templates',{...auth,templates});const npcId=saved.campaign.npcRoster.find(n=>n.templateId==='enemy').id;
 const pc=await call('v03/join',{code:auth.code,name:'PC'});await call('npc/delete',{code:auth.code,token:pc.token,npcId},403);
 const campaign=await api.campaign(auth.code),npc=campaign.npcRoster.find(n=>n.id===npcId);
 campaign.encounter={units:[structuredClone(npc)],starships:[],hasEngagedClock:true};
 await call('npc/delete',{...auth,npcId},409);
 assert.ok(campaign.npcRoster.some(n=>n.id===npcId),'saved active encounter protects its NPC');
 campaign.encounter.hasEngagedClock=false;
 live={units:[structuredClone(npc),{id:'carrier',team:'pc',carryingId:npcId,carriedBy:npcId}],starships:[{id:'live-ship',crewNpcUnitIds:[npcId,'keep'],characterLocations:{[npcId]:{square:1}}}],hasEngagedClock:true};
 await call('npc/delete',{...auth,npcId},409);
 live.encounterEndedAt=Date.now();
 campaign.starships.push({id:'saved-ship',title:'Saved',crewNpcUnitIds:[npcId,'keep'],ship:{crewNpcUnitIds:[npcId,'keep'],gridCells:[],placements:[],sicInventory:[]},characterLocations:{[npcId]:{square:1}}});
 const deleted=await call('npc/delete',{...auth,npcId});assert.equal(deleted.campaign.npcRoster.some(n=>n.id===npcId),false);assert.equal(deleted.campaign.npcTemplates.length,2);assert.ok(deleted.campaign.npcRoster.some(n=>n.templateId==='ally'));
 assert.equal(live.units.some(n=>n.id===npcId),false);assert.equal(live.units[0].carryingId,null);assert.equal(live.units[0].carriedBy,null);
 assert.deepEqual(live.starships[0].crewNpcUnitIds,['keep']);assert.equal(live.starships[0].characterLocations[npcId],undefined);
 assert.deepEqual(campaign.starships[0].crewNpcUnitIds,['keep']);assert.deepEqual(campaign.starships[0].ship.crewNpcUnitIds,['keep']);assert.equal(campaign.starships[0].characterLocations[npcId],undefined);
 assert.equal(campaign.encounter.units.some(n=>n.id===npcId),false);
 const again=await call('npc-templates',{...auth,templates});assert.equal(again.campaign.npcRoster.some(n=>n.id===npcId),false);
 await call('npc/delete',{...auth,npcId},404);
 api=new CampaignApi({store});const restored=await api.campaign(auth.code);assert.equal(restored.npcRoster.some(n=>n.id===npcId),false);
});
