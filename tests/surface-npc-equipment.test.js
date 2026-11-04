const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../combat-engine'),arena=require('../combat-arena'),policy=require('../ship-automation');
function fixture(square=26){
 const actor={id:'npc',characterName:'Operator',team:'npc',currentHp:30,maximumHp:30,atb:100,automationMode:'npc',exertionCurrent:3,location:{arenaId:'surface',square:24,mesh:4},weapons:[{inventoryId:'fists',weaponId:'unarmed'},{inventoryId:'pistol',weaponId:'standard-sidearm'}],heldWeaponId:'fists'};
 const target={id:'pc',team:'pc',currentHp:30,maximumHp:30,location:{arenaId:'surface',square,mesh:4}};
 engine.migrateUnitCombat(actor);engine.migrateUnitCombat(target);
 const room={arena:arena.normalize({width:7,height:7,floors:Array.from({length:49},(_,i)=>i)}),units:[actor,target],starships:[],activeId:actor.id,threshold:100,log:[],pausedForTurn:true};
 return {actor,target,room};
}
test('Surface fallback draws a useful carried weapon as a separate paid turn',()=>{
 const {actor,target,room}=fixture(),before=structuredClone(actor.location),helpers={id:()=> 'equipment-test',clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
 const choice=policy.candidates(room,actor);assert.deepEqual(choice,[{action:'playerCombatAction',kind:'drawWeapon',inventoryId:'pistol'}]);
 assert.equal(engine.resolvePlayerCombatAction(room,actor,choice[0],helpers).ok,true);
 assert.equal(actor.heldWeaponId,'pistol');assert.equal(actor.atb,0);assert.equal(room.activeId,null);assert.equal(room.attackResolution,undefined);assert.equal(actor.exertionCurrent,3);assert.deepEqual(actor.location,before);
 const shot=policy.candidates(room,actor)[0];assert.equal(shot.kind,'fire');assert.equal(shot.targetId,target.id);
 assert.equal(engine.resolvePlayerCombatAction(room,actor,shot,helpers).ok,false,'cannot attack on the spent draw turn');
 room.activeId=actor.id;room.pausedForTurn=true;actor.atb=100;
 const result=engine.resolvePlayerCombatAction(room,actor,shot,helpers);assert.equal(result.ok,true);assert.equal(result.beginAttack.defenderId,target.id);assert.equal(result.beginAttack.distance,2);assert.equal(actor.exertionCurrent,3);
});
test('retains useful held melee and ranged weapons without repeated draws',()=>{
 const f=fixture(25);assert.equal(policy.candidates(f.room,f.actor)[0].kind,'melee');
 f.actor.heldWeaponId='pistol';assert.equal(policy.candidates(f.room,f.actor)[0].kind,'fire');
 f.actor.heldWeaponId=null;assert.equal(policy.candidates(f.room,f.actor)[0].kind,'drawWeapon');
});
test('no fallback through walls, closed doors, other maps or friendly/defeated targets',()=>{
 for(const mutate of [f=>{f.room.arena.walls=['24:25'];},f=>{f.room.arena.walls=['24:25'];f.room.arena.doors['24:25']={open:false};},f=>{f.target.location={starshipId:'other',square:26,mesh:4};},f=>{f.target.team='npc';},f=>{f.target.currentHp=0;},f=>{f.target.defeatedAt=1;}]){
  const f=fixture(25);mutate(f);assert.deepEqual(policy.candidates(f.room,f.actor),[]);
 }
});
test('unavailable ground weapons, unloaded launchers and ammo are not carried alternatives',()=>{
 const f=fixture();f.actor.weapons.find(w=>w.inventoryId==='pistol').groundLocation={arenaId:'surface',square:0,mesh:4};assert.deepEqual(policy.candidates(f.room,f.actor),[]);
 f.actor.weapons=[f.actor.weapons[0],{inventoryId:'launcher',weaponId:'bore-launcher'},{inventoryId:'ammo',weaponId:'skull-bore'}];engine.migrateUnitCombat(f.actor);assert.deepEqual(policy.candidates(f.room,f.actor),[]);
});
test('uses real range for alternatives and preserves explicit melee reach',()=>{
 const f=fixture();f.actor.weapons.find(w=>w.inventoryId==='pistol').range='1 Max';assert.deepEqual(policy.candidates(f.room,f.actor),[]);
 f.actor.weapons.push({inventoryId:'whip',weaponId:'angiluros-whip'});engine.migrateUnitCombat(f.actor);f.actor.weapons.find(w=>w.inventoryId==='pistol').range='1 Max';
 assert.equal(policy.candidates(f.room,f.actor)[0].inventoryId,'whip');
});
test('keeps a usable loaded launcher and can draw a carried loaded launcher separately',()=>{
 for(const held of ['launcher','fists']){
  const f=fixture();f.actor.weapons=[{inventoryId:'fists',weaponId:'unarmed'},{inventoryId:'launcher',weaponId:'bore-launcher'},{inventoryId:'round',weaponId:'skull-bore'}];engine.migrateUnitCombat(f.actor);
  f.actor.launcherAmmo={launcher:['round']};f.actor.heldWeaponId=held;
  const helpers={id:()=> 'launcher-test',clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
  const choice=policy.candidates(f.room,f.actor)[0];assert.ok(choice);
  if(held==='fists'){
   assert.equal(choice.kind,'drawWeapon');assert.equal(choice.inventoryId,'launcher');assert.equal(engine.resolvePlayerCombatAction(f.room,f.actor,choice,helpers).ok,true);
   assert.equal(f.actor.atb,0);assert.equal(f.room.activeId,null);assert.deepEqual(f.actor.launcherAmmo.launcher,['round']);
   f.room.activeId=f.actor.id;f.actor.atb=100;
  }else assert.equal(choice.kind,'fire');
  const shot=policy.candidates(f.room,f.actor)[0];assert.equal(shot.kind,'fire');
  const result=engine.resolvePlayerCombatAction(f.room,f.actor,shot,helpers);assert.equal(result.ok,true);assert.equal(result.beginAttack.weaponId,'skull-bore');assert.equal(result.beginAttack.ammoInventoryId,'round');assert.equal(result.beginAttack.distance,2);
  assert.equal(f.actor.exertionCurrent,3);
 }
});
test('legacy false and omitted allegiance flags never turn same-side NPCs into enemies',()=>{
 for(const held of ['fists','pistol'])for(const first of [false,undefined])for(const second of [false,undefined]){
  const f=fixture();f.actor.heldWeaponId=held;f.actor.allyNpc=first;f.target.team='npc';f.target.allyNpc=second;
  assert.deepEqual(policy.candidates(f.room,f.actor),[]);
  f.target.allyNpc=true;assert.equal(policy.candidates(f.room,f.actor)[0].kind,held==='pistol'?'fire':'drawWeapon');
 }
});
test('Surface policy never selects characters outside its floorplan, in either direction',()=>{
 for(const held of ['fists','pistol'])for(const swap of [false,true]){
  const f=fixture();f.actor.heldWeaponId=held;(swap?f.actor:f.target).location={environment:'exterior',square:26,mesh:4};
  assert.deepEqual(policy.candidates(f.room,f.actor),[]);
 }
 const f=fixture();f.target.timedAction={kind:'move',startLocation:f.target.location,routeSegment:[{environment:'exterior',square:26,mesh:4}],remaining:0,total:1};
 assert.deepEqual(policy.candidates(f.room,f.actor),[]);
});
