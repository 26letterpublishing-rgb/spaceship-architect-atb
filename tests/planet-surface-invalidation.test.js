'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function harness(){
 const window={},sandbox={window,performance:{now:()=>10},cancelAnimationFrame(){},document:{hidden:true}};
 const source=fs.readFileSync(require.resolve('../planet-surfaces-ui.js'),'utf8').replace('window.SAPlanetSurfaces={','window.testSurface={packetSignature,setActive:a=>active=a};window.SAPlanetSurfaces={');vm.runInNewContext(source,sandbox);
 const args={mapId:'m',starId:'s',planetId:'p',regionId:''},state={code:'room',role:'gm',ownCharacterId:'pc',characters:[],npcRoster:[],shops:{list:[]},starships:[],combatActive:false,starmaps:{maps:[{id:'m',name:'Sector',stars:[{id:'s',name:'Star',system:[{id:'p',name:'Planet',size:'large'}],surfaces:{p:{hexes:{},regions:{}}}},{id:'else',description:'old',surfaces:{other:{hexes:{}}}}]}],navigation:{mode:'surface'},localPositions:{},partyJourney:{id:'journey',kind:'walk',from:{hex:'0'},to:{hex:'1'},total:20,remaining:20,clockAt:0}}};
 const host={classList:{contains:()=>true}},c={host,state,data:state.starmaps,ships:[]},active={svg:{isConnected:true},c,args,stamp:0,packetSignature:window.testSurface.packetSignature(state,args)};window.testSurface.setActive(active);
 return {window,state,args,host,c,active,signature:s=>window.testSurface.packetSignature(s,args),retain:s=>window.SAPlanetSurfaces.retainPacket(s,host)};
}
test('unrelated star description/chart changes retain DOM and refresh context references',()=>{
 const h=harness(),next=structuredClone(h.state);next.starmaps.maps[0].stars[1].description='new';next.starmaps.maps[0].stars[1].surfaces.other.hexes[1]={terrain:'desert'};
 assert.equal(h.retain(next),true);assert.equal(h.c.state,next);assert.equal(h.c.data,next.starmaps);assert.equal(h.c.map,next.starmaps.maps[0]);assert.equal(h.active.stamp,10);
});
for(const [name,change]of Object.entries({
 terrain:s=>s.starmaps.maps[0].stars[0].surfaces.p.hexes[0]={terrain:'water'},
 region:s=>s.starmaps.maps[0].stars[0].surfaces.p.regions[0]={name:'Town'},
 planet:s=>s.starmaps.maps[0].stars[0].system[0].name='Renamed',
 star:s=>s.starmaps.maps[0].stars[0].name='Renamed',
 sector:s=>s.starmaps.maps[0].name='Renamed',
 permissions:s=>s.starmaps.navigation.allowed={surface:false},
 role:s=>s.role='pc',operator:s=>s.ownCharacterId='other',room:s=>s.code='other',
 crew:s=>s.characters.push({id:'pc',character:{identity:{characterName:'Renamed'}}}),
 npc:s=>s.npcRoster.push({id:'npc',characterName:'Renamed'}),shops:s=>s.shops.list.push({id:'shop'}),
 ship:s=>s.starships.push({id:'ship',controlType:'pc',ship:{sicInventory:[]}}),
 party:s=>s.starmaps.party={planetId:'p',hex:'3'},
 visibility:s=>s.starmaps.maps[0].stars[0].surfaces.p.hexes[0]={gmNotes:'private'},
 journey:s=>s.starmaps.partyJourney.to.hex='2',
 travelControls:s=>s.starmaps.launchableShipIds=['ship'],
 event:s=>s.starmaps.viewEvent={id:'focus'},combat:s=>s.combatActive=true,
 unknownMapField:s=>s.starmaps.futurePermission=false
}))test(name+' invalidates before any stale-context reuse',()=>{const h=harness(),next=structuredClone(h.state);change(next);assert.equal(h.retain(next),false);assert.equal(h.c.state,h.state);});
test('countdown-only packets retain terrain but supply live timing; routes stay invalidating',()=>{const h=harness(),next=structuredClone(h.state);next.starmaps.partyJourney.remaining=12;next.starmaps.partyJourney.clockAt=100;assert.equal(h.retain(next),true);assert.equal(h.c.data.partyJourney.remaining,12);next.starmaps.partyJourney.id='next';assert.equal(h.retain(next),false);});
test('detached and uncertain views fall back; cache is only active view',()=>{const h=harness();h.active.svg.isConnected=false;assert.equal(h.retain(h.state),null);h.active.svg.isConnected=true;const missing=structuredClone(h.state);missing.starmaps.maps=[];assert.equal(h.retain(missing),false);const cyclic=structuredClone(h.state);cyclic.starmaps.loop=cyclic;assert.equal(h.retain(cyclic),false);});
test('packet reuse is not called from explicit draw/recovery paths',()=>{const source=fs.readFileSync(require.resolve('../campaign-starmaps-ui.js'),'utf8');assert.equal((source.match(/retainPacket\(/g)||[]).length,1);assert.ok(source.indexOf('retainPacket(')>source.indexOf('function update(next,key)'));const surface=fs.readFileSync(require.resolve('../planet-surfaces-ui.js'),'utf8');assert.match(surface,/catch\(error\)\{c.draw\(\);c.status/);});
