const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
test('Move Speed includes full fractional Athletics rating alongside DEX and GM adjustments',()=>{
 const context=vm.createContext({character:{attributes:{dexterity:[3,2,1]},skills:{'Athletics/Endurance':{tenths:25}},gmAdjustments:{moveSpeed:1}},raceEffects:()=>({}),displayedSkillTenths:(_name,skill)=>skill?.tenths||0});
 vm.runInContext(source.slice(source.indexOf('function calculatedMoveSpeedDetails('),source.indexOf('function damageReductionDetails(')),context);
 assert.equal(context.calculatedMoveSpeed(),6.5);context.character.skills['Athletics/Endurance'].tenths=50;assert.equal(context.calculatedMoveSpeed(),9);
});
test('maximum D6/D8 advancement keeps once without opening reroll choices',()=>{
 for(const sides of [6,8]){
  let accepted=0,choices=0;
  const character={pendingRoll:{kind:'advancement-d6',result:sides,sides,preRatingTenths:20,baseCost:50},identity:{},experience:{available:1000}};
  const context=vm.createContext({character,acceptAdvancementResult:()=>{accepted++;character.pendingRoll=null;},diceRoller:{showChoices:()=>choices++}});
  vm.runInContext(source.slice(source.indexOf('function presentAdvancementDecision('),source.indexOf('function rerollAdvancement(')),context);
  context.presentAdvancementDecision();context.presentAdvancementDecision();
  assert.equal(accepted,1);assert.equal(choices,0);
  character.pendingRoll={kind:'advancement-d6',result:sides-1,sides,preRatingTenths:20,baseCost:50};context.presentAdvancementDecision();assert.equal(choices,1,'Non-maximum results retain the reroll choice');
 }
});
