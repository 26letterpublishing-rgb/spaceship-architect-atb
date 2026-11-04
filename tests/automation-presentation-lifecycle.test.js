const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('detached automatic roll keeps its view, listener and exactly one acknowledgement',async()=>{
 let tick,receive,calls=0;const body={append(v){v.isConnected=true;}},doc={body,hidden:false,defaultView:{frameElement:null,addEventListener(t,f){receive=f;},removeEventListener(){}},querySelectorAll:()=>[],createElement(tag){return {isConnected:false,style:{},setAttribute(){},addEventListener(){},append(){},show(){},remove(){this.isConnected=false;},contentWindow:{postMessage(){}}};}};
 const r={id:'saved',phase:'rolling',values:[3],sides:[12]},s={showcase:true,units:[{id:'npc',delayedAction:{id:'saved',automated:true},automationPresentation:r}],starships:[]};let view;const create=doc.createElement;doc.createElement=tag=>{const e=create(tag);if(tag==='dialog')view=e;return e;};
 const window={SACombatBridge:{state:()=>s,soundEnabled:()=>false,action:async()=>{calls++;}},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../automation-ui.js'),'utf8'),{window,document:doc,location:{href:'http://local/',origin:'http://local'},URL,setInterval:f=>(tick=f),setTimeout:()=>1,clearTimeout(){},clearInterval(){}});
 tick();const original=view,listener=receive;view.isConnected=false;tick();assert.equal(view,original);assert.equal(view.isConnected,true);assert.equal(receive,listener);assert.deepEqual(r.values,[3]);assert.equal(calls,0);
 // Use the iframe identity captured by the real listener's source check.
 let frame;doc.createElement=tag=>{const e=create(tag);if(tag==='iframe')frame=e;return e;};s.units=[];tick();s.units=[{id:'npc',delayedAction:{id:'saved',automated:true},automationPresentation:r}];tick();
 const event={origin:'http://local',source:frame.contentWindow,data:{type:'sa-automatic-dice-shown',rollId:'saved'}};receive(event);receive(event);tick();await Promise.resolve();receive(event);tick();assert.equal(calls,1);
});
