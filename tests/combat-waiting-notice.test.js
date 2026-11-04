const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),start=source.indexOf('function renderAttackResolution(mine) {');
const render=source.slice(start,source.indexOf('  if (!attack) {',start))+'}';
function fixture(){
 const messages=[],context={mode:'player',gmForcedAttackEntry:'',gmForcedDefenseEntry:false,window:{SAResultFeedback:{waiting:message=>messages.push(message)}}};
 const pc={id:'pc',team:'pc'},npc={id:'npc',team:'npc',characterName:'Private NPC name'};
 context.state={units:[pc,npc],hasEngagedClock:true,pausedForTurn:true,activeId:'npc'};
 vm.createContext(context);vm.runInContext(render,context);
 return {context,pc,npc,messages,run(){vm.runInContext('renderAttackResolution(state.units[0])',context);return messages.at(-1);}};
}
test('manual NPC wait appears on initial state and clears across repeated authoritative transitions',()=>{
 const f=fixture();for(let i=0;i<3;i++){f.context.state.activeId='npc';assert.equal(f.run(),'Waiting for GM.');f.context.state.activeId='pc';assert.equal(f.run(),'');}
 assert.ok(f.messages.every(m=>!m.includes('Private NPC name')));
});
test('ordinary pause, Holding, automation, preparation and ended encounters do not imply GM action',()=>{
 for(const patch of [{activeId:null,hardPaused:true},{activeId:null,holdPaused:true},{pausedForTurn:false},{hasEngagedClock:false},{encounterEndedAt:123}]){const f=fixture();Object.assign(f.context.state,patch);assert.equal(f.run(),'');}
 for(const patch of [{consoleHold:{}},{automationMode:'npc'},{automationMode:'automatic'}]){const f=fixture();Object.assign(f.npc,patch);assert.equal(f.run(),'');}
 const f=fixture();Object.assign(f.npc,{automationMode:'npc',automationSuspended:true});assert.equal(f.run(),'Waiting for GM.');
});
test('queued GM resolution informs other PCs without duplicating own ship-roll or Delay notice',()=>{
 const f=fixture();f.context.state.activeId=null;f.context.state.activeAction={id:'q',unitId:'npc'};assert.equal(f.run(),'Waiting for GM.');
 f.context.state.activeAction.unitId='pc';assert.equal(f.run(),'');f.context.state.activeAction=null;assert.equal(f.run(),'');
 f.context.state.activeId='npc';f.context.state.delayRequest={unitId:'pc'};assert.equal(f.run(),'');
});
test('existing attack, First Aid and ship-roll ownership messages retain priority',()=>{
 const f=fixture();f.context.state.attackResolution={id:'attack',phase:'gmDamage',attackerId:'pc',defenderId:'npc'};assert.match(f.run(),/^Waiting for GM to apply damage/);
 f.context.state.attackResolution=null;f.context.state.itemResolution={phase:'gmDifficulty',healerId:'pc'};assert.match(f.run(),/^Waiting for GM to set/);
 f.context.state.itemResolution=null;f.pc.pendingShipRolls=[{id:'roll',label:'Sensors',rollController:'player'}];assert.equal(f.run(),'');
 f.pc.pendingShipRolls[0].rollController='gm';assert.match(f.run(),/^Waiting for GM to roll Sensors/);
 f.pc.pendingShipRolls=[];f.context.mode='gm';assert.equal(f.run(),'');
});
test('sanitized server flag handles filtered NPCs without treating hidden PC turns as GM work',()=>{
 const f=fixture();f.context.state.units=[f.pc];f.context.state.activeId=null;f.context.state.hiddenActiveTurn=true;
 f.context.state.waitingForGm=true;assert.equal(f.run(),'Waiting for GM.');
 f.context.state.waitingForGm=false;assert.equal(f.run(),'');
 delete f.context.state.waitingForGm;assert.equal(f.run(),'');
});
test('authoritative GM ownership excludes automation, ordinary pauses and player decisions',()=>{
 const server=fs.readFileSync(require.resolve('../server.js'),'utf8'),context={};
 vm.runInNewContext(server.slice(server.indexOf('function requiresGmAction('),server.indexOf('function visibleEncounter(')),context);
 const pc={id:'pc',team:'pc'},npc={id:'npc',team:'npc'},base={units:[pc,npc],hasEngagedClock:true,pausedForTurn:true,activeId:'npc'};
 const check=(patch,expected)=>assert.equal(Boolean(context.requiresGmAction({...base,...patch})),expected);
 check({},true);check({activeId:'pc'},false);check({activeId:null,hardPaused:true},false);check({activeId:null,holdPaused:true},false);
 check({hasEngagedClock:false},false);check({encounterEndedAt:1},false);check({pausedForTurn:false},false);
 npc.consoleHold={};check({},false);delete npc.consoleHold;npc.automationMode='npc';check({},false);npc.automationSuspended=true;check({},true);delete npc.automationMode;
 check({activeId:null,activeAction:{unitId:'pc'}},true);check({delayRequest:{unitId:'pc'}},true);
 check({attackResolution:{phase:'checks',attackerId:'npc',defenderId:'pc'}},false);
 check({attackResolution:{phase:'gmDamage',attackerId:'pc',defenderId:'npc'}},true);
 check({itemResolution:{phase:'gmDifficulty',healerId:'pc'}},true);
 pc.pendingShipRolls=[{rollController:'player'}];check({},false);pc.pendingShipRolls[0].rollController='gm';check({},true);
});
test('waiting banner has no lifetime timer and updates/removes one top-layer node',()=>{
 const feedback=fs.readFileSync(require.resolve('../result-feedback.js'),'utf8'),nodes=[];const doc={body:{append:n=>nodes.push(n)},createElement:()=>({dataset:{},setAttribute(){},matches(){return !!this.open},showPopover(){this.open=true},hidePopover(){this.open=false},remove(){nodes.splice(nodes.indexOf(this),1)}})};const win={};doc.defaultView=win;
 const c={window:win,host:()=>doc};vm.runInNewContext(feedback.slice(feedback.indexOf('  let waitingNode;'),feedback.indexOf('  function stored(')),c);c.waiting('Waiting for GM.');assert.equal(nodes.length,1);assert.equal(nodes[0].open,true);assert.match(nodes[0].className,/critical-flight-banner/);c.waiting('Waiting for GM.');assert.equal(nodes.length,1);c.waiting('Waiting for GM damage.');assert.equal(nodes[0].textContent,'Waiting for GM damage.');c.waiting();assert.equal(nodes.length,0);assert.doesNotMatch(feedback.slice(feedback.indexOf('  function waiting('),feedback.indexOf('  function stored(')),/setTimeout/);
});
