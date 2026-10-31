const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../combat-feedback.js'),'utf8');
function harness(){
 let tick;const events={},nodes=[],timers=new Map();let id=0;
 const element=()=>({dataset:{},style:{},setAttribute(){},append(){},querySelectorAll:()=>[],addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}});
 const doc={hidden:false,defaultView:{frameElement:null},createElement:element,querySelector:()=>true,querySelectorAll:()=>[],head:element(),body:element()};doc.body.append=n=>nodes.push(n);
 const ship={id:'ship',currentHullHp:100,currentShieldHp:20,shieldSystems:{a:{hp:20}},ship:{gravityFieldState:{active:false}}},state={starships:[ship],log:[],shipPositions:[]};
 const window={SACombatBridge:{state:()=>state,soundEnabled:()=>false,pilotRings:()=>''},SAShipMap:{gravityFieldActive:s=>s.ship.gravityFieldState.active},SASpaceMap:{markup:()=>''},addEventListener:(e,f)=>events[e]=f};
 vm.runInNewContext(source,{window,document:doc,location:{href:'http://localhost/'},URL,Date,CSS:{escape:x=>x},matchMedia:()=>({matches:true}),requestAnimationFrame:f=>f(),setInterval:f=>{tick=f;return 1;},clearInterval(){},setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:i=>timers.delete(i)});
 return {ship,state,tick:()=>tick(),events,nodes,timers,stages:()=>nodes.filter(n=>n.className==='combat-effect-stage')};
}
function activate(h){h.ship.ship.gravityFieldState.active=true;h.ship.currentShieldHp=0;}
test('pure activation/deactivation/repeated updates do not present damage or reset replay',()=>{
 const h=harness();h.tick();activate(h);h.tick();h.tick();assert.equal(h.stages().length,0);
 h.ship.ship.gravityFieldState.active=false;h.ship.currentShieldHp=20;h.tick();assert.equal(h.stages().length,0);
 activate(h);h.events['sa-combat-reset']();h.tick();assert.equal(h.stages().length,0);
});
for(const phase of ['activation','deactivation'])for(const loss of ['hull','layer'])test(`real ${loss} loss on ${phase} still presents damage`,()=>{
 const h=harness();if(phase==='deactivation')activate(h);h.tick();
 h.ship.ship.gravityFieldState.active=phase==='activation';h.ship.currentShieldHp=phase==='activation'?0:19;
 if(loss==='hull')h.ship.currentHullHp--;else h.ship.shieldSystems.a.hp--;
 h.tick();assert.equal(h.stages().length,1);
});
test('ordinary damage and incomplete layer information preserve existing impact fallback',()=>{
 for(const kind of ['hull','shield','unknown']){const h=harness();if(kind==='unknown')delete h.ship.shieldSystems;h.tick();if(kind==='hull')h.ship.currentHullHp--;else if(kind==='shield')h.ship.currentShieldHp--;else activate(h);h.tick();assert.equal(h.stages().length,1,kind);}
});
test('explicit damage event during suspension still opens stage; teardown clears it',()=>{
 const h=harness();h.tick();activate(h);h.ship.weaponState={reports:[{id:'hit',impact:true,targetId:'ship',at:new Date().toISOString()}]};h.tick();assert.equal(h.stages().length,1);h.events.pagehide();assert.ok(h.stages()[0].removed);
});
