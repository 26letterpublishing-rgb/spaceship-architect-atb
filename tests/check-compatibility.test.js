const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {CampaignApi}=require('../campaign-api');
function fixture(){
 const records=new Map(),store={get:async k=>structuredClone(records.get(k)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]};
 let api=new CampaignApi({store,storageMode:'test'});
 return {api:()=>api,restart(){api=new CampaignApi({store,storageMode:'test'});},async call(path,body={},expected=200){let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,status,value)=>{assert.equal(status,expected,JSON.stringify(value));result=value;});return result;}};
}
test('legacy scripted checks and Quick Check presets survive reload; success messages and claimable rewards remain idempotent',async()=>{
 const f=fixture(),room=await f.call('v03/create',{name:'Check compatibility'},201),code=room.campaign.code,gm=room.token;
 const player=await f.call('v03/join',{code,name:'Tester'});
 const created=await f.call('v03/character/create',{code,token:player.token,password:'',character:{phase:'finalized',identity:{characterName:'Nova'},resources:{creditsBase:20}}});
 const characterId=created.campaign.ownCharacterId,targetIds=[characterId],base={attribute:'Perception',skill:'Awareness',difficulty:10};
 const message=(await f.call('conditional-action',{code,token:gm,...base,keyword:'FIND CACHE',kind:'message',message:'A cache behind the panel.'})).action;
 const award=(await f.call('conditional-action',{code,token:gm,...base,keyword:'CACHE REWARD',kind:'award',resource:'credits',amount:25})).action;
 await f.call('quick-prompts',{code,token:gm,column:characterId,presets:[{...base,name:'Find clues'}]});
 f.restart();const c=await f.api().campaign(code);
 assert.equal(c.quickPrompts[characterId][0].name,'Find clues');assert.equal(c.conditionalActions.find(a=>a.id===message.id).keyword,'FIND CACHE');
 const source=fs.readFileSync(require.resolve('../gm.js'),'utf8'),ctx=vm.createContext({window:{SASaveFiles:require('../save-file-types')},campaign:c,ATTRIBUTE_DEFS:[{label:'Perception'}],allSkills:['Awareness'],activeScriptChapter:()=>({id:'legacy'})});
 vm.runInContext(source.slice(source.indexOf('function parseCommand('),source.indexOf('function scriptSource(')),ctx);
 const direct=ctx.parseCommand('Perception+Awareness/Difficulty 10',0),reward=ctx.parseCommand('Keyword:FIND CACHE',1);
 assert.ok(direct.valid&&reward.valid);assert.equal(direct.difficulty,10);assert.equal(reward.conditionalActionId,message.id);
 async function resolve(actionId,score){const request=(await f.call('roll/request',{code,token:gm,targetIds,...base,completionActionId:actionId},201)).request;
  const response={code,token:player.token,characterId,requestId:request.id,score,mode:'manual',outcome:score>=10?'Success':'Failure'};
  const result=await f.call('roll/respond',response);await f.call('roll/respond',response);return result;
 }
 assert.equal((await resolve('',15)).delivery,null);
 assert.equal((await resolve(message.id,5)).delivery,null);
 await resolve(message.id,15);
 assert.equal(c.privateNotes.filter(n=>n.message==='A cache behind the panel.').length,1);
 const before=c.characters[0].character.resources.creditsBase;
 assert.equal((await resolve(award.id,15)).delivery.pending,true);
 const notes=c.privateNotes.filter(n=>n.rewardStatus==='pending');assert.equal(notes.length,1);assert.equal(c.characters[0].character.resources.creditsBase,before);
 const claim={code,token:player.token,characterId,noteId:notes[0].id};await f.call('award/claim',claim);await f.call('award/claim',claim);
 assert.equal(c.characters[0].character.resources.creditsBase,before+25);
});
