const test=require('node:test'),assert=require('node:assert/strict');
const locks=require('../ship-locks'),maps=require('../ship-map-core'),power=require('../ship-power'),sensors=require('../ship-sensors'),weapons=require('../ship-weapons');
function fixture(){
  const make=id=>({id,title:id,currentHullHp:40,maximumHullHp:40,currentShieldHp:0,ship:{gridCells:[42,43,44,45,62,63,64,65],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-1'},{id:'au',type:'au-engine-1'},{id:'au2',type:'au-engine-1'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'rapid-laser-1'},{id:'thr',type:'exhaust-thruster-1'}],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43},{sicId:'en',cell:64},{sicId:'au',cell:62},{sicId:'au2',cell:63},{sicId:'lock',cell:44},{sicId:'gun',cell:22},{sicId:'thr',cell:25}]}});
  const a=make('a'),b=make('b'),c=make('c'),unit={id:'u',team:'pc',weaponSystemsSkill:2.5,sensorSkill:5,pilotSkill:3,atb:100,location:{starshipId:'a',sicId:'cp',square:42,mesh:0,stationed:true}};
  const room={starships:[a,b,c],units:[unit],activeId:'u',threshold:100,showcase:true,shipPositions:[{id:'a',q:0,r:0},{id:'b',q:1,r:0},{id:'c',q:2,r:0}],log:[]};
  room.starships.forEach(s=>s.sensorScenarioMasking=10);power.refresh(room,{reset:true});sensors.refresh(room);return {room,a,b,c,unit};
}
let receipt=0;const queue=(room,u,targetId='b',kind='lock',extra={})=>locks.queue(room,u,{targetId,kind,requestId:'lock-test-'+(++receipt),...extra});
function resolve(room,u,score){const roll=()=>{throw Error('No automatic dice');};roll.submittedScore=score;return locks.resolve(room,u,roll);}
test('Lock-On 1 uses source dimensions, cost, threshold and no physical station',()=>{const d=maps.definition('lock-on-1');assert.equal(d.price,560);assert.equal(d.threshold,3);assert.equal(d.energyCost,1);assert.deepEqual(d.stations,[]);});
test('failed locks add shared retry, equality succeeds and survives serialization',()=>{const {room,a,unit}=fixture();assert.ok(queue(room,unit).ok);assert.deepEqual(unit.delayedAction.rollSpec.sides,[4,4]);resolve(room,unit,9);assert.equal(a.lockState.failures.b,1);queue(room,unit);assert.equal(unit.delayedAction.rollSpec.bonus,3.5);assert.ok(resolve(room,unit,10).success);const saved=JSON.parse(JSON.stringify(room));assert.ok(locks.locked(saved,saved.starships[0],'b'));});
test('second target pays 4 AU per 12 combat seconds and drops only extra target when empty',()=>{const {room,a,unit}=fixture();queue(room,unit);resolve(room,unit,10);const before=a.auState.current;assert.ok(queue(room,unit,'c').ok);assert.equal(a.auState.current,before-4);resolve(room,unit,10);a.auState.current=0;locks.refresh(room,11);assert.equal(a.lockState.targets.length,2);locks.refresh(room,1);assert.deepEqual(a.lockState.targets.map(t=>t.targetId),['b']);});
test('power loss, new impairment and sensor range break locks and reset retry',()=>{for(const kind of ['power','impairment','range']){const {room,a,unit}=fixture();queue(room,unit);resolve(room,unit,10);const item=a.ship.sicInventory.find(i=>i.id==='lock');if(kind==='power')item.status='powered-down';if(kind==='impairment')item.impairmentPoints=1;if(kind==='range')room.shipPositions[1].q=100;locks.refresh(room);assert.equal(a.lockState.targets.length,0,kind);if(kind==='impairment'){queue(room,unit);assert.deepEqual(unit.delayedAction.rollSpec.sides,[2,2]);}}});
test('SIC lock requires analyzed installed component, ship lock and shields down',()=>{const {room,a,b,unit}=fixture();assert.equal(queue(room,unit,'b','sic',{targetSicId:'lock'}).ok,false);queue(room,unit);resolve(room,unit,10);a.sensorState.reports.unshift({analysis:true,targetId:'b',layout:JSON.parse(JSON.stringify(b.ship))});assert.ok(queue(room,unit,'b','sic',{targetSicId:'lock'}).ok);resolve(room,unit,10);assert.equal(a.lockState.targets[0].sicId,'lock');b.currentShieldHp=1;locks.refresh(room);assert.equal(a.lockState.targets[0].sicId,null);assert.equal(queue(room,unit,'b','sic',{targetSicId:'lock'}).ok,false);});
test('locked laser skips accuracy but still requests 4D4; SIC damage gives threshold impairments',()=>{const {room,a,b,unit}=fixture();queue(room,unit);resolve(room,unit,10);a.lockState.targets[0].sicId='lock';assert.ok(weapons.queue(room,unit,{sicId:'gun',targetId:'b',requestId:'locked-laser'}).ok);assert.equal(unit.delayedAction.rollConfirmed,true);weapons.resolveInput(room,unit,()=>{throw Error('Accuracy auto-roll');});assert.equal(unit.delayedAction.weaponDamage.count,4);assert.equal(b.currentHullHp,40);weapons.resolveDamage(room,unit,[3,3,3,3]);assert.equal(b.currentHullHp,28);assert.equal(b.ship.sicInventory.find(i=>i.id==='lock').status,'destroyed');assert.equal(room.units.length,1);});
test('Break Lock-On respects zero Masking and normal 13 difficulty',()=>{const {room,a,b,unit}=fixture();locks.state(b).targets.push({targetId:'a',remaining:12});a.sensorScenarioMasking=0;assert.match(queue(room,unit,'b','break').error,/zero/);a.sensorScenarioMasking=10;assert.ok(queue(room,unit,'b','break').ok);assert.equal(unit.delayedAction.rollSpec.difficulty,13);resolve(room,unit,13);assert.equal(b.lockState.targets.length,0);});
test('release is free, idempotent and never interrupts pending input',()=>{const {room,a,unit}=fixture();queue(room,unit);resolve(room,unit,10);room.activeId=null;assert.equal(queue(room,unit,'b','release').free,true);assert.equal(a.lockState.targets.length,0);unit.delayedAction={id:'other'};assert.equal(queue(room,unit,'b','release').ok,false);});

test('overlapping acquisition cannot skip second-target AU payment',()=>{
  const {room,a,unit}=fixture();queue(room,unit);const pending=unit.delayedAction;unit.delayedAction=null;
  queue(room,unit,'c');resolve(room,unit,10);const before=a.auState.current;unit.delayedAction=pending;
  resolve(room,unit,10);assert.equal(a.lockState.targets.length,2);assert.equal(a.auState.current,before-4);
});

test('breaking an incoming lock does not require owning a Lock-On SIC',()=>{
  const {room,a,b,unit}=fixture();a.ship.sicInventory=a.ship.sicInventory.filter(i=>i.id!=='lock');
  locks.state(b).targets.push({targetId:'a',remaining:12});assert.ok(queue(room,unit,'b','break').ok);resolve(room,unit,13);assert.equal(b.lockState.targets.length,0);
});

test('all targeting grades use printed dice, impairment dice, break difficulty and Quality',()=>{
  const normal=[[4,4],[4,4,4],[6,6],[6,6,6],[8,8],[8,8,8],[10,10],[10,10,10],[12,12],[12,12,12,12]];
  const impaired=[[2,2],[2,2,2],[4,4],[4,4,4],[6,6],[6,6,6],[8,8],[8,8,8],[10,10],[12,12]];
  for(let tier=1;tier<=10;tier++){
    const {room,a,unit}=fixture(),item=a.ship.sicInventory.find(i=>i.id==='lock');item.type=`lock-on-${tier}`;
    assert.ok(queue(room,unit).ok);assert.deepEqual(unit.delayedAction.rollSpec.sides,normal[tier-1]);assert.equal(unit.delayedAction.settings.factors.Quality,Math.min(4,tier));
    unit.delayedAction=null;item.impaired=true;assert.ok(queue(room,unit).ok);assert.deepEqual(unit.delayedAction.rollSpec.sides,impaired[tier-1]);
    assert.equal(maps.definition(item.type).breakDifficulty,12+tier);
  }
});

test('tiered upkeep and unlimited locks retain source hardware across save and impairment',()=>{
  for(let tier=1;tier<=10;tier++){
    const {room,a,unit}=fixture();a.ship.sicInventory.find(i=>i.id==='lock').type=`lock-on-${tier}`;
    queue(room,unit);resolve(room,unit,10);const before=a.auState.current,cost=maps.definition(`lock-on-${tier}`).extraTargetAu;
    assert.ok(queue(room,unit,'c').ok);assert.equal(a.auState.current,before-cost);resolve(room,unit,10);
    a.auState.current=0;locks.refresh(room,12);assert.equal(a.lockState.targets.length,tier>=9?2:1);
    if(tier>=9){const saved=JSON.parse(JSON.stringify(room));locks.refresh(saved,3600);assert.equal(saved.starships[0].lockState.targets.length,2);}
  }
});

test('separate targeting hardware retains independent capacity and impairment state',()=>{
  const {room,a,unit}=fixture();a.ship.sicInventory.push({id:'lock2',type:'lock-on-2'});a.ship.placements.push({sicId:'lock2',cell:45});
  assert.ok(queue(room,unit,'b','lock',{sicId:'lock'}).ok);resolve(room,unit,10);const before=a.auState.current;
  assert.ok(queue(room,unit,'c','lock',{sicId:'lock2'}).ok);resolve(room,unit,10);assert.equal(a.auState.current,before);
  a.ship.sicInventory.find(i=>i.id==='lock').impairmentPoints=1;locks.refresh(room);assert.deepEqual(a.lockState.targets.map(l=>l.targetId),['c']);
});

test('higher lasers explicitly request their actual damage dice and validate manual totals',()=>{
  for(let tier=1;tier<=5;tier++){
    const {room,a,b,unit}=fixture();a.ship.sicInventory.find(i=>i.id==='gun').type=`rapid-laser-${tier}`;if(tier>=3)a.ship.placements.find(p=>p.sicId==='gun').cell=2;
    queue(room,unit);resolve(room,unit,10);assert.ok(weapons.queue(room,unit,{sicId:'gun',targetId:'b',requestId:`tier-fire-${tier}`}).ok);
    assert.equal(unit.delayedAction.settings.factors.Quality,Math.min(4,tier));weapons.resolveInput(room,unit,()=>{throw Error('Automatic roll');});
    const sides=2+tier*2;assert.deepEqual(unit.delayedAction.rollSpec.sides,Array(4).fill(sides));assert.equal(b.currentHullHp,40);
    assert.throws(()=>weapons.resolveDamage(room,unit,[],4*sides+1));weapons.resolveDamage(room,unit,[],4*sides);assert.equal(b.currentHullHp,Math.max(0,40-4*sides));
  }
});

test('rectangular lasers keep one complete transparent assembly on every mount',()=>{
  for(let tier=3;tier<=5;tier++)for(const rotation of [0,90]){
    const item={id:'laser',type:`rapid-laser-${tier}`,rotation},d=maps.componentDefinition(item),origin=126;
    for(const [mount,angle] of [[origin-20,0],[origin+d.width,90],[origin+d.height*20,180],[origin-1,270]]){
      const ship={gridCells:[mount],sicInventory:[item],placements:[{sicId:item.id,cell:origin}]},layout=maps.buildLayout(ship);
      assert.equal(maps.exteriorError(ship),'');assert.equal(layout.footprint.size,2);
      assert.equal(maps.exteriorFacing(layout,origin),angle);
      const markup=maps.surfaceMarkup(layout,origin);
      assert.ok(markup.includes(`width:${d.width*100}%;height:${d.height*100}%`));
      assert.ok(markup.includes(`rotate(${angle+180}deg)`));
      const next=origin+(d.width>1?1:20);assert.doesNotMatch(maps.surfaceMarkup(layout,next),/<img/);
    }
  }
});
