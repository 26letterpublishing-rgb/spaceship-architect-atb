const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
const start=source.indexOf('function showSkillResult('),end=source.indexOf('\nasync function confirmSkillResult',start);
function display(damage,multiplier,score){
 const nodes={},dom=new Proxy(nodes,{get:(target,key)=>target[key]||=( {})});
 const skillCheck={damage,damageMultiplier:multiplier,preservedFusions:[],currentRollSides:[10]};
 const context={dom,skillCheck,PAGE_PARAMS:new URLSearchParams('shipRoll=1'),character:{resources:{reverence:0}},formatNumber:String,rollRuleExplanations:()=>[],renderFusionSelectionState(){},reverenceRerollCost:()=>2,availableFreeReroll:()=>null};
 vm.runInNewContext(source.slice(start,end)+';showSkillResult({score:'+score+',equation:"dice total",outcome:"",diceResults:['+score+']});',context);
 return {nodes,skillCheck};
}
test('ordinary and multiplied ship damage show final damage without changing the submitted raw dice total',()=>{
 for(const [multiplier,score,expected]of [[1,5,'5'],[5,12,'60']]){
  const {nodes,skillCheck}=display(true,multiplier,score);
  assert.equal(nodes.skillResultScore.textContent,expected);
  assert.equal(skillCheck.pendingSubmission.score,score);
  assert.equal(nodes.exitSkillResult.textContent,'Confirm and Submit');
 }
 assert.equal(display(false,1,13).nodes.skillResultScore.textContent,'Ready','Accuracy still resolves after its input delay');
});
