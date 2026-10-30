'use strict';
// Fixture data only. All gameplay normalization and commands use production APIs.
const crypto=require('node:crypto');
const scenarios=['ready','no-AU','offline','no-target'];
function validate(tier,scenario){if(!Number.isInteger(tier)||tier<1||tier>9||!scenarios.includes(scenario))throw Error('Choose Sensors 1–9 and a listed scenario.');}
async function seed(post,tier,scenario){
 validate(tier,scenario);
 const password=crypto.randomUUID(),created=await post('campaign/create',{name:`Sensors ${tier} debug / ${scenario}`,gmCode:password}),code=created.campaign.code,token=created.token;
 const character={id:'debug-pc',phase:'finalized',access:{pcCode:password},identity:{characterName:'Console Tester',playerName:'Disposable fixture'},attributes:{health:[1,0,-1,-1],intellect:[1,0,-1,-1],perception:[1,0,-1,-1],dexterity:[1,0,-1,-1]},skills:{'Sensor Systems':{tenths:10}},computed:{maximumHp:30,moveSpeed:2,speed:.1,commandWindow:600,skills:{'Sensor Systems':1}},health:{current:30}};
 const joined=await post('campaign/join/request',{code,character});await post('campaign/join/respond',{code,token,requestId:joined.requestId,decision:'approve'});
 const pcToken=(await post('campaign/join/status',{code,characterId:character.id,pcCode:password})).token;
 const hull=Array.from({length:280},(_,i)=>i);
 const ship={id:'debug-ship',title:'Sensor Laboratory',crewCharacterIds:[character.id],ship:{id:'debug-ship',title:'Sensor Laboratory',confirmedOnce:true,gridCells:hull,sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:`sensors-${tier}`,...(scenario==='offline'?{status:'powered-down'}: {})},{id:'en',type:scenario==='no-AU'?'en-engine-6':'en-au-engine-6'},{id:'life',type:'life-support'}],placements:[{sicId:'en',cell:0},{sicId:'cp',cell:200},{sicId:'sn',cell:202},{sicId:'life',cell:210}]}};
 const enemy={id:'debug-target',title:'Test Contact',controlType:'gm',ship:{id:'debug-target',title:'Test Contact',confirmedOnce:true,gridCells:Array.from({length:36},(_,i)=>42+Math.floor(i/6)*20+i%6),sicInventory:[{id:'cp',type:'cockpit-1'},{id:'en',type:'en-engine-2'},{id:'veil',type:'darkveil-3'}],placements:[{sicId:'cp',cell:42},{sicId:'en',cell:64},{sicId:'veil',cell:44}]}};
 for(const s of [ship,...(scenario==='no-target'?[]:[enemy])])await post('campaign/starship/link',{code,token,starship:s.ship});
 await post('campaign/starship/crew',{code,token,starshipId:ship.id,crewCharacterIds:[character.id]});
 const act=body=>post('action',{roomCode:code,gmToken:token,...body});
 await act({action:'prepareEncounter',preparationId:crypto.randomUUID(),mode:'starship',starships:[ship,...(scenario==='no-target'?[]:[enemy])],shipPositions:[{id:ship.id,q:0,r:0},...(scenario==='no-target'?[]:[{id:enemy.id,q:7,r:0}])],units:[{characterId:character.id,characterName:'Console Tester',team:'pc',speed:.1,commandWindow:600,sensorSkill:1,location:{starshipId:ship.id,square:200,mesh:0,stationed:true}}]});
 return {code,token,pcToken,password,characterId:character.id,tier,scenario,act};
}
module.exports={seed,validate,scenarios};
