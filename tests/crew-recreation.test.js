const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const fixture=require('./helpers/crew-recreation-fixture.cjs'),rooms=require('../ship-crew-rooms'),maps=require('../ship-map-core'),air=require('../ship-atmosphere'),stations=require('../station-access');
const command=(f,sicId,kind,extra={},options={})=>rooms.command(f.room,f.unit,{starshipId:f.ship.id,sicId,kind,requestId:randomUUID(),...extra},{campaign:f.campaign,outsideCombat:true,...options});

test('new room cards retain printed prices, footprints, thresholds and physical stations',()=>{
  for(const [type,price,width,en,threshold,number]of [['bar',1000,5,0,13,'B-64'],['hibernation-chamber',300,1,1,null,'A-67'],['brig',100,1,0,13,'B-67']]){
    const d=maps.definition(type);assert.deepEqual([d.price,d.width,d.height,d.energyCost,d.threshold,d.cardNumber],[price,width,width,en,threshold,number]);assert.equal(d.localOnly,true);assert.ok(d.stations.length);assert.match(d.cardArt,/\.webp$/);assert.match(d.image,/floorplan\.webp/);
  }
  const f=fixture();assert.equal(maps.exteriorError(f.ship.ship),'');f.seat('bridge');assert.equal(stations.consoles(f.room,f.unit).some(a=>['bar','sleep','brig'].includes(a.id)),false);
  assert.throws(()=>command(f,'bar','order',{text:'Tea'}),/station/);
});

test('Bar uses an exact 50% standard D6 split only for the impaired robotic bartender',()=>{
  const f=fixture(),item=f.ship.ship.sicInventory.find(i=>i.id==='bar');
  assert.match(command(f,'bar','order',{text:'Nebula Spritz'}).text,/requested drink/);assert.equal(f.unit.currentHp,10);
  item.impairmentPoints=1;assert.throws(()=>command(f,'bar','order',{text:'Tea'}),/D6/);
  for(let score=1;score<=6;score++){
    command(f,'bar','order',{text:'Tea',score});assert.equal(rooms.roomData(f.ship,'bar').orders[0].incorrect,score<=3);
  }
  for(const score of [0,7,2.5,NaN])assert.throws(()=>command(f,'bar','order',{text:'Tea',score}),/D6/);
  command(f,'bar','bartender',{enabled:false});assert.match(command(f,'bar','order',{text:'Tea'}).text,/manually/);
  assert.throws(()=>command(f,'bar','order',{text:'Tea'},{outsideCombat:false}),/outside combat/);
});

test('Bar orders and GM Brig records survive retries and JSON persistence without duplicate effects',()=>{
  const f=fixture(),requestId='bar-test-receipt';command(f,'bar','order',{requestId,text:'Lunar Ale'});assert.equal(command(f,'bar','order',{requestId,text:'Lunar Ale'}).duplicate,true);assert.equal(rooms.roomData(f.ship,'bar').orders.length,1);
  assert.throws(()=>command(f,'bar','order',{requestId,text:'Tea'}),/receipt/);
  f.seat('brig');assert.throws(()=>command(f,'brig','intake',{title:'Prisoner'}),/Only the GM/);
  const intake={title:'Captured raider',text:'Awaiting the captain.',requestId:'brig-intake-receipt'};
  command(f,'brig','intake',intake,{gm:true});command(f,'brig','intake',intake,{gm:true});assert.equal(rooms.roomData(f.ship,'brig').prisoners.length,1);
  command(f,'brig','condition',{text:'Door hinges damaged.'},{gm:true});
  const restored=JSON.parse(JSON.stringify(f.ship));assert.equal(rooms.roomData(restored,'bar').orders[0].requested,'Lunar Ale');assert.equal(rooms.roomData(restored,'brig').condition,'Door hinges damaged.');
  assert.throws(()=>command(f,'brig','release',{noteId:intake.requestId}),/GM/);
  command(f,'brig','release',{noteId:intake.requestId},{gm:true});assert.equal(rooms.roomData(f.ship,'brig').prisoners[0].released,true);
});

test('Hibernation persists an occupied chamber and active time; wake removes the movement restriction',()=>{
  const f=fixture();f.seat('sleep');command(f,'sleep','hibernate');assert.equal(rooms.inTreatment(f.room,'pc'),true);assert.equal(rooms.hibernating(f.room),true);
  rooms.advance(f.room,f.campaign,0);assert.equal(rooms.roomData(f.ship,'sleep').hibernation.activeSeconds,0);
  rooms.advance(f.room,f.campaign,12.5);assert.equal(rooms.roomData(f.ship,'sleep').hibernation.activeSeconds,12.5);assert.equal(f.unit.currentHp,10);
  const restored=JSON.parse(JSON.stringify({room:f.room,campaign:f.campaign}));rooms.advance(restored.room,restored.campaign,3.5);const stored=rooms.roomData(restored.room.starships[0],'sleep').hibernation;assert.equal(stored.activeSeconds,16);assert.equal(stored.phase,'sleeping');
  const id='sleep-wake-receipt';command(f,'sleep','wake',{requestId:id});assert.equal(command(f,'sleep','wake',{requestId:id}).duplicate,true);assert.equal(rooms.inTreatment(f.room,'pc'),false);
  assert.match(rooms.roomData(f.ship,'sleep').report.text,/manual wake/);
});

test('Hibernation refuses unavailable Life Support, impaired chamber, missing power and combat entry',()=>{
  for(const failure of ['life','power','chamber','oxygen','combat']){
    const f=fixture();f.seat('sleep');
    if(failure==='life')f.ship.ship.sicInventory.find(i=>i.id==='life').impaired=true;
    if(failure==='power')f.ship.ship.sicInventory.find(i=>i.id==='engine').disabled=true;
    if(failure==='chamber')f.ship.ship.sicInventory.find(i=>i.id==='sleep').impaired=true;
    if(failure==='oxygen'){air.sync(f.ship);f.ship.ship.atmosphereState.cells[105]=10;}
    assert.throws(()=>command(f,'sleep','hibernate',{},failure==='combat'?{outsideCombat:false}:{}),/Life Support|power|Repair|oxygen|outside combat/);assert.equal(rooms.hibernating(f.room),false);
  }
});

test('Hibernation emergency wakes on impairment once, support failure, damage, removal and encounter entry',()=>{
  for(const failure of ['impairment','life','power','damage','shield','removed','encounter']){
    const f=fixture();f.seat('sleep');f.ship.currentShieldHp=20;command(f,'sleep','hibernate');
    if(failure==='impairment')f.ship.ship.sicInventory.find(i=>i.id==='sleep').impairmentPoints=1;
    if(failure==='life')f.ship.ship.oxygenEnabled=false;
    if(failure==='power')f.ship.ship.sicInventory.find(i=>i.id==='engine').disabled=true;
    if(failure==='damage')f.ship.currentHullHp--;
    if(failure==='shield')f.ship.currentShieldHp--;
    if(failure==='removed')f.ship.ship.placements=f.ship.ship.placements.filter(p=>p.sicId!=='sleep');
    if(failure==='encounter')f.room.outsideCombat=false;
    assert.equal(rooms.reconcile(f.room,f.campaign),true);assert.equal(rooms.hibernating(f.room),false);
    assert.equal(f.unit.currentHp,failure==='impairment'?7:10);rooms.reconcile(f.room,f.campaign);assert.equal(f.unit.currentHp,failure==='impairment'?7:10);
    assert.equal(f.campaign.privateNotes.length,1);assert.match(f.campaign.privateNotes[0].message,/awakened/);
  }
});

test('another occupant cannot wake an occupied chamber or replace its sleeper',()=>{
  const f=fixture();f.seat('sleep');command(f,'sleep','hibernate');
  const other={...f.unit,id:'other',characterId:null,characterName:'Intruder'};f.room.units.push(other);
  const body={starshipId:f.ship.id,sicId:'sleep',requestId:'wrong-person-wake',kind:'wake'};
  assert.throws(()=>rooms.command(f.room,other,body,{campaign:f.campaign,outsideCombat:true}),/occupant or GM/);
  assert.throws(()=>rooms.command(f.room,other,{...body,kind:'hibernate'},{campaign:f.campaign,outsideCombat:true}),/already/);
  assert.equal(rooms.roomData(f.ship,'sleep').hibernation.occupantId,'pc');
});

test('a captured chamber cannot trap its sleeper, without granting other control or a hacking alarm',()=>{
  const f=fixture();f.seat('sleep');command(f,'sleep','hibernate');f.ship.hackedSystems=[{sicId:'sleep'}];
  assert.equal(rooms.inspect(f.room,f.campaign,f.unit,'sleep',false).details.hibernation.phase,'sleeping');assert.equal(f.campaign.privateNotes.length,0);
  assert.throws(()=>command(f,'sleep','hibernate'),/available room station/);
  command(f,'sleep','wake');assert.equal(rooms.inTreatment(f.room,'pc'),false);assert.match(rooms.roomData(f.ship,'sleep').report.text,/manual wake/);
  assert.throws(()=>command(f,'sleep','hibernate'),/available room station/);
});

test('Brig resize is free, rotates stations with its footprint, retains hull costs and refreshes air topology',()=>{
  const f=fixture(),item=f.ship.ship.sicInventory.find(i=>i.id==='brig'),hull=[...f.ship.ship.gridCells];
  assert.equal(air.layout(f.ship).footprint.get(126),undefined);
  item.brigWidth=2;item.brigHeight=1;assert.equal(maps.componentDefinition(item).width,2);assert.equal(maps.sicPrice(item,f.ship.ship),100);assert.deepEqual(f.ship.ship.gridCells,hull);
  assert.equal(air.layout(f.ship).footprint.get(126).sicId,'brig');
  for(const rotation of [0,90,180,270]){const d=maps.componentDefinition({...item,rotation});assert.equal(d.width*d.height,2);assert.ok(d.stations.every(s=>s.x>=0&&s.x<d.width&&s.y>=0&&s.y<d.height));}
  assert.equal(maps.exteriorError(f.ship.ship),'');item.brigWidth=60;assert.notEqual(maps.exteriorError(f.ship.ship),'');
  const d=maps.componentDefinition({...item,brigWidth:-5,brigHeight:Infinity});assert.equal(d.width,1);assert.equal(d.height,60);
});
