const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+start.length));
async function calculate(profile,results,extra={}){
 let result;const c={skillCheck:{campaignRequestId:'fixture-request',currentRollSides:results.map(()=>12),preservedFusions:[],committedExertion:2,difficulty:12,...extra.check},character:{statuses:{},identity:{},creation:{},...extra.character},rollRuleProfile:()=>profile,fusionResults:values=>({fusions:[],leftovers:values}),skillCheckResolvedSkill:()=>({name:'Awareness',skill:{}}),combinedSkillBonusTenths:()=>50,selectedSkillEquipment:()=>[{label:'Test gear',bonus:1}],adjustedSkillOutcome:()=> 'Success',formatNumber:String,showSkillResult:r=>result=r};
 vm.runInNewContext(extract('async function resolvePhysicalSkillRoll(', 'function calculateManualSkillResult('),c);await c.resolvePhysicalSkillRoll(results);return result;
}
test('automatic provenance records actual values and individual modifiers without reconstructing from final total',async()=>{
 const r=await calculate({raceId:'human',classId:'ordinary',attributeKey:'perception',skillName:'Awareness'},[6,4,2]);assert.equal(r.score,18);assert.equal(r.calculation.score,18);const lines=r.calculation.lines.join('\n');for(const text of ['D12=6, D12=4, D12=2','Selected top two: 6 + 4 = 10','Skill bonus: 5','Exertion: 2','Equipment Test gear: 1','Flat-modifier subtotal: 3','Final score: 10 + 5 + 3 + 0 = 18'])assert.ok(lines.includes(text),text);
});
test('adjustments, penalties and unused-dice intermediate values are retained',async()=>{
 const epoc=await calculate({raceId:'epoc',classId:'other',attributeKey:'perception',skillName:'Awareness'},[6,4,1],{character:{creation:{classAttributeChoice:'perception'}}});assert.equal(epoc.score,17.1);assert.match(epoc.calculation.lines.join('\n'),/Epoc ones penalty: -1/);assert.match(epoc.calculation.lines.join('\n'),/applied bonus 0.1/);
 const g=await calculate({raceId:'garmoc',classId:'ordinary',attributeKey:'intellect',skillName:'Awareness'},[12,4,2]);assert.match(g.calculation.lines.join('\n'),/Raw dice: D12=12/);assert.match(g.calculation.lines.join('\n'),/Adjusted dice: 8, 4, 2/);assert.equal(g.score,20);
 const n=await calculate({raceId:'human',classId:'ninja',attributeKey:'dexterity',skillName:'Stealth'},[6,4,2]);assert.equal(n.score,26);assert.match(n.calculation.lines.join('\n'),/Ninja additional Exertion: 8/);
});
test('Campaign submission carries the captured report unchanged; combat transmission stays outside this increment',async()=>{
 let body;const c={skillCheck:{campaignRequestId:'r'},campaignCode:'C',campaignCharacterId:'mine',campaignToken:'fixture',notice(){},campaignRequest:async(_url,o)=>{body=JSON.parse(o.body);}};
 vm.runInNewContext(extract('async function submitCampaignRollResult(', 'async function submitCombatRollResult('),c);const calculation={version:1,mode:'manual',score:8,lines:['Entered total; individual dice and applied modifiers unavailable.']};await c.submitCampaignRollResult({score:8,outcome:'Failure',manual:true,diceResults:[],calculation});assert.deepEqual(body.calculation,calculation);assert.equal(body.mode,'manual');
 const combat=extract('async function submitCombatRollResult(', 'function damageFormulaPool(');assert.ok(!combat.includes('calculation'));
});
test('preserved fusion values survive and non-Campaign calculations stay outside this increment',async()=>{
 const profile={raceId:'human',classId:'ordinary',attributeKey:'perception',skillName:'Awareness'};
 const r=await calculate(profile,[4,2],{check:{preservedFusions:[{sourceValue:4,sourceIndices:[0,1],value:8}]}});assert.equal(r.score,20);assert.match(r.calculation.lines.join('\n'),/Preserved fusions: 4 at indices \[0, 1\] → 8/);assert.match(r.calculation.lines.join('\n'),/Selected top two: 8 \+ 4 = 12/);
 const other=await calculate(profile,[4,2],{check:{campaignRequestId:null}});assert.equal(other.calculation,null);
});
test('manual and automatic-success fallback reports explicitly label unavailable provenance',()=>{
 const begin=source.indexOf('  const campaignCalculation='),end=source.indexOf('  const ruleLines',begin),code=source.slice(begin,end)+'\nglobalThis.saved=campaignCalculation;';
 for(const auto of [false,true]){const c={skillCheck:{campaignRequestId:'r',autoSuccess:auto},calculation:null,score:12,equation:auto?'Auto Succeed':'Manual Final Score',manual:true,dom:{skillResultEquation:{style:{}}}};vm.runInNewContext(code,c);assert.equal(c.saved.score,12);assert.equal(c.saved.mode,'manual');assert.match(c.saved.lines[1],auto?/no dice rolled/:/individual dice and applied modifiers unavailable/);assert.equal(c.dom.skillResultEquation.style.whiteSpace,'pre-line');}
});
