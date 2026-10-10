const test=require('node:test'),assert=require('node:assert/strict');
const rep=require('../ship-reputation'),{CampaignApi}=require('../campaign-api');
const ship=(id,popularity,values=[5,5,5,5,5])=>({id,title:id,crewCharacterIds:['pc'],ship:{popularity,reputationSelections:values}});
test('Reputation picks the highest popularity then the strongest trait on either side',()=>{
 const c={starships:[ship('a',12,[1,5,5,5,5]),ship('b',12,[5,5,5,5,10]),ship('c',11,[0,5,5,5,5])]};assert.equal(rep.selectShip(c,'pc').id,'b');assert.equal(rep.selectShip(c,'missing'),null);
});
test('opposing Reputation traits combine correctly and Indifferent omits an axis',()=>{assert.equal(rep.modifier(ship('s',0,[7,5,6,5,5]),[1,0,1,0,0]),-3);assert.equal(rep.modifier(ship('s',0,[7,5,6,5,5]),[-1,0,-1,0,0]),3);assert.equal(rep.modifier(ship('s',0,[5,5,5,7,4]),[0,0,0,1,1]),-1);});
test('recognition equality succeeds, duplicate delivery and rerolls award no extra Popularity',()=>{
 const s=ship('s',25),c={sessionNumber:1,starships:[s]};assert.equal(rep.recognize(c,s,'npc','call',{roll:()=>25}).recognized,true);assert.equal(s.ship.popularity,26);
 rep.recognize(c,s,'npc','call',{roll:()=>1});rep.recognize(c,s,'npc','call',{reroll:true,roll:()=>1});assert.equal(s.ship.popularity,26);
 assert.equal(rep.recognize(c,s,'npc','call',{reroll:true,roll:()=>27}).recognized,false);s.ship.popularity=100;rep.recognize(c,s,'npc','next',{roll:()=>100});assert.equal(s.ship.popularity,100);
});
test('attitudes persist within a session, clear at the next, and stay outside ship data',()=>{const c={sessionNumber:1};rep.setAttitude(c,'npc',[1,0,-1,1,0]);assert.deepEqual(rep.state(c).attitudes.npc,[1,0,-1,1,0]);c.sessionNumber++;assert.deepEqual(rep.state(c).attitudes,{});});
test('End Session changes only selected ships, adds a bounded die award, shifts one dot and notifies crew',()=>{const c={starships:[ship('a',98),ship('b',12)],characters:[{id:'pc',character:{identity:{characterName:'Nova'}}}],privateNotes:[]};rep.applyEnd(c,{shipIds:['a','a'],impactSides:6,impactResult:5,reputationRow:3,reputationDirection:1});assert.equal(c.starships[0].ship.popularity,100);assert.equal(c.starships[0].ship.reputationSelections[3],6);assert.equal(c.starships[1].ship.popularity,12);assert.equal(c.privateNotes.length,1);assert.throws(()=>rep.applyEnd(c,{shipIds:['missing'],impactSides:6,impactResult:5,reputationRow:3,reputationDirection:1}));});
function fixture(){const records=new Map(),store={get:async k=>structuredClone(records.get(k)||null),create:async c=>{records.set(c.code,structuredClone(c));return true;},save:async c=>records.set(c.code,structuredClone(c)),findByName:async()=>[]},api=new CampaignApi({store,storageMode:'test'});const call=async(path,body={},status=200)=>{let result;await api.handle({method:'POST'},{},new URL('http://test/api/campaign/'+path),async()=>body,(_,code,value)=>{assert.equal(code,status,JSON.stringify(value));result=value;});return result;};return{api,call};}
test('Quick Prompt Reverence uses the existing claimable award and receipts prevent duplicate inbox rewards',async()=>{const {api,call}=fixture(),room=await call('showcase/start'),code=room.code,token=room.gmToken,c=await api.campaign(code),record=c.characters[0],before=record.character.resources.reverence;await call('quick-prompts',{code,token,column:record.id,kind:'reverence',receipt:'one'});await call('quick-prompts',{code,token,column:record.id,kind:'reverence',receipt:'one'});assert.equal(record.character.resources.reverence,before);const notes=c.privateNotes.filter(n=>n.characterId===record.id&&n.rewardResource==='reverence'&&n.rewardStatus==='pending');assert.equal(notes.length,1);assert.ok(c.awardHistory.some(a=>a.id===notes[0].awardId&&a.claimRequired));});
test('Charisma result comparison is GM-only, ordinary sheet rolls reach GM, and End Session is idempotent',async()=>{
 const {api,call}=fixture(),room=await call('showcase/start'),code=room.code,gm=room.gmToken,c=await api.campaign(code),pc=c.characters[0],token=room.players[0].token;
 const s=rep.selectShip(c,pc.id);s.ship.popularity=100;s.ship.reputationSelections=[7,5,6,5,5];rep.setAttitude(c,'general',[1,0,1,0,0]);
 const requested=await call('roll/request',{code,token:gm,targetIds:[pc.id],attribute:'Charisma',skill:'Persuasion'},201);
 await call('roll/respond',{code,token,characterId:pc.id,requestId:requested.request.id,score:15,outcome:'Success'});
 const visible=api.state(c,gm).rollRequests.find(r=>r.id===requested.request.id).results[pc.id];assert.equal(visible.reputation.adjusted,12);assert.equal(visible.score,15);
 const player=api.state(c,token);assert.equal(player.reputation,undefined);assert.equal(player.rollRequests.find(r=>r.id===requested.request.id).results[pc.id].reputation,undefined);
 await call('statistics/roll',{code,token,characterId:pc.id,attribute:'charisma',skill:'Deception',score:18,receipt:'personal'});await call('statistics/roll',{code,token,characterId:pc.id,attribute:'charisma',skill:'Deception',score:18,receipt:'personal'});assert.equal(c.rollRequests.filter(r=>r.statisticsReceipt==='personal').length,1);
 await call('reputation',{code,token,kind:'edit',shipId:s.id,values:[0,0,0,0,0],popularity:100,receipt:'forbidden'},403);
 const session=c.sessionNumber,args={code,token:gm,receipt:'end-once',expectedSession:session,reputation:{shipIds:[s.id],impactSides:4,impactResult:3,reputationRow:3,reputationDirection:1}};
 await call('session/end',args);await call('session/end',args);assert.equal(c.sessionNumber,session+1);assert.deepEqual(rep.state(c).attitudes,{});assert.equal(s.ship.reputationSelections[3],6);
});

test('answered hails recognize the PC ship once, and queued Charisma rolls use the same GM-only result ledger',()=>{
 const s=ship('pcship',100),c={sessionNumber:1,starships:[s],characters:[{id:'pc'}],rollRequests:[]};
 const room={starships:[{id:'npc',commandSystems:{calls:[{id:'call',shipId:'pcship',status:'connected'}]}},{id:'pcship'}]};
 rep.hail(c,room,'call','npc');assert.equal(rep.state(c).contacts['hail:call:pcship'].recognized,true);assert.equal(rep.state(c).activeKey,'hail:call:pcship');
 s.ship.popularity=30;rep.hail(c,room,'call','npc');assert.equal(s.ship.popularity,30);
 const args={attribute:'charisma',skill:'Leadership',score:17,receipt:'combat-roll',source:'Combat console'};rep.recordRoll(c,'pc',args);rep.recordRoll(c,'pc',args);assert.equal(c.rollRequests.length,1);assert.equal(c.rollRequests[0].results.pc.score,17);assert.equal(c.rollRequests[0].source,'Combat console');
 rep.recordRoll(c,'uncrewed',{...args,receipt:'other'});assert.equal(c.rollRequests.length,1);
});
test('GM manual reputation edits persist, invalid changes and stale session endings cannot apply',async()=>{
 const {api,call}=fixture(),room=await call('showcase/start'),code=room.code,token=room.gmToken,c=await api.campaign(code),s=rep.selectShip(c,c.characters[0].id);
 await call('reputation',{code,token,kind:'edit',shipId:s.id,values:[6,4,5,5,5],popularity:34,receipt:'edit'});assert.equal(s.ship.popularity,34);assert.deepEqual(s.ship.reputationSelections,[6,4,5,5,5]);
 await call('reputation',{code,token,kind:'edit',shipId:s.id,values:[11,4,5,5,5],popularity:34,receipt:'invalid'},400);
 await call('session/end',{code,token,expectedSession:c.sessionNumber-1,receipt:'stale',reputation:{shipIds:[s.id],impactSides:6,impactResult:6,reputationRow:0,reputationDirection:1}},409);assert.equal(s.ship.popularity,34);
});


test('roll cancellation is per-recipient, authorized, persistent and idempotent',async()=>{
 const {api,call}=fixture(),room=await call('showcase/start'),code=room.code,c=await api.campaign(code),[a,b]=c.characters,token=room.players[0].token;
 const {request}=await call('roll/request',{code,token:room.gmToken,targetIds:[a.id,b.id],attribute:'Dexterity',skill:'Dodge'},201);
 await call('roll/cancel',{code,token,characterId:b.id,requestId:request.id},403);
 for(let n=0;n<2;n++)await call('roll/cancel',{code,token,characterId:a.id,requestId:request.id});
 assert.equal(c.rollRequests.find(r=>r.id===request.id).results[a.id].cancelled,true);
 assert.equal(c.rollRequests.find(r=>r.id===request.id).results[b.id],undefined);
 assert.equal(c.privateNotes.some(n=>n.characterId===a.id&&n.rollRequestId===request.id),false);
 assert.equal(c.privateNotes.some(n=>n.characterId===b.id&&n.rollRequestId===request.id),true);
 await call('roll/respond',{code,token,characterId:a.id,requestId:request.id,score:10},409);
 const second=await call('roll/request',{code,token:room.gmToken,targetIds:[a.id],attribute:'Dexterity',skill:'Dodge'},201);
 await call('roll/respond',{code,token,characterId:a.id,requestId:second.request.id,score:12});
 await call('roll/cancel',{code,token,characterId:a.id,requestId:second.request.id},409);
 assert.equal(api.state(c,token).rollRequests.find(r=>r.id===request.id).results[a.id].cancelled,true);
});
