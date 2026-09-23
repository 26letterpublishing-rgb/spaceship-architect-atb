const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const memory=new Map(),opened=[],units=['nova','another-pc'].map(id=>({id,characterId:id,atb:99,consoleHold:{},location:{stationed:true,starshipId:'ship',sicId:'bridge',square:1,mesh:0}}));
 let own='nova';const state={roomCode:'TEST',units,starships:[],activeId:null};
 const choices=u=>u.location.stationed?[{kind:'utility',item:{id:u.id+'-console'},remote:false}]:[];
 const window={addEventListener(){},SACombatBridge:{state:()=>state,myUnitId:()=>own,mode:()=> 'player'},SAStationAccess:{consoles:(_s,u)=>choices(u)},SAUtilityConsoleUI:{isOpen:()=>false,open:(u,id)=>opened.push([u.id,id])}};
 const document={querySelector:()=>null,defaultView:window};window.document=document;
 const context={window,document,sessionStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},setInterval:()=>1,clearInterval(){},queueMicrotask:()=>{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../ship-navigation-ui.js'),'utf8'),context);
 return {api:window.SAShipNavigationUI,memory,opened,units,state,document,own:id=>own=id};
}
test('each PC remembers its console; Holding does not prevent viewing or alter ATB',()=>{
 const f=setup(),[a,b]=f.units,before=structuredClone(f.units);f.api.open(a);f.own(b.id);f.api.open(b);
 assert.equal(f.memory.get('sa-console:TEST:nova'),'nova-console');assert.equal(f.memory.get('sa-console:TEST:another-pc'),'another-pc-console');
 f.api.remember(b);f.own(a.id);f.api.sync(a);assert.deepEqual(f.opened.at(-1),['nova','nova-console']);
 const count=f.opened.length;f.own(b.id);f.api.sync(b);assert.equal(f.opened.length,count);assert.deepEqual(f.units,before);
});
test('explicit Combat View persists, reopening opts back in, and leaving a seat clears its preference',()=>{
 const f=setup(),u=f.units[0];f.api.observe(f.state);f.api.open(u);f.api.remember(u);const count=f.opened.length;f.api.sync(u);assert.equal(f.opened.length,count);
 f.api.open(u);f.api.sync(u);assert.equal(f.opened.length,count+2);
 u.location.stationed=false;f.api.observe(f.state);assert.equal(f.memory.has('sa-console-view:TEST:nova'),false);
});

test('restoring a console never covers another open dice or action dialog',()=>{
 const f=setup(),u=f.units[0];f.api.open(u);const count=f.opened.length;f.document.querySelector=()=>({open:true});f.api.sync(u);assert.equal(f.opened.length,count);
});
