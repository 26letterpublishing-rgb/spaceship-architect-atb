const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const stats=require('../npc-statistics'),engine=require('../combat-engine');
const npc=(extra={})=>({team:'npc',mentalAttribute:5,physicalAttribute:4,speed:5,weapons:[],...extra});
test('NPC starting Exertion uses rounded-up half Mental plus one; PCs and Ship AI unchanged',()=>{
  for(const mental of [2,3,4,5,19,20]){const u=npc({mentalAttribute:mental});engine.migrateUnitCombat(u);assert.equal(u.exertionMax,Math.ceil(mental/2)+1);assert.equal(u.exertionCurrent,u.exertionMax);}
  assert.equal(stats.availableExertion({team:'pc'}),1,'Preserve the existing unlinked PC fallback');
  assert.equal(stats.availableExertion({team:'pc',exertionCurrent:0}),0);
  for(const u of [{team:'pc',exertionCurrent:2,exertionMax:2},npc({shipAi:true})]){const before=JSON.stringify(u);stats.exertion(u);assert.equal(JSON.stringify(u),before);}
});
test('migration preserves spent zero, legacy overrides and balances through repeated sync/reload',()=>{
  for(const current of [0,1,3]){let u=npc({exertionCurrent:current,exertionMax:8});for(let i=0;i<3;i++){engine.migrateUnitCombat(u);u=JSON.parse(JSON.stringify(u));}assert.equal(u.exertionCurrent,current);assert.equal(u.exertionMax,8);}
  const u=npc({exertionCurrent:9});engine.migrateUnitCombat(u);assert.equal(u.exertionCurrent,9);assert.equal(u.exertionMax,9,'Do not discard an intentional old balance lacking a maximum');
  engine.syncUnitCombat(u,{...u,exertionCurrent:99});assert.equal(u.exertionCurrent,9,'A stale loadout cannot refill a live balance');
});
test('Mental changes update derived capacity without refilling; explicit maxima remain intact',()=>{
  const u=npc();engine.migrateUnitCombat(u);u.exertionCurrent=1;engine.applyNpcSimplifiedStats(u,{mentalAttribute:20});assert.equal(u.exertionMax,11);assert.equal(u.exertionCurrent,1);
  u.exertionCurrent=10;engine.applyNpcSimplifiedStats(u,{mentalAttribute:2});assert.equal(u.exertionMax,2);assert.equal(u.exertionCurrent,2);
  const override=npc({exertionMax:9,exertionCurrent:0});engine.applyNpcSimplifiedStats(override,{mentalAttribute:20});assert.equal(override.exertionMax,9);assert.equal(override.exertionCurrent,0);
});
test('NPC timers never refill Exertion and automation forbids spending even while suspended',()=>{
  const u=npc({exertionCurrent:0});engine.migrateUnitCombat(u);engine.tickCombatTimers(u,3600);assert.equal(u.exertionCurrent,0);
  u.exertionCurrent=2;assert.equal(stats.validateExertion(u,1),1);
  for(const automationSuspended of [false,true]){u.automationMode='npc';u.automationSuspended=automationSuspended;assert.equal(stats.availableExertion(u),0);assert.throws(()=>stats.validateExertion(u,1),/unavailable/);}
  u.automationMode='off';assert.equal(stats.availableExertion(u),2);assert.throws(()=>stats.validateExertion(u,1,{automatedAction:true}),/unavailable/);
  for(const amount of [-1,0.5,3,NaN])assert.throws(()=>stats.validateExertion(u,amount),/unavailable/);
});
test('real NPC dice adapter adds one D12 and one flat point per Exertion, damage unchanged',async()=>{
  let pool;class Roller{rollPool(options){pool=options.sides;options.onSettled(options.fusion?[2,3,12]:[2,3]);return Promise.resolve();}stop(){}}
  const window={dispatchEvent(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../npc-combat-dice.js'),'utf8').replace(/^import .*;\r?\n/,''),{PhysicalDiceRoller:Roller,window,document:{querySelector(){return {};},body:{classList:{add(){},remove(){}}}},CustomEvent:class{}});
  const result=await window.SANpcDice.rollCheck({sides:[4,4],skill:2,title:'NPC check',exertion:1});assert.deepEqual(Array.from(pool),[4,4,12]);assert.equal(result.score,18);
  const damage=await window.SANpcDice.rollDamage({sides:[4,4],flat:1,title:'Damage'});assert.deepEqual(Array.from(pool),[4,4]);assert.equal(damage.score,6);
});
