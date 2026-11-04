const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../combat-arena'),E=require('../combat-engine'),R=require('../combat-rules'),AI=require('../ship-automation');
const helpers={id:()=> 'melee-test',clearActiveCommand(){},pushLog(){},moveToNextTurnOrClock(){}};
function fixture(square=25,weaponId='unarmed'){
 const unit=(id,sq,team)=>({id,team,currentHp:30,maximumHp:30,characterName:id,location:{arenaId:'surface',square:sq,mesh:4},weapons:[{inventoryId:id+'-weapon',weaponId}],heldWeaponId:id+'-weapon'});
 const a=unit('a',24,'npc'),b=unit('b',square,'pc');E.migrateUnitCombat(a);E.migrateUnitCombat(b);
 return {a,b,room:{arena:A.normalize({width:7,height:7,floors:Array.from({length:49},(_,i)=>i)}),units:[a,b],starships:[],vehicles:[],activeId:'a',threshold:100}};
}
for(const [name,squares,allowed] of [['cardinal',[17,25,31,23],true],['diagonal',[16,18,30,32],false],['same or distant',[24,26],false]]){
 test('default melee '+name,()=>{for(const square of squares){const {a,b,room}=fixture(square);const before=JSON.stringify(a);const result=E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers);assert.equal(result.ok,allowed,square);assert.equal(R.attackPlan(E.heldWeapon(a),{attackType:'melee',distance:A.distance(room,a,b)}).allowed,allowed);if(!allowed)assert.equal(JSON.stringify(a),before);}});
}
test('melee called shot and Murasama reject before drawing or changing charges',()=>{
 for(const kind of ['melee','calledShot']){const {a,b,room}=fixture(32,'murasama-blade');a.movementChargeUnits=3;a.drawnMurasama={};const before=JSON.stringify(a);assert.equal(E.resolvePlayerCombatAction(room,a,{kind,targetId:b.id,weaponOptions:{unsheathe:true}},helpers).ok,false);assert.equal(JSON.stringify(a),before);}
});
test('Whip retains printed two-unit reach and Euclidean geometry, never same-cell',()=>{
 for(const [square,allowed] of [[25,true],[32,true],[26,true],[33,false],[24,false]]){const {a,b,room}=fixture(square,'angiluros-whip');assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,allowed,String(square));}
});
test('walls, doors and different floorplans still block melee',()=>{
 const {a,b,room}=fixture();room.arena.walls=['24:25'];assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,false);
 room.arena.doors['24:25']={open:true,automatic:false};assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,true);
 room.arena.doors['24:25'].open=false;assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,false);
 b.location={starshipId:'elsewhere',square:0,mesh:4};assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,false);
});
test('ship microgrid has the same four cardinal neighbors',()=>{
 for(const mesh of [0,1,2,3,4,5,6,7,8]){const {a,b,room}=fixture();room.starships=[{id:'ship',ship:{zoneColumns:20,gridCells:[0],sicInventory:[],placements:[]}}];a.location={starshipId:'ship',square:0,mesh:4};b.location={starshipId:'ship',square:0,mesh};assert.equal(E.resolvePlayerCombatAction(room,a,{kind:'melee',targetId:b.id},helpers).ok,[1,3,5,7].includes(mesh),String(mesh));}
});
test('automation skips diagonal enemy for legal adjacent enemy, then safely has no attack',()=>{
 const {a,b,room}=fixture(32);const legal=structuredClone(b);legal.id='legal';legal.location.square=25;room.units.push(legal);
 assert.equal(AI.candidates(room,a)[0].targetId,'legal');room.units.pop();assert.deepEqual(AI.candidates(room,a),[]);
});
test('moving target reach follows its current route position',()=>{
 const {a,b,room}=fixture();b.timedAction={kind:'move',startLocation:b.location,routeSegment:[{arenaId:'surface',square:26,mesh:4}],total:1,remaining:0};assert.equal(R.meleeTargetAllowed(room,a,b,E.heldWeapon(a)),false);
});
