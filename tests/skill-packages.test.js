const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {definitions,allocate,cost,purchase}=require('../skill-packages');

test('all package skills are existing persistent skill IDs',async()=>{
  const {SPACECRAFT_SKILLS,GENERAL_SKILLS}=await import('../character-data.js');
  const skills=new Set([...SPACECRAFT_SKILLS,...GENERAL_SKILLS]);
  assert.equal(definitions.length,12);
  for(const p of definitions)for(const skill of p.tiers.flat())assert.ok(skills.has(skill),skill);
});
test('all package pairs preserve every point, obey the cap, and produce a legal purchase history',()=>{
  for(const a of definitions)for(const b of definitions)for(const budget of [0,1,2,3,7,20,35,41,42,55,95,115,175]){
    const result=allocate([a.id,b.id],budget,3),levels={};
    assert.equal(result.spent+result.remaining,budget);
    assert.equal(result.remaining,0,'all tested legal creation budgets spend completely');
    assert.equal(result.allocations[0].allotted,Math.ceil(budget/2));
    assert.equal(result.allocations[1].allotted,Math.floor(budget/2));
    for(const p of result.purchases){assert.equal(p.cost,(levels[p.name]||0)+1);levels[p.name]=p.cost;assert.ok(p.cost<=3);}
    assert.deepEqual(levels,result.levels);
    assert.equal(Object.values(levels).reduce((n,l)=>n+cost(l),0),result.spent);
  }
});
test('core allocation is balanced and overlap buys further levels',()=>{
  const once=allocate(['combatant','mechanic'],12,3);
  assert.deepEqual(['Projectile','Melee','Dodge/Block'].map(n=>once.levels[n]),[1,1,1]);
  const twice=allocate(['combatant','combatant'],24,3);
  for(const n of ['Projectile','Melee','Dodge/Block'])assert.ok(twice.levels[n]>=2);
  const overlap=allocate(['mechanic','starship-specialist'],24,3);
  assert.ok(overlap.purchases.some(p=>p.name==='Engineering'&&p.slot===0));
  assert.ok(overlap.purchases.some(p=>p.name==='Engineering'&&p.slot===1));
});
test('saturated duplicate packages spend remaining points on important skills',()=>{
  const r=allocate(['starship-specialist','starship-specialist'],115,3);
  assert.equal(r.spent,115);assert.equal(r.remaining,0);
  assert.equal(r.levels['Dodge/Block'],3);assert.equal(r.levels.Awareness,3);
  const odd=allocate(['computer-nerd','starship-specialist'],38,3);
  assert.equal(odd.levels['Dodge/Block'],1);assert.equal(odd.remaining,0);
  const impossible=allocate(['starship-specialist','starship-specialist'],10000,3);
  assert.ok(impossible.remaining>0);assert.equal(impossible.spent+impossible.remaining,10000);
  assert.equal(purchase(2,2,3),null);assert.equal(purchase(3,99,3),null);
  assert.deepEqual(purchase(1,2,3),{level:2,cost:2,remaining:0});
});
test('allocator uses current race and Intellect budgets without changing the rules',async()=>{
  const data=await import('../character-data.js');
  const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
  const fn=source.slice(source.indexOf('function skillPointBudget('),source.indexOf('function skillCreationLevel('));
  const context={BASE_SKILL_POINTS:data.BASE_SKILL_POINTS,INTELLECT_SKILL_POINT_BONUSES:data.INTELLECT_SKILL_POINT_BONUSES};
  vm.createContext(context);vm.runInContext(fn,context);
  for(const [race,expected]of [['',58],['spiddix',43],['angiluros',118]]){
    const pool=context.skillPointBudget({identity:{raceId:race},attributes:{intellect:[4,1,-1,-1]}});
    assert.equal(pool,expected);
    const r=allocate(['survivalist','scholar'],pool,data.MAX_STARTING_SKILL);
    assert.equal(r.spent+r.remaining,expected);
  }
});
