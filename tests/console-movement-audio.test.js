const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

test('navigation input uses the existing engine sound and stops on pause, mute or disconnect',()=>{
 let tick,starts=0,stops=0,enabled=true;
 const element=()=>({dataset:{},classList:{contains:()=>false},setAttribute(){},append(){},remove(){},textContent:''});
 const view=element(),notice=element();view.dataset.operatorId='pilot';view.querySelector=()=>notice;
 const doc={defaultView:{},hidden:false,head:{append(){}},createElement:element,addEventListener(){},querySelector:()=>view};
 const unit={id:'pilot',atb:0,delayedAction:{remaining:50,shipOrder:{}}};
 let state={units:[unit],starships:[],running:true,threshold:100};
 const bridge={state:()=>state,myUnitId:()=>unit.id,soundEnabled:()=>enabled,startEngineCharge:()=>{starts++;return {update(){},stop(){stops++;}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../console-feedback'),'utf8'),{document:doc,window:{SACombatBridge:bridge,addEventListener(){}},setInterval:fn=>{tick=fn;return 1;},performance:{now:()=>0}});
 tick();tick();assert.equal(starts,1,'One sustained engine voice, not repeated voices');
 state.hardPaused=true;tick();assert.equal(stops,1);
 state.hardPaused=false;tick();assert.equal(starts,2);
 enabled=false;tick();assert.equal(stops,2);
 enabled=true;tick();assert.equal(starts,3);
 state=null;assert.doesNotThrow(tick);assert.equal(stops,3);
});
