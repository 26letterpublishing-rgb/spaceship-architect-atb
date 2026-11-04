const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../showcase-ships'),maps=require('../ship-map-core'),power=require('../ship-power');

test('fresh Explore encounter copies existing NPC icon choices without changing templates',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../campaign-api'),'utf8');
  const templates=require('../data/npc-templates.json'),before=JSON.stringify(templates);
  const selectedNpcs=require('../data/showcase-roster.json').npcs.map(ref=>({...templates.find(n=>n.id===ref.id),...ref}));
  const start=source.indexOf('const rosterUnits = selectedNpcs.map('),end=source.indexOf('\n      for(const unit of rosterUnits)',start);
  assert.ok(start>=0&&end>start);
  const context={units:[],selectedNpcs,npcUnitId:n=>'unit-'+n.id,pcShip:{id:'own'},pcSquares:[1,2,3,4],npcShip:{id:'test-ship'},npcSquares:[1],showcaseLocation:(id,square)=>({starshipId:id,square})};
  vm.runInNewContext(source.slice(start,end)+'this.units=rosterUnits;',context);
  for(const [index,unit] of context.units.entries()){
    assert.equal(unit.iconRace,selectedNpcs[index].iconRace);assert.equal(unit.iconVariant,selectedNpcs[index].iconVariant);
    const art=require('../token-art'),choice=art.character(unit);assert.equal(choice.race,selectedNpcs[index].iconRace);
    assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',art.atlas(choice.race))));
  }
  assert.equal(JSON.stringify(templates),before);
});

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


test('fresh Explore PC units preserve their own character appearance without hardcoded replacements',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../campaign-api'),'utf8'),art=require('../token-art');
 const pcDefinitions=[0,1].map(i=>({id:'pc-'+i,attributes:{dexterity:[1],perception:[1],strength:[1],intellect:[1]},skills:{}}));
 const characters=[{character:{identity:{raceId:'human',raceType:''},presentation:{iconVariant:1},resources:{},computed:{}}},{character:{identity:{raceId:'android',raceType:'perfect-robot'},presentation:{iconVariant:0},resources:{},computed:{}}}];
 const before=JSON.stringify(characters),context={clone:structuredClone,pcDefinitions,characters,pcShip:{id:'own'},pcSquares:[1,2],showcaseLocation:(id,square)=>({starshipId:id,square})};
 const start=source.indexOf('      const units = pcDefinitions.map('),end=source.indexOf('      const rosterUnits = selectedNpcs.map(',start);
 vm.runInNewContext(source.slice(start,end)+'this.result=units;',context);
 assert.deepEqual(Array.from(context.result,u=>art.character(u)),[{race:'human',variant:1},{race:'android-perfect-robot',variant:0}]);
 assert.equal(JSON.stringify(characters),before);assert.deepEqual(Array.from(context.result,u=>u.location.square),[1,2]);
});
