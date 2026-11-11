const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),start=source.indexOf('function opposedRollBreakdown('),end=source.indexOf('function renderAttackResolution(',start),context={};vm.runInNewContext(source.slice(start,end),context);
const format=context.opposedRollBreakdown,rules=require('../combat-rules');
function fixture(calledShot=false){const plan={allowed:true,attackModifier:-2,defenseMultiplier:2,defenseRangeModifier:-1};return{attackerRoll:{score:35,mode:'automatic',diceResults:[12,10,4]},defenseRoll:{score:6,mode:'automatic',diceResults:[2,3,1]},timedDefenseBonus:2,racialDefenseBonus:1,attackerDefenseModifier:-3,defenseBonus:0,calledShot,plan,attackResult:rules.resolveAttack({baseAttackScore:35,targetDefense:6,calledShot,plan})};}
test('both sides show exact compact authoritative results and nonzero modifiers without mutation',()=>{
 for(const called of [false,true]){const a=fixture(called),before=JSON.stringify(a),left=format(a,'attacker'),right=format(a,'defender');assert.equal(left,'Final To-Hit: 33 · Critical hit\nAttack adjustment -2');assert.equal(right,'Final hit threshold: '+a.attackResult.hitDefense+' · Critical hit\nTimed Defense +2 · Racial Defense +1 · Attacker effect -3 · Range ×2 · Range -1'+(called?' · Called shot +5':''));assert.doesNotMatch(left+right,/Recorded dice|12, 10, 4|2, 3, 1|fusion|Combined Defense|Critical base|\+0/);assert.equal(JSON.stringify(a),before);}
});
test('manual, fixed, missing, waiting and expired records do not invent dice or modifiers',()=>{
 assert.equal(format({},'attacker'),'Waiting');assert.equal(format({defenderCommand:{expired:true}},'defender'),'WINDOW EXPIRED');
 for(const mode of ['manual','fixed','automatic']){const text=format({attackerRoll:{score:10,mode},plan:{}},'attacker');assert.equal(text,(mode==='manual'?'Manual score: ':mode==='fixed'?'Fixed score: ':'Score: ')+'10 · Awaiting resolution');}
});
test('display uses recorded result rather than recomputing and labels miss correctly',()=>{
 const a=fixture();a.attackResult={attackScore:9,hitDefense:11,criticalDefense:11,hit:false,critical:false};assert.equal(format(a,'attacker'),'Final To-Hit: 9 · Miss\nAttack adjustment -2');assert.match(format(a,'defender'),/^Final hit threshold: 11 · Miss/);assert.doesNotMatch(format(a,'attacker'),/dice|fusion|unavailable/i);
});
test('breakdown remains behind the existing GM-only panel boundary and uses text content',()=>{
 const body=source.slice(end,source.indexOf('function ',end+10));assert.ok(body.indexOf('if (mode !== "gm")')<body.indexOf("opposedRollBreakdown(attack,'attacker')"));assert.match(body,/mode !== "gm"[\s\S]*?classList.add\("hidden"\);\s*return;/);assert.match(body,/attackRollStatus.textContent = opposedRollBreakdown/);assert.match(body,/defenseRollStatus.textContent = opposedRollBreakdown/);
});
