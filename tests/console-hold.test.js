const test=require('node:test');
const assert=require('node:assert/strict');
const hold=require('../console-hold');
const combat=require('../combat-engine');
function fixture(){
  const unit={id:'pilot',characterName:'Pilot',speed:4,atb:100,location:{stationed:true,starshipId:'s',sicId:'c',square:1,mesh:0}};
  const room={units:[unit],threshold:100,activeId:unit.id,pausedForTurn:true,commandTotal:30,commandDeadline:Date.now()+12000};
  const helpers={clearActiveCommand(r){r.commandDeadline=null;},pushLog(){},moveToNextTurnOrClock(r){r.running=!r.hardPaused;}};
  return {unit,room,helpers};
}
test('Hold freezes initiative at 99%, preserves command remainder and releases the room',()=>{
  const {unit,room,helpers}=fixture();
  assert.equal(combat.resolvePlayerCombatAction(room,unit,{kind:'holdConsole'},helpers).ok,true);
  assert.equal(unit.atb,99);assert.equal(combat.effectiveSpeed(unit),0);assert.equal(room.activeId,null);assert.equal(room.running,true);
  assert.ok(unit.consoleHold.commandRemaining>11&&unit.consoleHold.commandRemaining<=12);
  assert.equal(hold.resolve(room,unit,'holdConsole',helpers).ok,false);
  room.activeId='someone-else';room.hardPaused=true;room.running=false;
  assert.equal(combat.resolvePlayerCombatAction(room,unit,{kind:'resumeConsole'},helpers).ok,true);
  assert.equal(room.activeId,'someone-else');assert.equal(room.running,false);assert.equal(room.hardPaused,true);
  assert.equal(unit.atb,99);assert.equal(combat.effectiveSpeed(unit),4);assert.ok(unit.commandCarrySeconds<=12);
  assert.equal(hold.resolve(room,unit,'resumeConsole',helpers).ok,false);
});
test('Hold rejects unfinished actions, unstationed, defeated and out-of-turn actors',()=>{
  for(const change of [({unit})=>unit.location.stationed=false,({unit})=>unit.defeatedAt=1,({unit})=>unit.delayedAction={},({unit})=>unit.delayTimer={},({unit})=>unit.timedAction={},({room})=>room.activeId='other',({room})=>room.delayRequest={}]){
    const f=fixture();change(f);assert.equal(hold.resolve(f.room,f.unit,'holdConsole',f.helpers).ok,false);assert.equal(f.unit.atb,100);
  }
});
test('Hold obeys paused command remainder and survives serialization; forced departure releases it',()=>{
  const {unit,room,helpers}=fixture();room.hardPaused=true;room.commandHeldRemaining=7;
  hold.resolve(room,unit,'holdConsole',helpers);assert.equal(room.running,false);
  const restored=JSON.parse(JSON.stringify(unit));hold.reconcile(restored);assert.equal(restored.consoleHold.commandRemaining,7);
  restored.location.stationed=false;hold.reconcile(restored);assert.equal(restored.consoleHold,null);assert.equal(restored.commandCarrySeconds,7);
});
test('Expired command time is not replenished by Hold',()=>{
  const {unit,room,helpers}=fixture();room.commandExpired=true;
  hold.resolve(room,unit,'holdConsole',helpers);hold.resolve(room,unit,'resumeConsole',helpers);assert.equal(unit.commandCarrySeconds,0);
});
