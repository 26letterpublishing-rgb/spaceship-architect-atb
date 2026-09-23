const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../showcase-ships'),maps=require('../ship-map-core'),power=require('../ship-power');

test('Explore ships are near 300,000 credits, fully powered and legally fitted',()=>{
  const ships=['pc','gm'].map(role=>make(role,role,role,[],role==='pc'?146:148));
  for(const record of ships){
    const ship=record.ship,cost=ship.gridCells.length*maps.HULL_COST+ship.sicInventory.reduce((n,i)=>n+maps.definition(i.type).price,0);
    assert.ok(cost>=290000&&cost<=310000);
    assert.equal(maps.exteriorError(ship),'');
    assert.ok(power.designBudget(record).available>=0);
    const used=new Set();
    for(const p of ship.placements){
      const item=ship.sicInventory.find(i=>i.id===p.sicId);
      for(const part of maps.placementParts(item,p)){
        const cells=maps.rectangleCells(ship,part.cell,part.entry.width,part.entry.height);
        assert.equal(cells.length,part.entry.width*part.entry.height);
        for(const cell of cells){assert.equal(used.has(cell),false,`${item.id} overlaps at ${cell}`);used.add(cell);}
        if(!part.entry.exterior&&!part.entry.mixed)assert.ok(cells.every(c=>ship.gridCells.includes(c)));
      }
    }
    const families=new Set(ship.sicInventory.map(i=>maps.definition(i.type).weaponFamily||i.type));
    for(const family of ['beam-laser','ripple-cannon','ion-pulse-cannon','missile-launcher','repair-drone-1','life-support'])assert.ok(families.has(family));
  }
  const type=(ship,key)=>maps.definition(ship.ship.sicInventory.find(i=>i.id.endsWith('-'+key)).type);
  assert.ok(type(ships[0],'shield').shieldHp>type(ships[1],'shield').shieldHp);
  assert.ok(type(ships[0],'ripple').tier>type(ships[1],'ripple').tier);
  assert.ok(maps.propulsion(ships[0]).moveSpeed>maps.propulsion(ships[1]).moveSpeed);
  assert.ok(maps.masking(ships[1])>maps.masking(ships[0]));
});
