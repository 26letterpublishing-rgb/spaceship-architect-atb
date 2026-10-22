const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
function setup(healing=false){
 const nodes={},dom=new Proxy(nodes,{get:(o,k)=>o[k]||=( {hidden:false,disabled:false,textContent:'',focus(){},classList:{add(){},remove(){}}} )});
 const sent=[],request={attackId:'damage-1',resolutionId:'aid-1',healing,parsedDamage:{flat:2}};
 const c=vm.createContext({dom,activeCombatDamageRequest:request,combatDamageSubmitted:false,formatNumber:String,
  document:{body:{classList:{remove(){}}}},diceRoller:{isActive:()=>false,stop(){}},processPendingCombatRequest(){},notice(){},
  submitCombatMessage:async m=>{sent.push(m);}});
 vm.runInContext(source.slice(source.indexOf('function finishCombatDamage('),source.indexOf('function resetCombatInterfaceState(')),c);
 return {c,dom,request,sent};
}
for(const healing of [false,true])test(`${healing?'healing':'damage'} waits for confirmation; X cannot discard it; only one result is sent`,async()=>{
 const {c,dom,request,sent}=setup(healing);
 c.finishCombatDamage(9,'automatic',[3,4]);
 assert.equal(sent.length,0);assert.equal(dom.confirmCombatDamage.hidden,false);
 assert.equal(dom.confirmCombatDamage.textContent,'Confirm and Submit');
 c.closeCombatDamageResult();assert.equal(c.activeCombatDamageRequest,request);
 let release;c.submitCombatMessage=m=>{sent.push(m);return new Promise(r=>release=r);};
 const pending=c.confirmCombatDamageResult();await c.confirmCombatDamageResult();
 assert.equal(sent.length,1);assert.equal(dom.confirmCombatDamage.disabled,true);
 c.closeCombatDamageResult();assert.equal(c.activeCombatDamageRequest,request,'Cannot dismiss during network submission');
 release();await pending;
 assert.equal(sent[0].type,healing?'sa-combat-healing-result':'sa-combat-damage-result');
 assert.equal(sent[0].rolledHealing??sent[0].rolledDamage,9);
 assert.equal(dom.combatDamageModal.hidden,true);
 c.closeCombatDamageResult();assert.equal(c.activeCombatDamageRequest,null);
});
test('failed submissions retain the exact dice and retry without rolling or changing the result',async()=>{
 const {c,dom,request,sent}=setup();
 c.finishCombatDamage(9,'automatic',[3,4]);
 c.submitCombatMessage=async()=>{throw Error('Offline');};await c.confirmCombatDamageResult();
 assert.equal(dom.confirmCombatDamage.textContent,'Retry Submit');assert.equal(dom.confirmCombatDamage.disabled,false);
 c.finishCombatDamage(99,'manual',[]);assert.equal(request.pendingResult.rolledDamage,9);
 c.closeCombatDamageResult();assert.equal(c.activeCombatDamageRequest,request);
 c.submitCombatMessage=async m=>sent.push(m);await c.confirmCombatDamageResult();
 assert.equal(sent[0].rolledDamage,9);assert.deepEqual(Array.from(sent[0].diceResults),[3,4]);
});
test('GM takeover can clear obsolete results without submitting them',async()=>{
 const {c,request,sent}=setup();c.finishCombatDamage(8,'manual');
 c.closeCombatDamageResult({discardCombat:true,processNext:false});
 assert.equal(c.activeCombatDamageRequest,null);await c.confirmCombatDamageResult();assert.equal(sent.length,0);
 c.activeCombatDamageRequest=request;
 c.submitCombatMessage=async()=>{throw Object.assign(Error('GM already resolved this roll'),{obsolete:true});};
 await c.confirmCombatDamageResult();assert.equal(c.activeCombatDamageRequest,null);
});
test('an old network completion cannot change the next required result',async()=>{
 const {c,dom}=setup();c.finishCombatDamage(2,'manual');let reject;
 c.submitCombatMessage=()=>new Promise((_,r)=>reject=r);const pending=c.confirmCombatDamageResult();
 c.closeCombatDamageResult({discardCombat:true});c.activeCombatDamageRequest={attackId:'new'};
 dom.confirmCombatDamage.textContent='Confirm and Submit';reject(Error('Old network error'));await pending;
 assert.equal(dom.confirmCombatDamage.textContent,'Confirm and Submit');
});
test('required character/ship checks cannot be closed before submission',()=>{
 for(const ship of [false,true]){
  const check={combatRequest:{attackId:'a'},pendingSubmission:{score:5}};
  const dom={skillCheckModal:{hidden:false}},c=vm.createContext({skillCheck:check,PAGE_PARAMS:new URLSearchParams(ship?'shipRoll=1':''),dom,diceRoller:{isActive:()=>false}});
  vm.runInContext(source.slice(source.indexOf('function closeSkillCheck('),source.indexOf('function selectSkillAttribute(')),c);
  c.closeSkillCheck();assert.equal(c.skillCheck,check);assert.equal(dom.skillCheckModal.hidden,false);
 }
});
test('GM takeover stops an in-flight character roll and clears the obsolete modal',()=>{
 let stopped=0;const c=vm.createContext({skillCheck:{combatRequest:{attackId:'old'}},PAGE_PARAMS:new URLSearchParams(),dom:{skillCheckModal:{hidden:false}},diceRoller:{isActive:()=>true,stop:()=>stopped++},document:{body:{classList:{remove(){}}}},setTimeout(){},processPendingCombatRequest(){}});
 vm.runInContext(source.slice(source.indexOf('function closeSkillCheck('),source.indexOf('function selectSkillAttribute(')),c);
 c.closeSkillCheck({discardCombat:true});assert.equal(stopped,1);assert.equal(c.skillCheck,null);assert.equal(c.dom.skillCheckModal.hidden,true);
});
test('lost acknowledgement and GM takeover cannot trap a retry on a completed roll',async()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),replies=[];
 const state={attackResolution:{id:'a',phase:'damage'}};
 let calls=0;const c=vm.createContext({state,postCombatMessage:r=>replies.push(r),action:async()=>calls++});
 vm.runInContext(app.slice(app.indexOf('function postedCombatResultPending('),app.indexOf('\nwindow.addEventListener("message",',app.indexOf('function postedCombatResultPending('))),c);
 const payload={action:'submitAttackDamage',attackId:'a'};
 state.attackResolution.phase='gmDamage';await c.submitPostedCombatResult({submissionId:'retry'},payload);
 assert.equal(calls,0);assert.equal(replies.at(-1).obsolete,true);
 state.attackResolution.phase='damage';c.action=async()=>{throw Error('Offline');};
 await c.submitPostedCombatResult({submissionId:'offline'},payload);assert.equal(replies.at(-1).obsolete,false);
 c.action=async()=>{throw Object.assign(Error('Already resolved'),{status:409});};
 await c.submitPostedCombatResult({submissionId:'old'},payload);assert.equal(replies.at(-1).obsolete,true);
 state.itemResolution={id:'aid',phase:'healing',rollController:'gm'};
 await c.submitPostedCombatResult({submissionId:'aid'},{action:'submitFirstAidHealing',resolutionId:'aid'});assert.equal(replies.at(-1).obsolete,true);
});
