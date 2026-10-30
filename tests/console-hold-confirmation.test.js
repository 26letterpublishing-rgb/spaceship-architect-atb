const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(debug=false){
 const unit={id:'one',consoleHold:false},other={id:'two',consoleHold:false};let state={roomCode:'room',encounterId:'enc',combatStartAt:100,stateEpoch:1,hasEngagedClock:true,units:[unit,other],...(debug?{debugConsole:true}:{})},sensor=true,allowed=true;const actions=[],dialogs=[],events={};
 class Node{constructor(tag){this.tag=tag;this.children=[];this.events={};this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}append(...nodes){this.children.push(...nodes);}addEventListener(k,f){this.events[k]=f;}showModal(){}remove(){}close(value=''){this.returnValue=value;this.events.close?.();}set innerHTML(v){this.html=v;}get style(){return this._style||=( {} );}}
 const doc={defaultView:{},body:{append:n=>dialogs.push(n)},createElement:t=>new Node(t),createTextNode:text=>({text}),querySelector:()=>sensor?{}:null,addEventListener(){}};
 const bridge={state:()=>state,confirmGmPlayerAction:()=>allowed,action:async body=>actions.push(body),mode:()=> 'gm'};
 const window={SACombatBridge:bridge,addEventListener:(event,fn)=>events[event]=fn,SAStationAccess:{consoles:()=>[]}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ship-navigation-ui.js'),'utf8'),{window,document:doc,CSS:{escape:x=>x},setInterval:()=>1,clearInterval(){},requestAnimationFrame(){},queueMicrotask(){},sessionStorage:{getItem(){return null},removeItem(){}},console});
 const check=()=>{const d=dialogs.at(-1),input=d.children.flatMap(n=>n.children||[]).find(n=>n.tag==='input');assert.ok(input);input.checked=true;input.events.change();};
 return {unit,other,actions,dialogs,events,api:window.SAShipNavigationUI,check,get state(){return state},set state(s){state=s},set sensor(v){sensor=v},set allowed(v){allowed=v}};
}
async function skip(e,unit=e.unit){const pending=e.api.toggleHold(unit);e.check();assert.equal(e.actions.length,0);e.dialogs.at(-1).close('cancel');await pending;}
test('Sensors checkbox never submits; cancellation remains cancellation; later Hold skips only that operator',async()=>{
 const e=fixture();await skip(e);await e.api.toggleHold(e.unit);assert.equal(e.actions.length,1);assert.equal(e.actions[0].kind,'holdConsole');assert.equal(e.dialogs.length,1);
 const pending=e.api.toggleHold(e.other);assert.equal(e.dialogs.length,2);e.dialogs.at(-1).close();await pending;assert.equal(e.actions.length,1);
 e.unit.consoleHold=true;await e.api.toggleHold(e.unit);assert.equal(e.actions.at(-1).kind,'resumeConsole');assert.equal(e.dialogs.length,2);
});
test('pause, Exit/reopen retain choice; other Console families still confirm',async()=>{
 const e=fixture();await skip(e);e.state.running=false;e.state.hardPaused=true;e.api.observe(e.state);await e.api.toggleHold(e.unit);assert.equal(e.dialogs.length,1);
 e.sensor=false;const pending=e.api.toggleHold(e.unit);assert.equal(e.dialogs.length,2);assert.equal(e.dialogs.at(-1).children.length,0);e.dialogs.at(-1).close('cancel');await pending;
});
test('End, Clear with reused ID, new combat, room and epoch reset even while Console closed',async()=>{
 for(const change of [s=>s.hasEngagedClock=false,s=>s.encounterEndedAt=200,s=>s.combatStartAt++,s=>s.encounterId='new',s=>s.roomCode='other',s=>s.stateEpoch++]){
  const e=fixture();await skip(e);change(e.state);e.api.observe(e.state);e.state.hasEngagedClock=true;e.state.encounterEndedAt=null;e.api.observe(e.state);
  const pending=e.api.toggleHold(e.unit);assert.equal(e.dialogs.length,2);e.dialogs.at(-1).close('cancel');await pending;assert.equal(e.actions.length,0);
 }
});
test('stale accepted dialog cannot submit into a replacement combat or for removed operator',async()=>{
 for(const change of [s=>s.combatStartAt++,s=>s.units=[],s=>s.roomCode='other']){const e=fixture(),pending=e.api.toggleHold(e.unit);change(e.state);e.dialogs.at(-1).close('hold');await pending;assert.equal(e.actions.length,0);}
});
test('Debug session retains choice across Exit but teardown/reset clears; permission guard still runs',async()=>{
 const e=fixture(true);await skip(e);e.api.observe(e.state);await e.api.toggleHold(e.unit);assert.equal(e.dialogs.length,1);e.allowed=false;await e.api.toggleHold(e.unit);assert.equal(e.actions.length,1);
 e.allowed=true;e.events.pagehide();const pending=e.api.toggleHold(e.unit);assert.equal(e.dialogs.length,2);e.dialogs.at(-1).close('cancel');await pending;
 const fresh=fixture(true),first=fresh.api.toggleHold(fresh.unit);assert.equal(fresh.dialogs.length,1);fresh.dialogs[0].close('cancel');await first;
});
