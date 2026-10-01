const test=require('node:test'),assert=require('node:assert/strict'),runner=require('../automation-runner');
test('Explore NPC attack waits for animated dice then submits and approves damage',async()=>{
 const npc={id:'n',team:'npc',automationMode:'npc',characterName:'NPC',dexterityDice:[6,6,6,6],projectileSkill:2.5},pc={id:'p',team:'pc'};
 const room={showcase:true,hasEngagedClock:true,units:[npc,pc],starships:[],attackResolution:{id:'a',phase:'checks',attackerId:'n',defenderId:'p',attackType:'ranged',plan:{attackSkill:'Projectile'}}},calls=[];
 const h={act:async b=>{calls.push(b);room.attackResolution.attackerRoll={};return {ok:true};},publish(){},off(){}};
 await runner.step(room,.5,h);assert.equal(calls.length,0);assert.equal(npc.automationPresentation.personalAttack,true);
 await runner.step(room,10,h);assert.equal(calls.length,0);npc.automationPresentation.animationComplete=true;
 for(let i=0;i<3;i++)await runner.step(room,.5,h);assert.equal(calls[0].action,'submitAttackRoll');assert.equal(calls[0].diceResults.length,4);
 room.attackResolution.phase='gmDamage';room.attackResolution.damageSummary={applied:12};await runner.step(room,.5,h);assert.equal(calls[1].finalDamage,12);
});
test('ordinary campaigns never automatically approve GM damage',async()=>{let calls=0;await runner.step({showcase:false,hasEngagedClock:true,units:[],attackResolution:{phase:'gmDamage'}},1,{act(){calls++;},publish(){}});assert.equal(calls,0);});
const logs=require('../crew-logs');
test('Crew Log approval creates one claimable reward across retries and reloads',()=>{const campaign={awardHistory:[],privateNotes:[]},entry={id:'a',characterId:'pc',characterName:'Nova'};logs.award(campaign,entry);logs.award(campaign,entry);logs.award(campaign,JSON.parse(JSON.stringify(entry)));assert.equal(campaign.awardHistory.length,1);assert.equal(campaign.privateNotes.length,1);assert.equal(campaign.awardHistory[0].claimRequired,true);assert.equal(campaign.privateNotes[0].rewardAmount,1);});
test('Crew Log projection only exposes own and shared crew journals',()=>{const c={crewLogs:[{characterId:'a'},{characterId:'b'},{characterId:'c'}],starships:[{crewCharacterIds:['a','b']}]};assert.equal(logs.visible(c,'a').length,2);assert.equal(logs.visible(c,'a',true).length,3);});

test('Explore First Aid confirms GM gate then preserves animated NPC healing',async()=>{
 const npc={id:'n',team:'npc',automationMode:'npc',characterName:'Medic',mentalAttribute:4,mentalSkill:2.5};
 const room={showcase:true,hasEngagedClock:true,units:[npc],starships:[],itemResolution:{id:'aid',phase:'gmDifficulty',baseDifficulty:10,healerId:'n',healingFormula:'2D8'}},calls=[];
 const h={act:async b=>{calls.push(b);return {ok:true};},publish(){},off(){}};
 await runner.step(room,.5,h);assert.equal(calls[0].action,'setFirstAidDifficulty');assert.equal(calls[0].difficulty,10);
 room.itemResolution.phase='healing';await runner.step(room,.5,h);assert.deepEqual(npc.automationPresentation.sides,[8,8]);assert.equal(calls.length,1);
 npc.automationPresentation.animationComplete=true;for(let i=0;i<3;i++)await runner.step(room,.5,h);
 assert.equal(calls[1].action,'submitFirstAidHealing');assert.equal(calls[1].rolledHealing,calls[1].diceResults.reduce((a,b)=>a+b,0));
});
