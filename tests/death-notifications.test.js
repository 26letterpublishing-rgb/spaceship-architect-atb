const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../character-lifecycle-ui.js'),'utf8');
function harness(storage=new Map()){
 const nodes=[],timers=new Map(),listeners={};let serial=0;
 const window={frameElement:{hidden:false},parent:{},addEventListener:(type,fn)=>listeners[type]=fn};
 const document={body:{append:n=>nodes.push(n)},createElement:tag=>({tag,children:[],setAttribute(){},append(...children){this.children.push(...children);},showPopover(){this.shown=true;},remove(){const i=nodes.indexOf(this);if(i>=0)nodes.splice(i,1);}})};
 const sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 vm.runInNewContext(source,{window,document,sessionStorage,location:{origin:'http://local'},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
 return {nodes,timers,window,storage,update:window.SACharacterLifecycle.zeroHp,event:active=>listeners.message({origin:'http://local',source:window.parent,data:{type:'sa-explore-visibility',active}})};
}
const dead={eligible:true,code:'QA',id:'pc',hp:0};
test('zero HP notice deduplicates, expires, survives reload dedup and rearms only after recovery',()=>{
 const h=harness();h.update(dead);h.update(dead);assert.equal(h.nodes.length,1);assert.equal(h.timers.size,1);
 assert.equal(h.nodes[0].children[0].src,'transparent-skull.png');assert.equal(h.nodes[0].children[1].textContent,'YOU ARE DEAD');
 [...h.timers.values()][0]();assert.equal(h.nodes.length,0);h.update(dead);assert.equal(h.nodes.length,0);
 const reload=harness(h.storage);reload.update(dead);assert.equal(reload.nodes.length,0);
 reload.update({...dead,hp:1});reload.update(dead);assert.equal(reload.nodes.length,1);reload.update({...dead,hp:10});assert.equal(reload.nodes.length,0);
});
test('ownership, invalid HP and Explore hidden roles do not leak or consume another PC notice',()=>{
 const h=harness();for(const s of [{...dead,eligible:false},{...dead,hp:NaN}])h.update(s);assert.equal(h.nodes.length,0);
 h.window.frameElement.hidden=true;h.update(dead);assert.equal(h.storage.size,0);h.window.frameElement.hidden=false;h.event(true);assert.equal(h.nodes.length,1);
 h.event(false);assert.equal(h.nodes.length,0);h.event(true);assert.equal(h.nodes.length,0);
 h.update({...dead,id:'other'});assert.equal(h.nodes.length,1);h.update({...dead,eligible:false});assert.equal(h.nodes.length,0);
});
test('character binding uses own authorized identity and live encounter HP before roster snapshot',()=>{
 const file=fs.readFileSync(require.resolve('../character.js'),'utf8'),fn=file.slice(file.indexOf('function updateZeroHpDisplay()'),file.indexOf('function renderCombatStatus()'));
 let received;const context={window:{SACharacterLifecycle:{zeroHp:s=>received=s}},CAMPAIGN_READ_ONLY_VIEW:false,campaignCharacterId:'pc',campaignCode:'QA',campaignState:{role:'character',ownCharacterId:'pc',characters:[{id:'pc',character:{health:{current:30}}}]},playerEncounterView:{units:[{characterId:'pc',currentHp:0}]}};
 vm.createContext(context);vm.runInContext(fn+';updateZeroHpDisplay()',context);assert.equal(received.hp,0);assert.equal(received.eligible,true);
 context.campaignCharacterId='someone-else';vm.runInContext('updateZeroHpDisplay()',context);assert.equal(received.eligible,false);
 context.playerEncounterView.encounterEndedAt=1;vm.runInContext('updateZeroHpDisplay()',context);assert.equal(received.hp,30);
 context.campaignState.role='gm';vm.runInContext('updateZeroHpDisplay()',context);assert.equal(received.eligible,false);
 context.campaignState.combatActive=true;context.playerEncounterView=null;vm.runInContext('updateZeroHpDisplay()',context);assert.ok(Number.isNaN(received.hp),'Loading combat must not treat a stale living roster snapshot as recovery');
});
