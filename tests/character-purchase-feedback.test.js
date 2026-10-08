const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
function load(context,start,end){vm.createContext(context);vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),context);return context;}
test('attribute creation and XP upgrades apply silently without bypassing the budget',async()=>{
  for(const phase of ['draft','finalized']){
    const notices=[];let renders=0;
    const character={phase,attributes:{strength:[0,0]},identity:{},advancementOpen:true,resources:{},experience:{available:30,spent:0}};
    const context=load({character,canPurchaseAttributes:()=>true,ATTRIBUTE_DEFS:[{key:'strength',label:'Strength'}],DICE_NAMES:['D4','D6'],maximumHp:()=>30,
      manualInputMode:()=>false,attributeStepCost:()=>15,attributePointsSpent:()=>0,attributePointBudget:()=>15,playPurchaseSound:()=>{},mechanicalSpiddixAttribute:()=>false,
      spendXp:cost=>{character.experience.available-=cost;character.experience.spent+=cost;return true;},advancementAttributePurchases:[],
      syncDerivedResources:()=>{},queueSave:()=>{},renderWithoutViewportJump:()=>renders++,notice:(...args)=>notices.push(args)},'async function purchaseAttribute(','function gmAdjustAttribute(');
    await context.purchaseAttribute('strength',0,1);
    assert.equal(character.attributes.strength[0],1);assert.equal(renders,1);assert.deepEqual(notices,[]);
    if(phase==='finalized')assert.equal(character.experience.available,15);
    else{context.attributePointsSpent=()=>15;await context.purchaseAttribute('strength',1,1);assert.equal(character.attributes.strength[1],0);assert.equal(notices[0][1],'error');}
  }
});
test('manual skill purchase/refund retains validation but emits no success popup',()=>{
  const skill={tenths:0,creationDecimal:null},notices=[];let renders=0;
  const character={phase:'draft',creation:{skillPurchaseOrder:[]}};
  const c=load({character,MAX_STARTING_SKILL:3,window:{SASkillPackages:require('../skill-packages')},draftValidation:()=>({attributesComplete:true,skillSpent:0,skillBudget:1}),
    resolveSkill:()=>({skill,name:'Awareness'}),creationSkillMethod:()=> 'custom',skillCreationLevel:s=>s.tenths/10,playPurchaseSound:()=>{},queueSave:()=>{},removeLastPurchaseEntry:()=>character.creation.skillPurchaseOrder.pop(),
    renderWithoutViewportJump:()=>renders++,notice:(...a)=>notices.push(a)},'function changeDraftSkill(','function skillKeysForFinalization(');
  c.changeDraftSkill('Awareness',1);assert.equal(skill.tenths,10);assert.equal(character.creation.skillPurchaseOrder[0].cost,1);
  c.changeDraftSkill('Awareness',-1);assert.equal(skill.tenths,0);assert.equal(renders,2);assert.deepEqual(notices,[]);
});
test('accepting skill advancement keeps the result and scroll-preserving render without a banner',()=>{
  const skill={tenths:14},character={pendingRoll:{skillKey:'Awareness',result:4}};let renders=0;
  const c=load({character,resolveSkill:()=>({skill}),saveLibrary:()=>{},renderWithoutViewportJump:()=>renders++,playPurchaseSound:()=>{},diceRoller:{celebrate:()=>{}},notice:()=>assert.fail('unexpected purchase popup')},'function acceptAdvancementResult(','function showPersistedPendingResult(');
  c.acceptAdvancementResult();assert.equal(skill.tenths,18);assert.equal(character.pendingRoll,null);assert.equal(renders,1);
});
