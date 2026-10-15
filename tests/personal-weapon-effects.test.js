'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const effects=require('../personal-weapon-effects'),arena=require('../combat-arena'),rules=require('../combat-rules'),catalog=require('../weapon-catalog');
const unit=(id,square)=>({id,currentHp:100,maximumHp:100,damageReduction:0,location:{arenaId:'surface',starshipId:'',square,mesh:4},items:[]});
function room(){return {arena:arena.normalize({width:40,height:10,floors:Array.from({length:400},(_,i)=>i)}),units:[]};}
test('fire queues a manual roll at eight active seconds and reignition does not stack',()=>{
 const u=unit('burn',2);effects.ignite(u,2);effects.advance(u,7.9);assert.equal(u.personalEffects,undefined);
 effects.ignite(u,1);assert.equal(u.burning.intensity,2);effects.advance(u,.1);assert.equal(u.personalEffects[0].formula,'2D10');assert.equal(u.burning.intensity,2);
 effects.extinguish(u,3);assert.equal(u.burning,null);
});
test('Space Suit absorbs twenty damage and overflow carries to actual HP',()=>{
 const u=unit('suit',0);u.items=[{id:'suit',catalogId:'space-suit',quantity:1}];
 assert.deepEqual(effects.damage(u,27,{element:'Physical'}),{incoming:27,reduction:0,applied:7,suitAbsorbed:20});
 assert.equal(effects.damage(u,3).applied,3);assert.equal(u.suitHp.suit,0);
});
test('Kevlar remains physical DR, does not deplete, and elemental attacks bypass it',()=>{
 const u=unit('vest',0);u.items=[{catalogId:'kevlar-vest',quantity:1}];
 for(let n=0;n<3;n++)assert.equal(effects.damage(u,30,{element:'Physical'}).applied,10);
 assert.equal(effects.damage(u,30,{element:'Electricity'}).applied,30);
});
test('Wet doubles electricity for the rest of the encounter, without duration decay',()=>{
 const u=unit('wet',0);effects.afterHit({units:[u]},unit('a',1),u,{weaponId:'spouter'},0);
 effects.advance(u,5000);assert.equal(u.statuses.wet,true);assert.equal(effects.damage(u,12,{element:'Electricity'}).applied,24);
});
test('delayed Dark Matter and poison retain six-second intervals',()=>{
 const u=unit('target',0),a=unit('attacker',1),r={units:[u,a]};
 effects.afterHit(r,a,u,{weaponId:'dark-matter-launcher'},23);effects.afterHit(r,a,u,{weaponId:'greentip-v-x-101'},8);
 effects.advance(u,5);assert.equal(u.personalEffects,undefined);effects.advance(u,1);
 assert.deepEqual(u.personalEffects.map(e=>e.formula),['4D8','2D8']);assert.equal(u.weaponTimers.length,1);
});
test('Force Bazooka extends ten units behind its victim and stops at solid cover',()=>{
 const r=room(),a=unit('a',41),b=unit('b',43),c=unit('c',49),far=unit('far',54);r.units=[a,b,c,far];
 assert.deepEqual(effects.lineBehind(r,a,b).map(u=>u.id),['c']);r.arena.walls=[arena.edgeKey(47,48)];
 assert.deepEqual(effects.lineBehind(r,a,b),[]);
});
test('blast cover reduces damage to zero and Mini Nuke range ends at thirty units',()=>{
 const r=room(),a=unit('near',41),b=unit('far',71);r.units=[a,b];
 assert.deepEqual(effects.blastTargets(r,a.location,30,10,3).map(e=>[e.unit.id,e.multiplier]),[['near',10]]);
 r.units.push(unit('covered',44));r.arena.walls=[arena.edgeKey(42,43)];
 assert.ok(!effects.blastTargets(r,a.location,30,10,3).some(e=>e.unit.id==='covered'));
});
test('knockback stops on an occupied space and reports collision',()=>{
 const r=room(),a=unit('a',41),b=unit('b',42),c=unit('blocker',44);r.units=[a,b,c];
 assert.equal(effects.knockback(r,a,b,4),true);assert.equal(b.location.square,43);
});
test('Aim adds at most four dice while preserving unarmed and range house rules',()=>{
 const w=catalog.find(w=>w.id==='standard-sidearm');
 const p=rules.attackPlan(w,{aimDice:[12,10,8,6,4]});assert.equal(rules.parseDiceFormula(p.damageFormula).dice.get(12),1);
 const u=rules.attackPlan(catalog[0],{attackType:'melee',strengthDice:[8,6]});assert.equal(u.damageFormula,'2D4 + 1D6 + 1D8');
 const ranged=rules.attackPlan(w,{distance:20});assert.ok(ranged.defenseRangeModifier>0);
});
const engine=require('../combat-engine');
function armed(weaponId){const r=room(),a=unit('a',41),b=unit('b',42);a.team='pc';b.team='npc';r.units=[a,b];r.starships=[];r.activeId='a';r.threshold=100;r.pausedForTurn=true;r.fog={enabled:false};Object.assign(a,{speed:5,atb:100});engine.syncUnitCombat(a,{weapons:[{inventoryId:'weapon',weaponId}],heldWeaponId:'weapon',strengthDice:[8,6],dexterityDice:[8,6],perceptionDice:[12,10,8,6],highestPerceptionDie:12,currentHp:100,maximumHp:100,moveSpeed:4});return {r,a,b,helpers:{id:()=>require('node:crypto').randomUUID(),pushLog:()=>{},clearActiveCommand:()=>{},moveToNextTurnOrClock:()=>{}}};}
test('repeated Aim uses successive Perception dice and stops at four',()=>{const {r,a,helpers}=armed('standard-sidearm');for(let n=0;n<6;n++){r.activeId=a.id;assert.equal(engine.resolvePlayerCombatAction(r,a,{kind:'aim'},helpers).ok,true);}assert.deepEqual(a.aim.dice,[12,10,8,6]);});
test('choice weapons produce supported pools and preserve configured recovery',()=>{
 const weapon=id=>catalog.find(w=>w.id===id);
 assert.equal(rules.attackPlan(weapon('gravity-gun'),{options:{rating:4}}).damageFormula,'4D12');
 const solar=rules.attackPlan(weapon('solar-powered-t44-cannon'),{options:{rating:2},charges:2});assert.equal(solar.damageFormula,'6D10');assert.equal(solar.recoverySeconds,12);
 assert.equal(rules.attackPlan(weapon('solar-powered-t44-cannon'),{options:{rating:0}}).allowed,false);
 const royal=rules.attackPlan(weapon('l-x-custom-royal'),{charges:3,options:{choices:['damage','penetrate','burst']}});assert.equal(royal.damageFormula,'3D8 + 3D12 + 3');assert.equal(royal.ignoreDamageReduction,true);assert.equal(royal.recoverySeconds,12);
 assert.throws(()=>rules.attackPlan(weapon('l-x-custom-royal'),{charges:2,options:{choices:['burst','burst']}}));
});
test('owned launcher ammo loads and Hull Bore opens a wall after eighteen drilling seconds',()=>{
 const {r,a,helpers}=armed('bore-launcher');a.weapons.push(...engine.normalizeWeaponRows([{inventoryId:'hull',weaponId:'hull-bore'}]));
 assert.equal(engine.resolvePlayerCombatAction(r,a,{kind:'drawWeapon',inventoryId:'hull'},helpers).ok,true);assert.equal(engine.heldWeapon(a).weaponId,'hull-bore');
 r.activeId=a.id;a.location.square=42;r.arena.walls=['42:43'];
 const target=arena.wallTargets(r,a).find(w=>w.id==='wall:surface:42:43');assert.ok(target);
 const shot=engine.resolvePlayerCombatAction(r,a,{kind:'fire',targetId:target.id},helpers);assert.equal(shot.ok,true,shot.error);assert.equal(shot.weaponConsumed,'hull');assert.equal(a.thrownEffects[0].total,18);
 const complete=engine.tickCombatTimers(a,18,1,r);assert.equal(complete[0].type,'thrown');arena.boreWall(r,complete[0].effect.wallTarget);assert.equal(r.arena.walls.length,0);
});
test('throwing consumes the owned grenade once and requests a normal placement check',()=>{
 const {r,a,b,helpers}=armed('grenade');const result=engine.resolvePlayerCombatAction(r,a,{kind:'throwItem',inventoryId:'weapon',targetId:b.id},helpers);
 assert.equal(result.ok,true,result.error);assert.equal(result.beginAttack.personalEffect.throwEffect.remaining,25);assert.equal(a.weapons.length,0);assert.equal(a.thrownEffects.length,0,'timer starts after confirmed placement');
});
test('a proximity mine waits for motion outside its fifteen-unit launcher safety radius',()=>{
 const r=room(),a=unit('launcher',41),b=unit('walker',61);r.units=[a,b];a.thrownEffects=[{id:'mine',origin:b.location,remaining:0,armedMine:true,launcherId:a.id}];
 assert.equal(engine.advanceThrown(r,a,1).length,0);b.timedAction={kind:'move',remaining:1,total:2};assert.equal(engine.advanceThrown(r,a,1).length,1);
});

const ammunition=require('../personal-ammunition'),bores=require('../personal-bore-drones');
test('reload spends reserve rounds without replenishing on loadout sync',()=>{
 const {a}=armed('ballistic-sidearm'),gun=a.weapons[0];gun.ammoRemaining=2;a.items=[{id:'box',catalogId:'ballistic-ammo',quantity:1}];
 assert.equal(ammunition.reload(a,gun),8);assert.equal(a.items[0].ammoRounds,92);assert.equal(gun.ammoRemaining,10);
 gun.ammoRemaining=0;engine.syncUnitCombat(a,{weapons:[{inventoryId:'weapon',weaponId:'ballistic-sidearm',ammoRemaining:10}],heldWeaponId:'weapon'});assert.equal(a.weapons[0].ammoRemaining,0);
 assert.throws(()=>ammunition.reload({...a,items:[]},a.weapons[0]),/Purchase/);
});
test('Assassin safety requires a matching GM program',()=>{
 const {r,a,b,helpers}=armed('mk-u-id-assassin');assert.match(engine.resolvePlayerCombatAction(r,a,{kind:'fire',targetId:b.id},helpers).error,/safety/);
 a.weapons[0].targetProgram={kind:'target',value:b.id};assert.equal(engine.resolvePlayerCombatAction(r,a,{kind:'fire',targetId:b.id},helpers).ok,true);
 a.weapons[0].targetProgram={kind:'race',value:'android'};assert.equal(ammunition.canTarget(a.weapons[0],b),false);b.raceId='android';assert.equal(ammunition.canTarget(a.weapons[0],b),true);
});
test('Bizi splits a single charge pool between distinct targets',()=>{
 const {r,a,b,helpers}=armed('multi-lock-bizi-21'),c=unit('c',43);r.units.push(c);a.weaponCharge={inventoryId:'weapon',progress:100};a.aim={dice:[12]};
 const shot=engine.resolvePlayerCombatAction(r,a,{kind:'fire',targetId:b.id,weaponOptions:{secondTarget:c.id}},helpers);assert.equal(shot.ok,true,shot.error);
 const first=rules.parseDiceFormula(shot.beginAttack.plan.damageFormula),second=rules.parseDiceFormula(shot.beginAttack.additionalAttack.plan.damageFormula);
 assert.equal((first.dice.get(4)||0)+(second.dice.get(4)||0),8);assert.equal((first.dice.get(12)||0)+(second.dice.get(12)||0),1);assert.equal(shot.beginAttack.plan.attackModifier,2);
 assert.match(engine.resolvePlayerCombatAction(r,a,{kind:'fire',targetId:b.id,weaponOptions:{secondTarget:b.id}},helpers).error,/different/);
});
test('bore drones move visibly, follow a moving target, and destruction cancels arrival',()=>{
 const {r,a,b}=armed('bore-launcher');b.location.square=44;const drone=bores.launch(r,a,'skull-bore',b),effect={droneId:drone.id,weaponId:'skull-bore',remaining:9};
 assert.equal(drone.currentHp,5);assert.equal(drone.defenseScore,14);assert.equal(bores.advance(r,effect,3),false);assert.equal(drone.location.square,42);
 b.location.square=46;assert.equal(bores.advance(r,effect,3),false);assert.equal(drone.location.square,43);drone.currentHp=0;assert.equal(bores.advance(r,effect,20),false);assert.equal(effect.cancelled,true);
});
test('cooking explosive follows holder and throwing preserves remaining fuse',()=>{
 const {r,a,b,helpers}=armed('grenade');const arm=engine.resolvePlayerCombatAction(r,a,{kind:'armExplosive'},helpers);assert.equal(arm.weaponConsumed,'weapon');assert.equal(a.weapons.length,0);
 engine.advanceThrown(r,a,7);assert.equal(a.thrownEffects[0].remaining,18);r.activeId=a.id;a.atb=100;
 const shot=engine.resolvePlayerCombatAction(r,a,{kind:'throwItem',inventoryId:'armed:'+a.thrownEffects[0].id,targetId:b.id},helpers);assert.equal(shot.ok,true,shot.error);assert.equal(shot.beginAttack.personalEffect.throwEffect.remaining,18);assert.equal(a.thrownEffects.length,0);assert.equal(shot.weaponConsumed,'');
});
test('Space Suit and Kevlar never stack and incompatible Symitrons cannot wear a suit',()=>{
 const u=unit('armor',0);u.items=[{id:'vest',catalogId:'kevlar-vest',quantity:1},{id:'suit',catalogId:'space-suit',quantity:1}];
 assert.equal(effects.damage(u,30,{element:'Physical'}).applied,10);u.statuses={armorItemId:'vest'};assert.equal(effects.damage(u,30,{element:'Physical'}).applied,10);
 u.items=u.items.filter(i=>i.id==='suit');u.raceId='yuhorn-symitron';u.raceType='rock';assert.equal(effects.damage(u,30,{element:'Physical'}).applied,30);
});

test('thrown melee uses Coordination, half damage and retrieval range',()=>{
 const {r,a,b,helpers}=armed('fusion-blade');b.location.square=45;
 const result=engine.resolvePlayerCombatAction(r,a,{kind:'throwItem',inventoryId:'weapon',targetId:b.id},helpers);assert.equal(result.ok,true,result.error);assert.equal(result.beginAttack.plan.attackSkill,'Coordination');assert.equal(result.beginAttack.plan.damageScale,.5);assert.equal(a.heldWeaponId,'');
 r.activeId=a.id;assert.match(engine.resolvePlayerCombatAction(r,a,{kind:'drawWeapon',inventoryId:'weapon'},helpers).error,/beside/);a.location.square=44;assert.equal(engine.resolvePlayerCombatAction(r,a,{kind:'drawWeapon',inventoryId:'weapon'},helpers).ok,true);
});
test('Gravity object rating affects accuracy as well as range and damage',()=>{
 const plan=rules.attackPlan(catalog.find(w=>w.id==='gravity-gun'),{options:{rating:8}});assert.equal(plan.attackModifier,8);assert.equal(plan.damageFormula,'8D12');assert.equal(plan.effectiveRange,32);assert.equal(plan.manualToHit,false);
});
