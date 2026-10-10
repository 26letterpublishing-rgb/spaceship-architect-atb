const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),rooms=require('../ship-crew-rooms'),weapons=require('../ship-weapons'),locks=require('../ship-locks');
const fixture=require('./helpers/crew-room-fixture.cjs');

test('triangular hull derives all orientations, adds HP without size, and is never walkable',()=>{
 for(const [neighbors,corner] of [[[22,41],'nw'],[[22,43],'ne'],[[43,62],'se'],[[41,62],'sw']]){
  const ship={gridCells:neighbors,triangleCells:[42],sicInventory:[],placements:[]};
  assert.equal(maps.triangleOrientation(ship,42),corner);assert.equal(maps.triangleError(ship),'');
  assert.equal(maps.hullHp(ship),3);assert.deepEqual(maps.propulsion(ship),maps.propulsion({...ship,triangleCells:[]}));
  const layout=maps.buildLayout(ship);assert.equal(layout.hull.has(42),false);assert.equal(layout.footprint.has(42),false);
  assert.match(maps.surfaceMarkup(layout,42),new RegExp('data-triangle="'+corner+'"'));
  const moved=maps.resizeZone(ship,30,30,1,2);assert.equal(maps.triangleOrientation(moved,moved.triangleCells[0]),corner);
 }
});
test('triangles reject missing supports, occupied angled side, and SIC overlap',()=>{
 const base={gridCells:[21,22,41],triangleCells:[42],sicInventory:[],placements:[]};
 for(const cells of [[21,22],[21,22,41,43],[21,22,41,62],[21,22,41,63],[21,22,41,42]])assert.ok(maps.triangleError({...base,gridCells:cells}));
 assert.ok(maps.triangleError({...base,sicInventory:[{id:'x',type:'scramble-box'}],placements:[{sicId:'x',cell:42}]}));
 assert.equal(maps.exteriorPlacement(base,'rapid-laser-1',42,'gun'),false);
 assert.equal(maps.triangleError({...base,triangleCells:['42']} )!=='',true);
});
test('fortification stacks on its own SIC and changes actual multi-impairment damage',()=>{
 const f=fixture(),s=f.ship.ship;f.ship.currentHullHp=200;
 s.sicInventory.push({id:'gun',type:'rapid-laser-2'},{id:'fort1',type:'vulnerability-fortification',attachTo:'gun'},{id:'fort2',type:'vulnerability-fortification',attachTo:'gun'});
 s.placements.push({sicId:'gun',cell:1},{sicId:'fort1',cell:1},{sicId:'fort2',cell:1});
 assert.equal(maps.effectiveThreshold(f.ship,s.sicInventory.find(i=>i.id==='gun')),8);
 assert.equal(maps.effectiveThreshold(f.ship,s.sicInventory.find(i=>i.id==='life')),18);
 assert.equal(maps.buildLayout(s).footprint.get(1).sicId,'gun');
 const source={id:'attacker',currentHullHp:100,ship:{gridCells:[42],sicInventory:[{id:'lock',type:'lock-on-1'}],placements:[{sicId:'lock',cell:42}]}},unit={id:'attacker-unit',location:{starshipId:'attacker'}};
 f.room.starships.push(source);locks.state(source).targets=[{targetId:f.ship.id,systemId:'lock',sicId:'gun'}];
 unit.delayedAction={id:'big-hit',weaponDamage:{shipId:source.id,targetId:f.ship.id,targetSicId:'gun',count:2,dieSides:12}};
 assert.equal(weapons.resolveDamage(f.room,unit,[7,7]).impairments,1);
 // Without the two fortifications, the user's threshold-6 / damage-14 example causes two points.
 s.placements=s.placements.filter(p=>!['fort1','fort2'].includes(p.sicId));
 const unfortified=s.sicInventory.find(i=>i.id==='gun');unfortified.impairmentPoints=0;unfortified.impaired=false;delete unfortified.status;locks.state(source).targets=[{targetId:f.ship.id,systemId:'lock',sicId:'gun'}];
 unit.delayedAction={id:'unfortified-hit',weaponDamage:{shipId:source.id,targetId:f.ship.id,targetSicId:'gun',count:2,dieSides:12}};
 assert.equal(weapons.resolveDamage(f.room,unit,[7,7]).impairments,2);
 assert.equal(s.sicInventory.find(i=>i.id==='gun').impairmentPoints,2);
 assert.equal(maps.sicPrice({type:'vulnerability-fortification',purchasePrice:2000}),2000);
});
test('engine damper attaches without a floorplan and reduces only its host clearance',()=>{
 const f=fixture(),s=f.ship.ship,engine=s.sicInventory.find(i=>i.id==='engine');
 const before=maps.engineClearance(s,engine);
 s.sicInventory.push({id:'backup',type:'backup-generator'});s.placements.push({sicId:'backup',cell:189});
 assert.match(maps.exteriorError(s),/Engines require 4/);
 s.sicInventory.push({id:'damper',type:'power-core-damper',attachTo:engine.id});s.placements.push({sicId:'damper',cell:182});
 assert.equal(maps.engineClearance(s,engine),before-1);assert.equal(maps.exteriorError(s),'');assert.equal(maps.placementSquares(s,s.sicInventory.at(-1),s.placements.at(-1)).length,0);
 s.sicInventory.at(-1).disabled=true;assert.equal(maps.engineClearance(s,engine),before);
});
test('Scramble Box protects adjacent components only and stops working when impaired',()=>{
 const s={gridCells:[41,42,43,44],sicInventory:[{id:'a',type:'scramble-box'},{id:'b',type:'sensors-1'},{id:'c',type:'lock-on-1'}],placements:[{sicId:'a',cell:41},{sicId:'b',cell:42},{sicId:'c',cell:44}]};
 assert.equal(maps.scramblePenalty(s,'b'),1);assert.equal(maps.scramblePenalty(s,'c'),0);
 s.sicInventory[0].impaired=true;assert.equal(maps.scramblePenalty(s,'b'),0);
 s.sicInventory.push({id:'d',type:'scramble-box'});s.placements.push({sicId:'d',cell:61});assert.match(maps.exteriorError(s),/cannot be adjacent/);
});
test('Gym is 3x3 and records exercise without inventing a skill award',()=>{
 const f=fixture(),item=f.ship.ship.sicInventory.find(i=>i.id==='vr');item.type='gym';f.seat('vr');
 const before=JSON.stringify(f.character.character.skills);
 const result=rooms.command(f.room,f.unit,{starshipId:f.ship.id,sicId:'vr',kind:'exercise',text:'Endurance workout',requestId:'gym-test-001'},{campaign:f.campaign,outsideCombat:true});
 assert.match(result.text,/Endurance workout/i);assert.equal(JSON.stringify(f.character.character.skills),before);
 assert.equal(maps.definition('gym').width,3);assert.equal(maps.definition('gym').height,3);
});
test('Science Lab uses ship storage and grants room-wide research bonuses',()=>{
 const f=fixture(),s=f.ship.ship;s.sicInventory.find(i=>i.id==='vr').type='science-lab';f.seat('vr');s.minerals.Iron=6000;
 const info=rooms.inspect(f.room,f.campaign,f.unit,'vr',false);assert.equal(info.shipMinerals.Iron,6000);assert.equal(maps.definition('science-lab').width,2);assert.equal(maps.definition('science-lab').height,3);assert.equal(maps.definition('science-lab').energyCost,1);
 assert.equal(maps.equipmentBonus(f.ship,{...f.unit.location,stationed:false},'Research').bonus,4);assert.equal(maps.equipmentBonus(f.ship,{square:22},'Research').bonus,0);
 s.sicInventory.find(i=>i.id==='vr').impaired=true;assert.equal(maps.equipmentBonus(f.ship,f.unit.location,'Science').bonus,0);
});
test('Holographic Projector adds Navigate bonus aboard the ship without changing unrelated skills',()=>{
 const f=fixture(),s=f.ship.ship;s.sicInventory.push({id:'holo',type:'holographic-projector',attachTo:'bridge'});s.placements.push({sicId:'holo',cell:22});
 assert.equal(maps.equipmentBonus(f.ship,f.unit.location,'Navigate').bonus,2);
 assert.equal(maps.equipmentBonus(f.ship,f.unit.location,'Piloting').bonus,0);
 assert.equal(maps.equipmentBonus(f.ship,null,'Navigate').bonus,0);
});


test('legacy Power Engine and nutrition thresholds match their cards and allow fortification',()=>{
 const fs=require('node:fs'),html=fs.readFileSync(require.resolve('../starship.html'),'utf8');
 for(const type of [...Array.from({length:6},(_,n)=>`en-engine-${n+1}`),'nutritional-supplement']){
  const card=html.split(`data-sic-card="${type}"`)[1].split('</article>')[0];
  const printed=Number(card.match(/<small>Damage Threshold<\/small>(\d+)/)[1]);
  const item={id:'host',type},fort={id:'fort',type:'vulnerability-fortification',attachTo:'host'};
  const ship={sicInventory:[item,fort],placements:[{sicId:'host',cell:42},{sicId:'fort',cell:42}]};
  assert.equal(maps.definition(type).threshold,printed,type);
  assert.equal(maps.addonHost(ship,fort).item,item,type);
  assert.equal(maps.effectiveThreshold(ship,item),printed+1,type);
 }
});

test('component damage uses the Power Engine threshold rather than a missing-data fallback',()=>{
 const f=fixture(),s=f.ship.ship;
 const source={id:'attacker',currentHullHp:100,ship:{gridCells:[42],sicInventory:[{id:'lock',type:'lock-on-1'}],placements:[{sicId:'lock',cell:42}]}},unit={id:'attacker-unit',location:{starshipId:'attacker'}};
 f.room.starships.push(source);
 const hit=(id)=>{
  locks.state(source).targets=[{targetId:f.ship.id,systemId:'lock',sicId:'engine'}];
  unit.delayedAction={id,weaponDamage:{shipId:source.id,targetId:f.ship.id,targetSicId:'engine',count:3,dieSides:12}};
  return weapons.resolveDamage(f.room,unit,[11,11,11]);
 };
 assert.equal(hit('base-engine-hit').impairments,1);
 const engine=s.sicInventory.find(i=>i.id==='engine');engine.impairmentPoints=0;engine.impaired=false;delete engine.status;
 s.sicInventory.push({id:'engine-fort',type:'vulnerability-fortification',attachTo:'engine'});s.placements.push({sicId:'engine-fort',cell:182});
 assert.equal(hit('fortified-engine-hit').impairments,0);
});
