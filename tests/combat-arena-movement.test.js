const test=require('node:test'),assert=require('node:assert/strict'),A=require('../combat-arena'),engine=require('../combat-engine');
const room=()=>({arena:A.normalize({width:7,height:7,floors:[0,1,2,3,4,5,6],doors:{'1:2':{open:false,automatic:false,hits:0}}}),units:[],vehicles:[],starships:[],threshold:100});
const helpers={id:()=> 'move',clearActiveCommand:()=>{},pushLog:()=>{},moveToNextTurnOrClock:()=>{}};

test('melee movement bonus counts only the final straight portion, across automatic move segments',()=>{
 const r=room();r.arena=A.normalize({width:9,height:9,floors:Array.from({length:81},(_,i)=>i)});
 const u={id:'a',team:'pc',moveSpeed:6,location:{arenaId:'surface',square:0,mesh:4}};engine.migrateUnitCombat(u);r.units=[u];r.activeId=u.id;
 const route=[1,2,3,4,5,6,15].map(n=>A.surfaceGrid(r.arena).location(n));
 assert.equal(engine.resolvePlayerCombatAction(r,u,{kind:'move',route},helpers).ok,true);assert.equal(u.movementChargeUnits,6);
 engine.tickCombatTimers(u,3,1,r);assert.equal(u.movementChargeUnits,1);assert.equal(u.lastMoveStart.square,6);
 assert.equal(A.straightRun(r,u.location,[7,8].map(n=>A.surfaceGrid(r.arena).location(n))).units,2);
});

test('Space Slug has two D4 Strength dice while retaining its other physical stats',()=>{
 const source=require('../data/npc-templates.json').find(n=>n.id==='space-slug'),u={team:'npc'};engine.applyNpcSimplifiedStats(u,source);
 assert.deepEqual(u.strengthDice,[4,4]);assert.deepEqual(u.dexterityDice,engine.npcAttributeDice(6));assert.equal(u.physicalSkill,1);
});
test('surface movement uses normal gravity and stops when a manual door closes during travel',()=>{const r=room(),u={id:'pc',team:'pc',moveSpeed:6,location:{arenaId:'surface',square:0,mesh:4}};engine.migrateUnitCombat(u);r.units=[u];r.activeId=u.id;r.arena.doors['1:2'].open=true;const result=engine.resolvePlayerCombatAction(r,u,{kind:'move',route:A.route(r.arena,0,3)},helpers);assert.equal(result.ok,true);assert.equal(u.timedAction.gravityScale,1);assert.equal(u.timedAction.total,1.5);r.arena.doors['1:2'].open=false;engine.tickCombatTimers(u,.1,1,r);assert.equal(u.timedAction,null);assert.equal(u.location.square,0);assert.deepEqual(u.travelRoute,[]);});
test('automatic doors open on approach, manual overrides stop paths, and three qualifying hits break the door open',()=>{const r=room(),d=r.arena.doors['1:2'];d.automatic=true;r.units=[{location:{arenaId:'surface',square:0}}];A.doors(r);assert.equal(d.open,true);d.override=false;A.doors(r);assert.equal(A.route(r.arena,0,3),null);const target={arenaId:'surface',key:'1:2'},D=require('../ship-doors');assert.equal(D.hit(r,target,9),0);assert.equal(D.hit(r,target,10),1);D.hit(r,target,12);D.hit(r,target,20);A.doors(r);assert.equal(d.open,true);assert.equal(d.hits,3);});
test('melee, grappling and thrown items cannot bypass a closed-door target check',()=>{for(const kind of ['melee','wrestle','throwItem']){const r=room(),a={id:'a',team:'pc',location:{arenaId:'surface',square:1}},b={id:'b',team:'npc',location:{arenaId:'surface',square:2}};engine.migrateUnitCombat(a);engine.migrateUnitCombat(b);r.units=[a,b];r.activeId=a.id;const result=engine.resolvePlayerCombatAction(r,a,{kind,targetId:'b'},helpers);assert.equal(result.ok,false);assert.match(result.error,/wall|closed door/);}});


test('stopping a custom route credits only the straight distance actually completed',()=>{
 const r=room();r.arena=A.normalize({width:9,height:9,floors:Array.from({length:81},(_,i)=>i)});
 const u={id:'a',team:'pc',moveSpeed:6,location:{arenaId:'surface',square:0,mesh:4}};engine.migrateUnitCombat(u);r.units=[u];r.activeId=u.id;
 const route=[1,2,3,4,5,6,15,24].map(n=>A.surfaceGrid(r.arena).location(n));
 assert.equal(engine.resolvePlayerCombatAction(r,u,{kind:'move',route},helpers).ok,true);
 engine.tickCombatTimers(u,1.1,1,r);engine.stopMovement(r,u);
 assert.equal(u.location.square,2);assert.equal(u.movementChargeUnits,2);assert.deepEqual(u.travelRoute,[]);
 r.activeId=u.id;
 assert.equal(engine.resolvePlayerCombatAction(r,u,{kind:'move',route:[3,4].map(n=>A.surfaceGrid(r.arena).location(n))},helpers).ok,true);
 engine.tickCombatTimers(u,1,1,r);assert.equal(u.movementChargeUnits,4);
 r.activeId=u.id;
 assert.equal(engine.resolvePlayerCombatAction(r,u,{kind:'move',route:[3].map(n=>A.surfaceGrid(r.arena).location(n))},helpers).ok,true);
 engine.tickCombatTimers(u,.5,1,r);assert.equal(u.movementChargeUnits,1);
});
