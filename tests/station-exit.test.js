const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../combat-engine'),stations=require('../station-access');
function fixture(hostile=false){
 const ship={id:'ship',controlType:hostile?'gm':'pc',crewCharacterIds:hostile?[]:['pc'],ship:{gridCells:[42],placements:[{sicId:'helm',cell:42}],sicInventory:[{id:'helm',type:'cockpit-1'}]}};
 const unit={id:'u',characterId:'pc',characterName:'Operator',team:'pc',currentHp:20,atb:100,location:{starshipId:'ship',square:42,mesh:0,sicId:'helm',stationed:true,stationSlot:0}};
 engine.migrateUnitCombat(unit);
 const room={starships:[ship],units:[unit],threshold:100,activeId:unit.id,pausedForTurn:true,log:[]};
 let advances=0;
 const helpers={clearActiveCommand:r=>{r.activeAction=null;},pushLog:(r,s)=>r.log.push(s),moveToNextTurnOrClock:()=>advances++};
 return {ship,unit,room,helpers,advances:()=>advances};
}
test('friendly and hostile physical operators can leave a working station exactly once',()=>{
 for(const hostile of [false,true]){
  const f=fixture(hostile),before=structuredClone(f.unit.location);
  assert.ok(stations.consoles(f.room,f.unit).length);
  assert.equal(engine.resolvePlayerCombatAction(f.room,f.unit,{kind:'getUp'},f.helpers).ok,true);
  assert.deepEqual(f.unit.location,{...before,stationed:false,stationSlot:null});
  assert.equal(f.unit.atb,0);assert.equal(f.room.activeId,null);assert.equal(f.advances(),1);
  assert.equal(stations.consoles(f.room,f.unit).length,0);assert.equal(f.unit.team,'pc');
  assert.deepEqual(f.ship.crewCharacterIds,hostile?[]:['pc']);
  assert.equal(engine.resolvePlayerCombatAction(f.room,f.unit,{kind:'getUp'},f.helpers).ok,false);
  assert.equal(f.advances(),1);
 }
});
test('leaving a station still requires the earned turn and no pending delay',()=>{
 for(const change of [f=>f.room.activeId=null,f=>f.unit.delayedAction={id:'pending'},f=>f.unit.delayTimer=1,f=>f.unit.shieldRestabilizing=true]){
  const f=fixture();change(f);const before=structuredClone(f.unit);
  assert.equal(engine.resolvePlayerCombatAction(f.room,f.unit,{kind:'getUp'},f.helpers).ok,false);
  assert.deepEqual(f.unit,before);assert.equal(f.advances(),0);
 }
});
test('station exit exception does not enable ordinary combat actions while stationed',()=>{
 for(const kind of ['fire','melee','defense','wait3']){
  const f=fixture(true),before=structuredClone(f.unit);
  assert.match(engine.resolvePlayerCombatAction(f.room,f.unit,{kind},f.helpers).error,/Leave the station/);
  assert.deepEqual(f.unit,before);assert.equal(f.advances(),0);
 }
});
