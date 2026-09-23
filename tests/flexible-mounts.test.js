const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),stations=require('../station-access'),engine=require('../combat-engine');
test('independent EXT/EDG rotations allow one shared-edge pair, but never corner-only contact',()=>{
  for(const rotation of [0,90,180,270])for(const exteriorRotation of [0,90,180,270]){
    const item={id:'gun',type:'beam-laser-3',rotation,exteriorRotation};
    const inside=maps.segmentDefinition(item,'interior'),outside=maps.segmentDefinition(item,'exterior');
    const origin=168,exteriorCell=(8+inside.height-1)*20+8+inside.width;
    const ship={gridCells:maps.rectangleCells({},origin,inside.width,inside.height),sicInventory:[item],placements:[{sicId:'gun',cell:origin,exteriorCell}]};
    assert.equal(maps.mixedPlacement(ship,item,origin,exteriorCell),true,`rotations ${rotation}/${exteriorRotation}`);
    const layout=maps.buildLayout(ship),inner=[...layout.footprint].filter(([,p])=>!p.exterior);
    assert.equal(inner.length,2);assert.equal(layout.footprint.size,2+outside.width*outside.height);
    assert.equal(maps.mixedPlacement(ship,item,origin,exteriorCell+20),false,'Corner-only');
    assert.equal(maps.mixedPlacement(ship,item,origin,exteriorCell+2),false,'Detached');
    assert.equal(maps.mixedPlacement(ship,item,origin,origin),false,'Outside cannot overlap hull');
    assert.match(maps.surfaceMarkup(layout,exteriorCell),/sa-exterior-weapon/);
    assert.doesNotMatch(maps.surfaceMarkup(layout,exteriorCell),/sa-exterior-mount/);
    assert.match(maps.surfaceMarkup(layout,exteriorCell),/--art-shift-x:/);
    const station=inner.flatMap(([square,c])=>c.stations.filter(s=>s.x===c.column&&s.y===c.row).map(s=>({square,...s})))[0];
    assert.ok(stations.access({starships:[{id:'ship',ship}]},{location:{starshipId:'ship',sicId:'gun',square:station.square,mesh:station.mesh,stationed:true}},'gun'));
  }
});
test('split mounts reject enclosed voids and other SICs',()=>{
  const item={id:'gun',type:'ion-pulse-cannon-1',rotation:90,exteriorRotation:90};
  const ship={gridCells:[...Array.from({length:30},(_,i)=>84+Math.floor(i/6)*20+i%6)].filter(n=>![125,126].includes(n)),sicInventory:[item],placements:[]};
  assert.equal(maps.mixedPlacement(ship,item,105,125),false,'Enclosed void is not outer space');
  const hull={gridCells:[168,169],sicInventory:[item,{id:'other',type:'lock-on-1'}],placements:[{sicId:'other',cell:168}]};
  assert.equal(maps.mixedPlacement(hull,item,168,148),false);
});
test('two cells on every edge remap doors, both SIC sections and positions without changing hull count',()=>{
  const ship={zoneColumns:20,zoneRows:20,gridCells:[168,169],sicInventory:[{id:'g',type:'beam-laser-3',rotation:90,exteriorRotation:90}],placements:[{sicId:'g',cell:168,exteriorCell:148}],doorStates:{'168:169':'open'}};
  const a=maps.resizeZone(ship,24,24,2,2),b=maps.resizeZone(a,28,28,2,2);
  assert.deepEqual(a.gridCells,[250,251]);assert.deepEqual(b.gridCells,[348,349]);
  assert.equal(a.placements[0].exteriorCell,226);assert.equal(a.doorStates['250:251'],'open');
  assert.equal(maps.remapSquare(168,ship,b),348);assert.equal(maps.remapSquare(348,b,ship),168);
  assert.equal(maps.exteriorError(b),'');assert.equal(maps.gridColumns({}),20);
});
test('walk duration scales inversely with Move Speed in both axes and expanded columns',()=>{
  const start={square:950,mesh:4},end={square:951,mesh:4};
  assert.equal(maps.walkingMilliseconds(start,end,3,40),3000);
  assert.equal(maps.walkingMilliseconds(start,end,9,40),1000);
  assert.equal(maps.walkingMilliseconds(start,{square:990,mesh:4},9,40),1000);
  const unit={};engine.syncUnitCombat(unit,{location:{starshipId:'s',square:951,mesh:4}});assert.equal(unit.location.square,951);
});
