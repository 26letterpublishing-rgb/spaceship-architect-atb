const test=require('node:test'),assert=require('node:assert/strict');
const {CampaignApi}=require('../campaign-api');
function fixture(){const records=new Map(),deletedEncounters=[];const store={get:async code=>structuredClone(records.get(code)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),delete:async code=>records.delete(code),findByName:async()=>[]};const api=new CampaignApi({store,storageMode:'test',deleteEncounter:code=>deletedEncounters.push(code)});const call=async(path,body,status=200)=>{let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,code,value)=>{assert.equal(code,status,JSON.stringify(value));result=value;});return result;};return{api,call,records,deletedEncounters};}
test('v0.3 deletion requires the actual GM session and exact name without an unknowable GM password',async()=>{
 const f=fixture(),room=await f.call('v03/create',{name:'Deletion test'},201),code=room.campaign.code,pc=await f.call('v03/join',{code,name:'PC'});
 await f.call('delete',{code,token:pc.token,campaignName:'Deletion test'},403);await f.call('delete',{code,token:room.token,campaignName:'deletion test'},403);assert.ok(f.records.has(code));
 await f.call('delete',{code,token:room.token,campaignName:'Deletion test'});assert.equal(f.records.has(code),false);assert.deepEqual(f.deletedEncounters,[code]);assert.equal(f.api.gmSession(room.token,code),null);assert.equal(await f.api.campaign(code),null);
});
test('legacy campaign deletion still requires its configured GM password',async()=>{
 const f=fixture(),room=await f.call('create',{name:'Legacy deletion',gmCode:'secret'},201),code=room.campaign.code;
 await f.call('delete',{code,token:room.token,campaignName:'Legacy deletion'},403);assert.ok(f.records.has(code));await f.call('delete',{code,token:room.token,campaignName:'Legacy deletion',gmCode:'secret'});assert.equal(f.records.has(code),false);
});
