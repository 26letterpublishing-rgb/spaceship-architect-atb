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

const runner=require('../automation-runner');
function impact(torpedo,impaired,shielded){const f=fixture();f.b.currentShieldHp=0;if(torpedo){f.a.ship.sicInventory.find(i=>i.id==='launcher').type='phazon-torpedo-launcher';f.a.ship.sicInventory.find(i=>i.id==='en').type='en-au-engine-6';f.a.ship.minerals={Phazon:2};if(impaired)f.a.ship.sicInventory.find(i=>i.id==='launcher').impairmentPoints=1;power.refresh(f.room,{reset:true});}
 if(shielded){f.b.ship.sicInventory.push({id:'shield',type:'shield-1'});f.b.ship.placements.push({sicId:'shield',cell:123});shields.refresh(f.room);}
 const m=launch(f);tick(f.room,30);assert.equal(m.phase,'impact');f.room.hasEngagedClock=true;return {...f,m};}
for(const torpedo of [false,true])for(const impaired of torpedo?[false,true]:[false])for(const shielded of [false,true])for(const automatic of [false,true])test('impact profile '+JSON.stringify({torpedo,impaired,shielded,automatic}),async()=>{
 const f=impact(torpedo,impaired,shielded),{m}=f,die=torpedo&&!impaired?10:8,multiplier=torpedo?(impaired?1:2):shielded?1:5;let result,score;
 const hull=f.b.currentHullHp,shield=f.b.currentShieldHp;
 if(automatic){m.automated=true;const h={act:async body=>{score=body.score;result=missiles.resolveDamage(f.room,m.id,score,null,{values:body.diceResults,sides:m.automationPresentation.sides});return result;},publish(){},off(){throw Error('unexpected automation failure');}};
 await runner.step(f.room,.5,h);assert.deepEqual(m.automationPresentation.sides,Array(m.dice).fill(die));assert.equal(m.automationPresentation.displayScore,m.automationPresentation.score*multiplier);m.automationPresentation.animationComplete=true;for(let i=0;i<8;i++)await runner.step(f.room,.5,h);
 }else{const values=Array(m.dice).fill(die);score=values.reduce((a,b)=>a+b,0);result=missiles.resolveDamage(f.room,m.id,score,null,{values});}
 assert.equal(result.ok,true);assert.equal(result.calculation.multiplier,multiplier);assert.equal(result.calculation.total,score);assert.equal(f.b.currentHullHp,shielded?hull:hull-score*multiplier);assert.equal(f.b.currentShieldHp,shielded?Math.max(0,shield-Math.max(0,score*multiplier-maps.definition('shield-1').shieldReduction)):0);assert.equal(missiles.resolveDamage(f.room,m.id,score).duplicate,true);
});
test('restored already-generated torpedo dice and display are not rerolled or rewritten',async()=>{
 const f=impact(true,false,false),m=f.m;m.automated=true;m.automationPresentation=JSON.parse(JSON.stringify({id:m.id,sides:[8,8,8],values:[1,2,3],score:6,displayScore:30,damage:true,phase:'rolling',remaining:0,animationComplete:true}));
 const original=structuredClone(m.automationPresentation);let calls=0;const h={act:async b=>{calls++;assert.deepEqual(b.diceResults,original.values);return missiles.resolveDamage(f.room,m.id,b.score,null,{values:b.diceResults,sides:m.automationPresentation.sides});},publish(){},off(){throw Error('unexpected failure');}};
 for(let i=0;i<8;i++)await runner.step(f.room,.5,h);assert.equal(calls,1);assert.deepEqual(m.automationPresentation.values,original.values);assert.deepEqual(m.automationPresentation.sides,original.sides);assert.equal(m.automationPresentation.displayScore,original.displayScore);assert.equal(f.b.currentHullHp,188);
});
