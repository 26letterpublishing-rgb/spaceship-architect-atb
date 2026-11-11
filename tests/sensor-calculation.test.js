const test=require('node:test'),assert=require('node:assert/strict');
const sensors=require('../ship-sensors'),maps=require('../ship-map-core'),stations=require('../station-access');
function fixture(tier=3){
  const ship=id=>({id,title:`Secret ${id}`,currentHullHp:33,maximumHullHp:40,currentShieldHp:5,maximumShieldHp:10,
    ship:{gridCells:[42,43,44,62,63,64],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43}],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:`sensors-${tier}`}],doorStates:{},affiliation:'Hidden Faction'}});
  const a=ship('a'),b=ship('b');a.sensorScenarioMasking=18;b.sensorScenarioMasking=18;
  const unit={id:'u',characterId:'c',team:'pc',speed:5,atb:100,sensorSkill:0,location:{starshipId:'a',sicId:'cp',square:42,mesh:0,stationed:true}};
  const room={showcase:true,activeId:'u',starships:[a,b],units:[unit,{id:'enemy',characterName:'Secret Crew',location:{starshipId:'b'}}],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:10,r:0}],log:[],threshold:100};
  return {room,a,b,unit};
}

test('source snapshot preserves consumed teamwork, skill, retry and original ATB factors',()=>{
 const {room,a,unit}=fixture();unit.sensorSkill=2;room.units.push({id:'helper'});a.commandSystems={preparations:[{kind:'team',unitId:'helper',skill:5,action:'hex',remaining:20},{kind:'calculation',action:'hex',remaining:20}]};
 assert.equal(sensors.queue(room,unit,{sicId:'sn',kind:'hex',hex:{q:10,r:0},requestId:'provenance-hex'}).ok,true);
 const pending=unit.delayedAction,base=sensors.installed(a).dice;
 const roll=()=>3;roll.submittedScore=23;sensors.resolveInput(room,unit,roll);
 assert.equal(a.commandSystems.preparations.length,0);assert.deepEqual(pending.calculation.sides,[...base,...base]);assert.equal(pending.calculation.rating,5);assert.equal(pending.calculation.cooperationBonus,4);
 assert.match(pending.calculation.lines.join(' '),/base 8/);assert.match(pending.calculation.lines.join(' '),/Accepted submitted subtotal: 23/);
 assert.deepEqual(JSON.parse(JSON.stringify(pending.calculation)),pending.calculation);
});
test('GM facts remain separate, public projection is nonmutating and old records stay compatible',()=>{
 const {room,a,b,unit}=fixture();sensors.knowledge(a).contacts[b.id]={level:'detected'};a.sensorState.failures[b.id]=2;
 const pending={sensorOrder:{shipId:a.id,targetId:b.id,kind:'analysis'},settings:sensors.inputSettings(a)};
 const c=sensors.calculationSources(room,unit,pending);assert.equal(c.retry,2);assert.ok(c.gmLines.join(' ').includes(b.title));
 assert.ok(!JSON.stringify(sensors.publicCalculation(c)).includes(b.title));assert.ok(c.gmLines.length);assert.equal(sensors.publicCalculation(undefined),undefined);
});
test('automatic paths do not invent dice; AI override and source independence are retained',()=>{
 const {room,a,b,unit}=fixture();b.sensorScenarioMasking=1;unit.shipAi=true;
 sensors.queue(room,unit,{sicId:'sn',kind:'area',requestId:'automatic-evidence'});const pending=unit.delayedAction;
 sensors.resolveInput(room,unit,()=>{throw Error('no dice expected');});assert.deepEqual(pending.calculation.values,[]);assert.deepEqual(pending.calculation.sides,[6,6,6,6]);assert.match(pending.calculation.lines.at(-1),/No dice consumed/);
});

test('compact summaries retain named contributions without internal formula prose',()=>{const {room,a,unit}=fixture();const c=sensors.calculationSources(room,unit,{sensorOrder:{shipId:a.id,kind:'area'},settings:sensors.inputSettings(a)});assert.equal(c.summary.length,2);assert.match(c.summary[0],/Sensors 3: 3D6; Sensor Systems \+0/);assert.match(c.summary[1],/Sensors 3 \+5; 13\/s/);assert.ok(!c.summary.join(' ').includes('ceil('));assert.equal(sensors.publicCalculation({...c,gmSummary:'secret'}).gmSummary,undefined);});
