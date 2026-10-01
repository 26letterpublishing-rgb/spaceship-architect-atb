const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
// Use the real receiver's skill resolver; an unknown display title never opens dice.
const characterSource=fs.readFileSync(require.resolve('../character.js'),'utf8');
const resolverSource=characterSource.slice(characterSource.indexOf('function resolveSkill('),characterSource.indexOf('\nfunction ',characterSource.indexOf('function resolveSkill(')+10));
const skillContext={};vm.runInNewContext(resolverSource+'\nthis.resolve=resolveSkill;',skillContext);
const acceptsSharedSkill=skill=>skillContext.resolve({skills:Object.fromEntries(require('../skill-catalog').names.map(name=>[name,{tenths:0}])),customSkills:[]},'base:'+skill);
async function setup(type,details={}){
  const nodes=new Map(),created=[],requests=[],messages=[],listeners=new Map(),alerts=[];
  const element=tag=>({tag,dataset:{},listeners:new Map(),value:'',checked:true,disabled:false,hidden:false,children:[],contentWindow:{postMessage:body=>messages.push(body)},
    setAttribute(){},append(...children){this.children.push(...children);},remove(){},showModal(){this.open=true;},close(){this.open=false;for(const f of this.listeners.get('close')||[])f();this.onclose?.();},
    addEventListener(event,fn){this.listeners.set(event,[...(this.listeners.get(event)||[]),fn]);},
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element('control'));return nodes.get(selector);},querySelectorAll(){return [];}});
  const win={addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:(event)=>listeners.delete(event)};
  const doc={defaultView:win,styleSheets:['console-common.css','crew-room-console.css'].map(x=>({href:'http://localhost/'+x})),head:{append(){}},body:{append(){}},createElement:tag=>{const e=element(tag);created.push(e);return e;}};
  const unit={id:'u',characterId:'pc',characterName:'Test PC'},ship={id:'s',ship:{crewRoomState:{report:{text:'Another room had a drink order.'}},sicInventory:[]}},state={practice:true,units:[unit],starships:[ship]};
  const info={details,impaired:type==='bar',gm:false,hibernationUnavailable:'',patients:[],skills:[],attributes:[]};
  let failure=false;
  const window={...win,SACombatBridge:{state:()=>state,soundIcon:()=>'',requestRender(){},consoleTick(){},crewRoomRequest:async body=>{requests.push(body);if(body.kind==='inspect')return {result:info};if(failure){failure=false;throw Error('Temporary network failure');}return {result:{text:'Confirmed'}};}},SAStationAccess:{access:()=>({definition:{name:type,utility:type,crewRoom:true,image:'room.webp'},item:{},ship})},SAShipMap:{installedItems:()=>[]},SAShipNavigationUI:{mountSelector(){},remember(){},toggleHold:async()=>{}},SAConsoleCommon:{standby:()=>'',updateSound(){}},alert:x=>alerts.push(x)};
  const context={window,document:doc,location:{href:'http://localhost/index.html',origin:'http://localhost'},URL,crypto,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../crew-room-console.js'),'utf8'),context);await window.SACrewRoomConsole.open(unit,type);assert.deepEqual(alerts,[]);
  const click=async selector=>{for(const fn of nodes.get(selector)?.listeners.get('click')||[])fn();await flush();};
  return {nodes,created,requests,messages,listeners,info,click,failNext:()=>{failure=true;},close:()=>created.find(e=>e.tag==='dialog').close()};
}

test('impaired Bar opens the established character dice iframe and retries the same D6 result and receipt',async()=>{
  const f=await setup('bar',{robotBartender:true,orders:[]});f.created.find(e=>e.tag==='dialog').querySelector('[data-drink]').value='Starlight Tonic';
  await f.click('[data-order]');const frame=f.created.find(e=>e.tag==='iframe');assert.ok(frame);assert.equal(frame.src,'http://localhost/character.html?shipRoll=1');assert.equal(f.requests.filter(r=>r.kind==='order').length,0);
  f.listeners.get('message')({origin:'http://localhost',source:frame.contentWindow,data:{type:'sa-ship-skill-ready'}});
  const prompt=f.messages[0];assert.equal(prompt.type,'sa-ship-skill-open');assert.deepEqual([...prompt.sides],[6]);assert.match(prompt.difficultyLabel,/1–3.*4–6/);assert.ok(acceptsSharedSkill(prompt.skill));assert.equal(prompt.exertionAvailable,0);assert.equal(acceptsSharedSkill(prompt.title),null);
  f.failNext();f.listeners.get('message')({origin:'http://localhost',source:frame.contentWindow,data:{type:'sa-ship-skill-result',rollId:prompt.rollId,score:2}});await flush();
  const retry=f.created.find(e=>e.tag==='button');assert.equal(retry.textContent,'Retry Submit');retry.onclick();await flush();
  const orders=f.requests.filter(r=>r.kind==='order');assert.equal(orders.length,2);assert.equal(orders[0].score,2);assert.equal(orders[1].score,2);assert.equal(orders[0].requestId,orders[1].requestId);assert.equal(f.messages.length,1);f.close();
});

test('hibernation console keeps manual wake available, blocks a second sleep and movement, and preserves console exit',async()=>{
  const f=await setup('hibernation-chamber',{hibernation:{phase:'sleeping',occupantName:'Test PC',activeSeconds:125}});
  assert.equal(f.nodes.get('[data-hibernate]').disabled,true);assert.equal(f.nodes.get('[data-wake]').disabled,false);assert.equal(f.nodes.get('[data-leave]').disabled,true);assert.match(f.nodes.get('[data-hibernation-time]').textContent,/2m 5s/);
  await f.click('[data-wake]');assert.equal(f.requests.filter(r=>r.kind==='wake').length,1);assert.equal(typeof f.nodes.get('[data-close]').onclick,'function');f.close();
});

test('fresh room status never borrows another room’s latest report',async()=>{
  const f=await setup('hibernation-chamber');assert.match(f.nodes.get('[data-records]').textContent,/Chamber ready/);assert.doesNotMatch(f.nodes.get('[data-records]').textContent,/drink order/);f.close();
});
