const test=require('node:test'),assert=require('node:assert/strict');
const fixture=require('./helpers/crew-room-fixture.cjs'),rooms=require('../ship-crew-rooms'),maps=require('../ship-map-core'),ai=require('../ship-ai'),stations=require('../station-access');
const resolve=(room,campaign,body,auth)=>rooms.resolve(room,campaign,{stage:rooms.jobs(room).find(({job})=>job.id===body.jobId)?.job.phase,...body},auth);
const command=(f,sicId,kind,extra={},outsideCombat=true)=>rooms.command(f.room,f.unit,{starshipId:f.ship.id,sicId,kind,requestId:require('node:crypto').randomUUID(),...extra},{campaign:f.campaign,outsideCombat});
test('crew SIC footprints, stations and prices match source cards and user overrides',()=>{
  for(const [type,size,price]of [['vr-training-room',3,7500],['medbay',3,1000],['library',2,150],['meeting-room',3,100]]){const d=maps.definition(type);assert.equal(d.width,size);assert.equal(d.height,size);assert.equal(d.price,price);assert.ok(d.stations.length);}
  assert.equal(maps.definition('ship-ai').bridgeAddon,true);assert.equal(maps.definition('ship-ai').price,5000);
  const f=fixture();assert.equal(maps.exteriorError(f.ship.ship),'');
});
test('VR applies manual D4 tenths once per character per campaign day',()=>{
  const f=fixture();f.seat('vr');const body={requestId:'training-request',skill:'Weapon Systems',score:4};
  assert.match(command(f,'vr','train',body).text,/1.9 to 2.3/);assert.equal(f.character.character.skills['Weapon Systems'].tenths,23);
  assert.equal(command(f,'vr','train',body).duplicate,true);
  assert.throws(()=>command(f,'vr','train',{skill:'Engineering',score:1}),/Daily/);
  f.campaign.elapsedMinutes=1440;assert.doesNotThrow(()=>command(f,'vr','train',{skill:'Engineering',score:1}));
});
test('VR rejects combat, missing gravity and invalid dice',()=>{
  const f=fixture();f.seat('vr');assert.throws(()=>command(f,'vr','train',{skill:'Engineering',score:1},false),/outside combat/);
  f.ship.ship.gravityEnabled=false;assert.throws(()=>command(f,'vr','train',{skill:'Engineering',score:1}),/gravity/);
  f.ship.ship.gravityEnabled=true;assert.throws(()=>command(f,'vr','train',{skill:'Engineering',score:5}),/D4/);
  assert.throws(()=>command(f,'vr','train',{skill:'Engineering'}),/D4/);
});

test('VR trains through 4.0 with D4, then awards exactly one tenth without dice',()=>{
  for(const rating of [20,39,40,41]){
    const f=fixture();f.seat('vr');f.character.character.skills.Engineering.tenths=rating;
    const details=rooms.inspect(f.room,f.campaign,f.unit,'vr',false),choice=details.skills.find(s=>s.name==='Engineering');
    assert.equal(choice.trainingGain,rating>40?1:null);
    const body={requestId:'vr-boundary-'+rating,skill:'Engineering',...(rating<=40?{score:4}:{})};
    command(f,'vr','train',body);const expected=rating+(rating>40?1:4);
    assert.equal(f.character.character.skills.Engineering.tenths,expected);
    assert.equal(f.character.character.computed.skills.Engineering,expected/10);
    assert.equal(command(f,'vr','train',body).duplicate,true);
    assert.throws(()=>command(f,'vr','train',{skill:'Weapon Systems',score:4}),/Daily/);
    f.campaign.elapsedMinutes=1440;
    command(f,'vr','train',{skill:'Engineering',score:4});
    assert.equal(f.character.character.skills.Engineering.tenths,expected+(expected>40?1:4));
  }
});

test('VR reaches 6.0, then hides capped skills and refuses further bonuses without consuming the day',()=>{
  const f=fixture();f.seat('vr');f.character.character.skills.Engineering.tenths=59;
  command(f,'vr','train',{skill:'Engineering'});assert.equal(f.character.character.skills.Engineering.tenths,60);
  f.campaign.elapsedMinutes=1440;
  assert.equal(rooms.inspect(f.room,f.campaign,f.unit,'vr',false).skills.some(s=>s.name==='Engineering'),false);
  assert.throws(()=>command(f,'vr','train',{skill:'Engineering',score:4}),/6.0/);
  assert.doesNotThrow(()=>command(f,'vr','train',{skill:'Weapon Systems',score:2}));
  f.campaign.elapsedMinutes=2880;f.character.character.skills.Engineering.tenths=80;
  assert.throws(()=>command(f,'vr','train',{skill:'Engineering'}),/6.0/);assert.equal(f.character.character.skills.Engineering.tenths,80);
});

test('fixed VR training ignores supplied dice and updates Endurance movement by only 0.1',()=>{
  const f=fixture();f.seat('vr');f.character.character.skills['Athletics']=4.1;
  const before=f.character.character.computed.moveSpeed;
  command(f,'vr','train',{skill:'Athletics',score:999});
  assert.equal(f.character.character.skills['Athletics'].tenths,42);
  assert.equal(f.character.character.computed.moveSpeed,before+.1);
});

test('existing VR placement shrinks in place without deleting hull or saved room settings',()=>{
  const f=fixture(),p=f.ship.ship.placements.find(p=>p.sicId==='vr'),item=f.ship.ship.sicInventory.find(i=>i.id==='vr'),hull=[...f.ship.ship.gridCells];
  rooms.roomData(f.ship,'vr').simulation='Saved Simulation';
  const saved=JSON.parse(JSON.stringify(f.ship)),layout=maps.buildLayout(saved.ship);
  assert.equal([...layout.footprint.values()].filter(c=>c.sicId==='vr').length,9);
  assert.deepEqual(saved.ship.gridCells,hull);assert.equal(saved.ship.placements.find(p=>p.sicId==='vr').cell,p.cell);
  assert.equal(rooms.roomData(saved,'vr').simulation,'Saved Simulation');
  for(const rotation of [0,90,180,270])for(const stationLayout of [undefined,'corners-v1']){
    const d=maps.componentDefinition({...item,rotation,stationLayout});assert.equal(d.stations.length,2);assert.ok(d.stations.every(s=>s.x<3&&s.y<3));
  }
});
test('rooms require local stations, not remote bridge access',()=>{
  const f=fixture();f.seat('bridge');assert.equal(stations.consoles(f.room,f.unit).some(a=>a.id==='library'),false);assert.equal(stations.consoles(f.room,f.unit).some(a=>a.id==='ai'),true);
  assert.throws(()=>command(f,'library','note',{title:'Test',text:'Private'}),/station/);
});
test('Library and Meeting Room persist shared records without granting bonuses',()=>{
  const f=fixture();f.seat('library');command(f,'library','note',{title:'Coordinates',text:'Survey sector 7'});
  assert.equal(rooms.roomData(f.ship,'library').notes.length,1);
  assert.throws(()=>command(f,'library','refresh'),/GM/);
  f.ship.ship.sicInventory.find(i=>i.id==='library').impaired=true;assert.throws(()=>command(f,'library','note',{title:'x',text:'y'}),/inaccessible/);
  f.seat('meeting');command(f,'meeting','note',{title:'Next stop',text:'Dock for repairs'});
  const note=rooms.roomData(f.ship,'meeting').notes[0];command(f,'meeting','check',{noteId:note.id,checked:true});assert.equal(note.checked,true);
});
test('Medbay living patients heal every three active seconds without supplies or dice',()=>{
 const f=fixture();rooms.advance(f.room,f.campaign,2.9);assert.equal(f.unit.currentHp,10);rooms.advance(f.room,f.campaign,.1);assert.equal(f.unit.currentHp,11);assert.equal(f.character.character.health.current,11);assert.equal(rooms.pending(f.room),false);assert.deepEqual(rooms.rolls(f.room),[]);rooms.advance(f.room,f.campaign,1000);assert.equal(f.unit.currentHp,30);
});
test('unconscious patients prepare for sixty seconds, then revive on the first three-second tick',()=>{
 const f=fixture();f.unit.currentHp=0;f.unit.defeatedAt=1;f.unit.oxygenUnconscious=true;rooms.advance(f.room,f.campaign,60);assert.equal(f.unit.currentHp,0);rooms.advance(f.room,f.campaign,3);assert.equal(f.unit.currentHp,1);assert.equal(f.unit.defeatedAt,null);assert.equal(f.unit.oxygenUnconscious,false);assert.equal(rooms.state(f.ship).down.pc,0);
});
test('death deadline continues through preparation and cannot be reset by leaving and entering',()=>{
 const f=fixture();f.unit.currentHp=0;rooms.state(f.ship).down.pc=250;rooms.advance(f.room,f.campaign,51);assert.equal(f.unit.currentHp,0);assert.equal(rooms.jobs(f.room)[0].job.phase,'dead');assert.match(rooms.state(f.ship).report.text,/Patient is dead/);f.seat('bridge');rooms.advance(f.room,f.campaign,5);f.seat('med');rooms.advance(f.room,f.campaign,1000);assert.equal(f.unit.currentHp,0);assert.equal(rooms.state(f.ship).down.pc,300);
});
test('large time steps revive before the deadline when the first HP tick is early enough',()=>{
 const f=fixture();f.unit.currentHp=0;rooms.state(f.ship).down.pc=230;rooms.advance(f.room,f.campaign,100);assert.ok(f.unit.currentHp>0);assert.equal(rooms.state(f.ship).down.pc,0);
});
test('recovery preserves fractional timers across serialization and stops when patient leaves',()=>{
 const f=fixture();rooms.advance(f.room,f.campaign,1.5);const room=structuredClone(f.room);rooms.advance(room,f.campaign,1.5);assert.equal(room.units[0].currentHp,11);room.units[0].location.square=22;rooms.advance(room,f.campaign,100);assert.equal(room.units[0].currentHp,11);assert.equal(rooms.inTreatment(room,'pc'),false);
});
test('impaired or unpowered Medbay cannot heal and legacy dice cannot inject healing',()=>{
 const f=fixture();f.ship.ship.sicInventory.find(i=>i.id==='med').impaired=true;rooms.advance(f.room,f.campaign,100);assert.equal(f.unit.currentHp,10);assert.throws(()=>rooms.resolve(f.room,f.campaign,{score:18}),/automatic/);f.ship.ship.sicInventory.find(i=>i.id==='med').impaired=false;f.ship.ship.sicInventory.find(i=>i.id==='engine').disabled=true;rooms.advance(f.room,f.campaign,100);assert.equal(f.unit.currentHp,10);
});
test('Ship AI occupies one free bridge station, has exact 4D6 pools and never displaces crew',()=>{
  const f=fixture();ai.sync(f.room,body=>({...body,id:'new',atb:0}));let actor=f.room.units.find(u=>u.shipAi);assert.ok(actor);assert.deepEqual(actor.dexterityDice,[6,6,6,6]);assert.equal(actor.pilotSkill,2.5);assert.equal(actor.moveSpeed,0);
  const saved={...actor.location};f.unit.location=saved;ai.sync(f.room,body=>body);actor=f.room.units.find(u=>u.shipAi);assert.notDeepEqual(actor.location,f.unit.location);
  ai.detectIntrusion(f.room,f.ship.id,'bridge');assert.match(rooms.state(f.ship).aiAlert.text,/intrusion/);
  f.ship.ship.sicInventory.find(i=>i.id==='ai').disabled=true;ai.sync(f.room,body=>body);assert.equal(actor.speed,0);
});

test('Meeting Room has six central chairs in two columns, including corner-layout saves and rotations',()=>{
 for(const rotation of [0,90,180,270]){const d=maps.componentDefinition({type:'meeting-room',rotation,stationLayout:'corners-v1'});assert.equal(d.stations.length,6);assert.equal(new Set(d.stations.map(s=>s.mesh)).size,6);assert.ok(d.stations.every(s=>s.x===1&&s.y===1));}
 assert.deepEqual(maps.definition('meeting-room').stations.map(s=>s.mesh),[0,2,3,5,6,8]);
});
