'use strict';
const {randomInt,randomUUID}=require('node:crypto');
const axes=[['Benevolent','Ruthless'],['Virtuous','Treacherous'],['Civil','Savage'],['Powerful','Weak'],['Cunning','Exploitable']];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Math.round(Number(n)||0)));
const popularity=s=>clamp(s?.ship?.popularity,0,100);
const selections=s=>axes.map((_,i)=>clamp(s?.ship?.reputationSelections?.[i]??5,0,10));
function selectShip(c,id){return c.starships.filter(s=>s.crewCharacterIds?.includes(id)).sort((a,b)=>popularity(b)-popularity(a)||Math.max(...selections(b).map(n=>Math.abs(n-5)))-Math.max(...selections(a).map(n=>Math.abs(n-5)))||a.id.localeCompare(b.id))[0]||null;}
function state(c){if(c.reputationSession?.number!==c.sessionNumber)c.reputationSession={number:c.sessionNumber,attitudes:{},contacts:{},activeKey:null,receipts:[]};return c.reputationSession;}
function modifier(ship,preferences){return selections(ship).reduce((sum,n,i)=>sum+(5-n)*(Number(preferences?.[i])||0),0);}
function setAttitude(c,npcId,values){if(!Array.isArray(values)||values.length!==5||values.some(v=>![0,1,-1].includes(v)))throw Error('Choose an attitude for each Reputation axis.');state(c).attitudes[npcId]=values.slice();}
function recognize(c,ship,npcId,key,{reroll=false,roll=()=>randomInt(1,101)}={}){
 const s=state(c),previous=s.contacts[key];if(previous&&!reroll){s.activeKey=key;return previous;}
 const percent=popularity(ship),value=clamp(roll(),1,100),success=value<=percent;
 const contact={key,shipId:ship.id,shipName:ship.title,npcId,roll:value,popularity:percent,recognized:success,awarded:Boolean(previous?.awarded),at:new Date().toISOString()};
 if(success&&!reroll&&!contact.awarded){ship.ship.popularity=Math.min(100,percent+1);contact.awarded=true;}
 s.contacts[key]=contact;s.activeKey=key;
 // Keep session memory bounded without losing the current interaction.
 const keys=Object.keys(s.contacts);if(keys.length>1000)delete s.contacts[keys[0]];
 return contact;
}
function hail(c,room,callId,shipId){const own=room.starships.find(s=>s.id===shipId),call=own?.commandSystems?.calls?.find(x=>x.id===callId);if(!call||call.status!=='connected')return;
 for(const [sourceId,npcId] of [[own.id,call.shipId],[call.shipId,own.id]]){const ship=c.starships.find(s=>s.id===sourceId);if(ship?.crewCharacterIds?.some(id=>c.characters.some(ch=>ch.id===id)))recognize(c,ship,npcId,'hail:'+callId+':'+sourceId);}
}
function snapshot(c,characterId,score,receipt){const ship=selectShip(c,characterId);if(!ship)return null;const s=state(c),active=s.contacts[s.activeKey];const npcId=active?.npcId||'general';
 const contact=active?.shipId===ship.id?active:recognize(c,ship,npcId,'roll:'+receipt);
 const preferences=s.attitudes[npcId]||[0,0,0,0,0],bonus=modifier(ship,preferences);
 return {...contact,modifier:bonus,raw:Number(score)||0,adjusted:(Number(score)||0)+bonus,attitude:preferences.slice(),shipName:ship.title};
}
function recordRoll(c,characterId,{attribute,skill,score,receipt,requestId,outcome='',source='Character sheet'}){
 if(String(attribute).toLowerCase()!=='charisma'||!receipt||requestId||!selectShip(c,characterId)||c.rollRequests.some(r=>r.statisticsReceipt===receipt))return;
 const total=Number(score)||0,result={score:total,mode:'automatic',outcome:String(outcome),respondedAt:new Date().toISOString(),reputation:snapshot(c,characterId,total,receipt)};
 c.rollRequests.push({id:'roll-'+randomUUID(),statisticsReceipt:receipt,source,attribute:'Charisma',skill:String(skill||'Charisma').slice(0,80),difficulty:null,targetIds:[characterId],results:{[characterId]:result},createdAt:result.respondedAt,closedAt:null});
}
function applyEnd(c,{shipIds=[],impactSides,impactResult,reputationRow,reputationDirection}={}){
 if(!shipIds.length)return [];
 if(![4,6,8,10,12,20].includes(impactSides)||!Number.isInteger(impactResult)||impactResult<1||impactResult>impactSides||!Number.isInteger(reputationRow)||reputationRow<0||reputationRow>4||![-1,1].includes(reputationDirection))throw Error('Roll the impact die and choose a Reputation direction.');
 const chosen=[...new Set(shipIds)].map(id=>c.starships.find(s=>s.id===id));if(chosen.some(s=>!s||!s.crewCharacterIds?.some(id=>c.characters.some(ch=>ch.id===id))))throw Error('Choose ships with registered PC crew.');
 return chosen.map(ship=>{const before=popularity(ship),values=selections(ship);values[reputationRow]=clamp(values[reputationRow]+reputationDirection,0,10);ship.ship.popularity=Math.min(100,before+impactResult);ship.ship.reputationSelections=values;
  const trait=axes[reputationRow][values[reputationRow]>5?1:0],amount=Math.abs(values[reputationRow]-5),message=`${ship.title}: Popularity ${before}% → ${ship.ship.popularity}% (D${impactSides}: ${impactResult}). Reputation: ${amount?trait+' +'+amount:'Neutral'} on the ${axes[reputationRow].join(' / ')} axis.`;
  for(const id of ship.crewCharacterIds){const character=c.characters.find(ch=>ch.id===id);if(character)c.privateNotes.push({id:'note-'+randomUUID(),characterId:id,characterName:character.character.identity?.characterName||'Character',direction:'to-character',kind:'system',message,createdAt:new Date().toISOString(),readAt:null});}
  return {shipId:ship.id,message};
 });
}
module.exports={axes,popularity,selections,selectShip,state,modifier,setAttitude,recognize,hail,snapshot,recordRoll,applyEnd};
