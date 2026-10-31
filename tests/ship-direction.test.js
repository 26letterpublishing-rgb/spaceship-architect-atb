const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),arena=require('../arena-files');
test('legacy facing is unanimous or UP, without modifying saved fields',()=>{
  for(const [ship,expected] of [[{},0],[{thrusterDirection:270},270],[{thrusterDirection:90,sicInventory:[{type:'beam-laser-6',weaponFacing:90}]},90],[{thrusterDirection:90,sicInventory:[{type:'beam-laser-6',weaponFacing:270}]},0],[{shipDirection:180,thrusterDirection:90},180],[{shipDirection:45},0]]){
    const original=structuredClone(ship);assert.equal(maps.shipDirection(ship),expected);assert.deepEqual(ship,original);
  }
});
test('every facing rotates toward either column, with invertible canonical coordinates and no reflection',()=>{
  for(const direction of [0,90,180,270])for(const target of [90,270]){
    const rotation=maps.displayRotation({shipDirection:direction},target);assert.equal((direction+rotation)%360,target);
    for(const [x,y] of [[0,0],[7,3],[1.5,2.5],[3,1]]){
      const p=maps.orientPoint(x,y,7,3,rotation),back=maps.orientPoint(p.x,p.y,7,3,rotation,true);assert.deepEqual(back,{x,y});
    }
    const a=maps.orientPoint(0,0,7,3,rotation),b=maps.orientPoint(1,0,7,3,rotation),c=maps.orientPoint(0,1,7,3,rotation);
    assert.equal((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),1);
  }
});
test('whole-ship pose preserves canonical weapon/thruster artwork, footprints and routes',()=>{
  const ship={zoneColumns:20,gridCells:Array.from({length:120},(_,i)=>i),sicInventory:[{id:'gun',type:'beam-laser-6',rotation:90,exteriorRotation:90,weaponFacing:270},{id:'thr',type:'exhaust-thruster-3',rotation:90},{id:'plate',type:'hull-plating',attachTo:'hull'}],placements:[{sicId:'gun',cell:42,exteriorCell:142},{sicId:'thr',cell:164},{sicId:'plate',cell:0}]};
  const original=structuredClone(ship),baseline=maps.buildLayout(ship);
  const shape=layout=>[...layout.footprint].map(([n,c])=>[n,c.sicId,c.column,c.row,c.exterior,c.stations]);
  for(const direction of [0,90,180,270]){
    const layout=maps.buildLayout({...ship,shipDirection:direction,shipRotation:direction,unifiedShipFacing:true});assert.deepEqual(shape(layout),shape(baseline));assert.deepEqual(maps.propulsion(layout.ship),maps.propulsion(ship));assert.equal(maps.masking(layout.ship),maps.masking(ship));
    const gun=[...layout.footprint].find(([,c])=>c.sicId==='gun'&&c.exterior&&!c.offset);assert.ok(gun);
    assert.match(maps.surfaceMarkup(layout,gun[0]),/rotate\(360deg\)/);
    const thruster=[...layout.footprint].find(([,c])=>c.sicId==='thr'&&!c.offset);assert.ok(thruster);
    assert.match(maps.surfaceMarkup(layout,thruster[0]),/--thruster-angle:0deg/);
    assert.deepEqual(maps.meshRoute(layout,{square:0,mesh:0},{square:1,mesh:8}),maps.meshRoute(baseline,{square:0,mesh:0},{square:1,mesh:8}));
  }
  assert.deepEqual(ship,original);
});
test('analysis retains only the scanned facing, not later hidden direction changes',()=>{
  const sensors=require('../ship-sensors');
  const a={id:'a',ship:{gridCells:[42,43],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43}],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'}]}};
  const b={id:'b',sensorScenarioMasking:1,ship:{shipDirection:90,gridCells:[42],placements:[{sicId:'cp',cell:42}],sicInventory:[{id:'cp',type:'cockpit-1'}]}};
  const unit={id:'u',characterId:'c',team:'pc',speed:5,atb:100,location:{starshipId:'a',sicId:'cp',square:42,mesh:0,stationed:true}};
  const room={showcase:true,activeId:'u',threshold:100,starships:[a,b],units:[unit],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],log:[]};
  sensors.refresh(room);assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'analysis',targetId:'b',requestId:'direction'}).ok,true);
  sensors.resolveInput(room,unit,()=>6);sensors.resolveReport(room,unit,unit.queuedEffects[0]);
  b.ship.shipDirection=270;
  assert.equal(sensors.view(room,'a').starships.find(s=>s.id==='b').ship.shipDirection,90);
});
test('portable arena save/load retains all four saved ship directions and legacy data',()=>{
  for(const direction of [0,90,180,270]){
    const ship={id:'s',ship:{shipDirection:direction,shipRotation:direction,unifiedShipFacing:true,thrusterDirection:270,gridCells:[0],placements:[],sicInventory:[]}};
    const file=arena.create({mode:'starship',ships:[ship]});const loaded=arena.parse(JSON.parse(JSON.stringify(file)));
    assert.equal(loaded.ships[0].ship.shipDirection,direction);assert.equal(loaded.ships[0].ship.shipRotation,direction);assert.equal(loaded.ships[0].ship.unifiedShipFacing,true);assert.equal(loaded.ships[0].ship.thrusterDirection,270);
  }
});


test('saved whole-ship rotation composes once in combat and leaves legacy parts together',()=>{
  const legacy={thrusterDirection:270,sicInventory:[{type:'beam-laser-6',weaponFacing:90}],shipDirection:90,shipRotation:90};
  assert.equal(maps.displayRotation(legacy,90),90);
  for(const turn of [0,90,180,270])for(const target of [90,270]){
    const ship={shipDirection:turn,shipRotation:turn,unifiedShipFacing:true};
    assert.equal(maps.displayRotation(ship,target),target,'combat displays canonical assembly once, independently of saved builder pose');
  }
});

test('screen movement keys and releases use the same inverse whole-ship rotation',()=>{
  const arrows=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'],letters=['w','d','s','a'];
  for(const rotation of [0,90,180,270])for(let i=0;i<4;i++){
    assert.equal(maps.shipViewKey({shipRotation:rotation},arrows[i]),arrows[(i-rotation/90+4)%4]);
    assert.equal(maps.shipViewKey({shipRotation:rotation},letters[i]),letters[(i-rotation/90+4)%4]);
  }
  assert.equal(maps.shipViewKey({shipRotation:90},'Escape'),'Escape');
});

test('direction changes only directional art, independently of saved rigid rotation',()=>{
  const base={zoneColumns:20,gridCells:Array.from({length:120},(_,i)=>i),unifiedShipFacing:true,sicInventory:[{id:'room',type:'science-lab',rotation:0},{id:'gun',type:'beam-laser-6',rotation:90,exteriorRotation:90},{id:'thr',type:'exhaust-thruster-3',rotation:90}],placements:[{sicId:'room',cell:0},{sicId:'gun',cell:42,exteriorCell:142},{sicId:'thr',cell:164}]};
  const baseline=maps.buildLayout(base),shape=l=>[...l.footprint].map(([n,c])=>[n,c.sicId,c.column,c.row,c.width,c.height]);
  for(const rotation of [0,90,180,270])for(const direction of [0,90,180,270]){
    const layout=maps.buildLayout({...base,shipDirection:direction,shipRotation:rotation});
    assert.deepEqual(shape(layout),shape(baseline));
    assert.equal(maps.surfaceMarkup(layout,0),maps.surfaceMarkup(baseline,0),'non-directional room artwork unchanged');
    const forward=(direction-rotation+360)%360;
    const gun=[...layout.footprint].find(([,c])=>c.sicId==='gun'&&c.exterior&&!c.offset)[0];
    const thr=[...layout.footprint].find(([,c])=>c.sicId==='thr'&&!c.offset)[0];
    assert.ok(maps.surfaceMarkup(layout,gun).includes(`rotate(${(forward+180)%360+180}deg)`));
    assert.ok(maps.surfaceMarkup(layout,thr).includes(`--thruster-angle:${forward}deg`));
    assert.equal((forward+maps.displayRotation(layout.ship,90))%360,90,'combat forward faces right exactly once');
  }
});
