const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const maps=require('../ship-map-core'),weapons=require('../ship-weapons'),power=require('../ship-power'),sensors=require('../ship-sensors'),shields=require('../ship-shields'),stations=require('../station-access');
function fixture(type){
  const make=id=>({id,title:id,currentHullHp:80,maximumHullHp:80,ship:{gridCells:Array.from({length:80},(_,n)=>82+Math.floor(n/10)*20+n%10),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-4'},{id:'lock',type:'lock-on-1'},{id:'gun',type}],placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:164},{sicId:'lock',cell:84},{sicId:'gun',cell:86-maps.definition(type).exteriorRows*20}]}});
  const a=make('a'),b=make('b'),unit={id:'u',team:'pc',weaponSystemsSkill:6,dexterityDice:[8,6],atb:100,location:{starshipId:'a',sicId:'cp',square:82,mesh:0,stationed:true}};
  const room={starships:[a,b],units:[unit],activeId:'u',threshold:100,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0}],log:[]};
  power.refresh(room,{reset:true});sensors.refresh(room);return {room,a,b,unit};
}
const order={sicId:'gun',targetId:'b',requestId:'new-family-fire'};
const resolve=(room,unit,score=100)=>{const roll=()=>{throw Error('No automatic dice');};roll.submittedScore=score;weapons.resolveInput(room,unit,roll);};
test('every new card has ratings, existing artwork and a separate two-square interior where required',()=>{
  for(const [family,max] of [['darkveil',10],['beam-laser',8],['ripple-cannon',8],['ion-pulse-cannon',5]])for(let tier=1;tier<=max;tier++){
    const d=maps.definition(`${family}-${tier}`);assert.ok(d.price>0&&d.energyCost>0&&d.threshold>0,d.name);assert.equal(d.tier,tier);
    assert.ok(fs.existsSync(path.join(__dirname,'..',d.image.split(/[?#]/)[0])),d.image);
    if(d.weapon){assert.ok(fs.existsSync(path.join(__dirname,'..',d.sprite.split('#')[0])));assert.equal(d.height-d.exteriorRows,2);assert.equal(d.stations.length,1);}
  }
});
test('split weapon footprints rotate on all four walls and never make barrels walkable',()=>{
  for(const rotation of [0,90,180,270]){
    const item={id:'gun',type:'beam-laser-3',rotation},d=maps.componentDefinition(item),origin=125,hull=[];
    for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++)if(!d.exteriorCells.some(c=>c.x===x&&c.y===y))hull.push(origin+y*20+x);
    const ship={gridCells:hull,sicInventory:[item],placements:[{sicId:item.id,cell:origin}]};
    assert.equal(maps.mixedPlacement(ship,item,origin),true,`rotation ${rotation}`);assert.equal(maps.exteriorError(ship),'');
    const layout=maps.buildLayout(ship),room=[...layout.footprint.values()].filter(c=>!c.exterior);
    assert.equal(room.length,2);assert.equal(room.filter(c=>c.offset===0).length,1);
    for(const c of layout.footprint.values())assert.equal(c.blocked,c.exterior);
    const s=d.stations[0],square=origin+s.y*20+s.x,record={id:'ship',ship};
    const u={location:{starshipId:'ship',sicId:'gun',square,mesh:s.mesh,stationed:true}};
    assert.equal(stations.access({starships:[record]},u,'gun').remote,false);
    ship.gridCells.push(origin+d.exteriorCells[0].y*20+d.exteriorCells[0].x);assert.equal(maps.mixedPlacement(ship,item,origin),false);
  }
});
test('every new SIC level has its own atlas view rather than a shared family graphic',()=>{
  for(const [family,max] of [['darkveil',10],['beam-laser',8],['ripple-cannon',8],['ion-pulse-cannon',5]]){
    const art=Array.from({length:max},(_,i)=>maps.definition(`${family}-${i+1}`).cardArt);assert.equal(new Set(art).size,max);
    for(const url of art){const [file,fragment]=url.split('#');assert.ok(fragment);assert.ok(fs.readFileSync(path.join(__dirname,'..',file),'utf8').includes(`id="${fragment}"`));}
  }
});
test('Darkveil impairment subtracts five per point; offline and duplicate installations handled',()=>{
  const ship={gridCells:[42,43,62,63],sicInventory:[{id:'dv',type:'darkveil-1'}],placements:[{sicId:'dv',cell:42}]},base=maps.propulsion(ship).hsm;
  assert.equal(maps.masking(ship),base+10);ship.sicInventory[0].impairmentPoints=3;assert.equal(maps.masking(ship),base-5);
  ship.sicInventory[0].status='powered-down';assert.equal(maps.masking(ship),base);
  ship.sicInventory.push({id:'dv2',type:'darkveil-2'});ship.placements.push({sicId:'dv2',cell:43});assert.match(maps.exteriorError(ship),/one installed Darkveil/);
});
test('Beam requires lock, AU boosts stack, and flat damage bonus is applied once after manual dice',()=>{
  const {room,a,b,unit}=fixture('beam-laser-4');assert.match(weapons.queue(room,unit,order).error,/lock/i);
  a.lockState.targets.push({targetId:'b',systemId:'lock'});const before=a.auState.current;
  assert.equal(weapons.queue(room,unit,{...order,boosts:2}).ok,true);assert.equal(a.auState.current,before-6);assert.equal(unit.delayedAction.rollConfirmed,true);
  resolve(room,unit);assert.equal(unit.delayedAction.weaponDamage.count,4);assert.equal(unit.delayedAction.rollSpec.bonus,1);assert.equal(b.currentHullHp,80);
  weapons.resolveDamage(room,unit,[2,2,2,2]);assert.equal(b.currentHullHp,71);
});
test('Beam impairment removes base dice and bonus but keeps AU-funded dice',()=>{
  const d=maps.definition('beam-laser-8');assert.deepEqual(weapons.profile(d,{impaired:true},1,{boosts:2}).count,2);assert.equal(weapons.profile(d,{impaired:true},1,{boosts:2}).bonus,0);
});
test('Ripple uses stepped positive range accuracy and loses damage dice at the same thresholds',()=>{
  const {room,a,unit}=fixture('ripple-cannon-4');room.shipPositions[1].q=5;
  const spec=weapons.rollSpec(room,unit,{shipId:'a',targetId:'b',sicId:'gun'});assert.equal(spec.bonus,6+maps.propulsion(a).hsm+2);
  assert.equal(weapons.profile(maps.definition('ripple-cannon-4'),{},5,{boosts:1}).count,3);
  assert.equal(weapons.profile(maps.definition('ripple-cannon-4'),{impaired:true},5,{boosts:1}).count,2);
  a.ship.sicInventory.find(i=>i.id==='gun').impaired=true;assert.match(weapons.queue(room,unit,{...order,boosts:1}).error,/AU option/);
});
test('Ion requires AU, manual damage bypasses shields and their reduction without draining them',()=>{
  const {room,a,b,unit}=fixture('ion-pulse-cannon-1');b.ship.sicInventory.push({id:'shield',type:'shield-1'});b.ship.placements.push({sicId:'shield',cell:85});shields.refresh(room);shields.entries(b)[0].state.hp=3;shields.refresh(room);
  const before=a.auState.current;assert.equal(weapons.queue(room,unit,order).ok,true);assert.equal(a.auState.current,before-4);resolve(room,unit);assert.equal(unit.delayedAction.rollSpec.damage,true);assert.equal(b.currentHullHp,80);
  weapons.resolveDamage(room,unit,[8]);assert.equal(b.currentHullHp,72);assert.equal(b.currentShieldHp,3);
});
test('new weapons retain GM roll ownership, repeat costs and reject invalid boost quantities',()=>{
  const {room,a,unit}=fixture('ripple-cannon-3');assert.equal(weapons.queue(room,unit,{...order,boosts:.5}).ok,false);
  assert.equal(weapons.queue(room,unit,order).ok,true);unit.delayedAction.rollController='gm';resolve(room,unit);assert.equal(unit.delayedAction.rollController,'gm');weapons.resolveDamage(room,unit,[1,1,1]);
  a.auState.current=a.auState.maximum;const before=a.auState.current;assert.equal(weapons.queue(room,unit,{...order,requestId:'second-new-family-fire'}).ok,true);assert.equal(a.auState.current,before-4);
});
