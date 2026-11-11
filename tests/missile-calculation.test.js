const test=require('node:test'),assert=require('node:assert/strict');
const missiles=require('../ship-missiles'),targets=require('../ship-targets'),weapons=require('../ship-weapons'),sensors=require('../ship-sensors'),locks=require('../ship-locks'),maps=require('../ship-map-core'),power=require('../ship-power'),shields=require('../ship-shields');
function fixture(){
  const make=id=>({id,title:id,maximumHullHp:200,currentHullHp:200,ship:{gridCells:[82,83,84,102,103,104,122,123,124],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'},{id:'en',type:'en-au-engine-1'},{id:'lock',type:'lock-on-1'},{id:'gun',type:'rapid-laser-1'},{id:'launcher',type:'missile-launcher-1'},{id:'au',type:'au-engine-1'}],placements:[{sicId:'cp',cell:82},{sicId:'sn',cell:83},{sicId:'en',cell:124},{sicId:'lock',cell:84},{sicId:'gun',cell:62},{sicId:'launcher',cell:102,exteriorCell:100},{sicId:'au',cell:104}],missileAmmo:{launcher:{'missile-1':3,'spread-missiles-1':1,'missile-flares':1}}}});
  const a=make('a'),b=make('b'),unit={id:'u',characterId:'pc',team:'pc',currentHp:40,weaponSystemsSkill:6,dexterityDice:[12,12,12],atb:100,location:{starshipId:'a',sicId:'cp',square:82,mesh:0,stationed:true}};
  const room={starships:[a,b],units:[unit],threshold:100,activeId:'u',shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0}],log:[],showcase:true};a.sensorScenarioMasking=b.sensorScenarioMasking=10;power.refresh(room,{reset:true});sensors.refresh(room);locks.state(a).targets=[{targetId:'b',systemId:'lock',remaining:12}];return {room,a,b,unit};
}
const order={sicId:'launcher',targetId:'b',ammunition:'missile-1',requestId:'missile-launch-test'};
function launch(f,ammunition='missile-1'){const r=weapons.queue(f.room,f.unit,{...order,ammunition});assert.equal(r.ok,true,r.error);missiles.resolveInput(f.room,f.unit);return targets.flights(f.room)[0];}
function tick(room,seconds){let left=seconds;while(left>1e-7&&!missiles.pending(room)){const step=Math.min(left,Math.max(.000001,missiles.nextEvent(room)));missiles.advance(room,step);left-=step;}}

test('impact provenance captures actual dice and multiplier without changing damage or flight exports',()=>{
 for(const torpedo of [false,true]){
 const f=fixture(),m={id:'proof',sourceId:'a',targetId:'b',phase:'impact',name:torpedo?'Phazon Torpedo':'Missile 1',dice:2,dieSides:torpedo?10:8,torpedo,damageMultiplier:2,launchSource:{name:'Launcher',impaired:false}};missiles.state(f.a).flights.push(m);
 const r=missiles.resolveDamage(f.room,m.id,5,null,{values:[2,3],sides:[m.dieSides,m.dieSides]});assert.equal(r.ok,true);assert.deepEqual(r.calculation.values,[2,3]);assert.equal(r.calculation.multiplier,torpedo?2:5);assert.equal(f.b.currentHullHp,200-5*r.calculation.multiplier);assert.match(r.calculation.summary[1],/no accuracy roll/);assert.equal(m.calculation,undefined);assert.equal(missiles.resolveDamage(f.room,m.id,5).duplicate,true);
 }
});
test('manual and older impact details are explicitly unavailable; malformed evidence cannot mutate damage',()=>{
 const f=fixture(),m={id:'manual',sourceId:'a',targetId:'b',phase:'impact',name:'Old missile',dice:2};missiles.state(f.a).flights.push(m);
 for(const values of [[1],[-1,6],[2,2],'bad']){assert.equal(missiles.resolveDamage(f.room,m.id,5,null,{values}).ok,false);assert.equal(m.phase,'impact');assert.equal(f.b.currentHullHp,200);}
 const r=missiles.resolveDamage(f.room,m.id,5);assert.match(r.calculation.summary[0],/older flight/);assert.match(r.calculation.summary[0],/dice unavailable/);assert.deepEqual(r.calculation.values,[]);
});

test('launch snapshots the actual named launcher and automatic submission retains its generated dice',async()=>{
 const f=fixture(),m=launch(f);assert.equal(m.launchSource.name,maps.definition('missile-launcher-1').name);assert.equal(m.launchSource.impaired,false);
 f.room.units=[];f.room.hasEngagedClock=true;m.automated=true;m.phase='impact';let captured;
 const helpers={act:async body=>{captured=body;return missiles.resolveDamage(f.room,m.id,body.score,null,{values:body.diceResults,sides:m.automationPresentation.sides});},publish(){},off(){}};
 const runner=require('../automation-runner');await runner.step(f.room,.5,helpers);const generated=[...m.automationPresentation.values];m.automationPresentation.animationComplete=true;for(let i=0;i<8;i++)await runner.step(f.room,.5,helpers);
 assert.deepEqual(captured.diceResults,generated);assert.equal(captured.score,generated.reduce((a,b)=>a+b,0));assert.equal(m.phase,'exploded');
});
