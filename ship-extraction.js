// Mining and salvage share persisted jobs, but never share or fabricate dice results.
const {randomUUID}=require('node:crypto');
const maps=require('./ship-map-core'),hex=require('./ship-distances'),power=require('./ship-power');
const state=s=>s.ship.extractionState||={jobs:{},receipts:[],events:[]};
const jobs=room=>(room.starships||[]).flatMap(ship=>Object.values(ship.ship.extractionState?.jobs||{}).map(job=>({ship,job})));
const point=(room,id)=>hex.positions(room.starships,room.shipPositions||[]).find(p=>p.id===id);
const range=(room,ship,target)=>hex.hexDistance(point(room,ship.id),target.kind?target:point(room,target.id));
const wreck=s=>Boolean(s?.destroyedAt||s?.currentHullHp===0)&&!s?.ship?.salvagedAt;
function eligible(ship){return maps.installedItems(ship).filter(i=>!i.impaired&&!(i.impairmentPoints>0)&&i.status!=='impaired'&&i.status!=='destroyed'&&!i.pendingDisposition);}
function targets(room,ship,type){return type==='mining-laser'?(room.spaceObjects||[]).filter(o=>o.kind==='asteroid'&&!o.destroyedAt&&o.quantity>0&&range(room,ship,o)<=1).map(o=>({id:o.id,name:o.name,uses:o.quantity})):(room.starships||[]).filter(s=>s!==ship&&wreck(s)&&range(room,ship,s)<=maps.sensorStats(ship).range).map(s=>({id:s.id,name:s.title,eligible:eligible(s).length}));}
function reason(room,ship,job){const item=maps.installedItems(ship).find(i=>i.id===job.sicId);if(!item||item.status==='destroyed'||item.impairmentPoints>=4||ship.currentHullHp===0||ship.destroyedAt)return {cancel:'Extraction equipment destroyed'};
 if(job.type==='vulture-drone'&&(item.impaired||item.impairmentPoints>0||item.status==='impaired'))return {cancel:'Vulture Drone destroyed by impairment'};
 const target=job.type==='mining-laser'?(room.spaceObjects||[]).find(o=>o.id===job.targetId):(room.starships||[]).find(s=>s.id===job.targetId);
 if((job.phase==='working'||job.type==='vulture-drone')&&(!target||job.type==='vulture-drone'&&!wreck(target)))return {cancel:'Target no longer available'};
 if(!maps.operational(item)||item.bootRemaining>0||item.impaired||item.impairmentPoints>0||item.status==='impaired')return {pause:'Equipment offline or impaired'};
 if(power.output(ship,room.units||[]).en<power.demand(ship))return {pause:'Insufficient EN'};
 if(ship.hackedSystems?.some(h=>h.bridge||h.sicId===job.sicId))return {pause:'Control link interrupted'};
 if(job.type==='vulture-drone'&&job.position&&hex.hexDistance(job.position,point(room,job.targetId))>.5)return {pause:'Drone displaced from the wreck'};
 if(job.phase==='working'&&range(room,ship,target)>(job.type==='mining-laser'?1:maps.sensorStats(ship).range))return {pause:'Target outside operating range'};
 return {};
}
function notify(room,campaign,ship,text){const event={id:randomUUID(),text,at:Date.now()};state(ship).events=[...state(ship).events,event].slice(-60);ship.ship.crewRoomState||={rooms:{},receipts:[],down:{}};ship.ship.crewRoomState.report=event;for(const characterId of ship.crewCharacterIds||[]){if(!campaign)continue;(campaign.privateNotes||=[]).push({id:randomUUID(),characterId,kind:'crew-room',direction:'to-character',message:text,createdAt:new Date().toISOString(),readAt:null});}}
const chart=[ [4,'Endernium',[4,4]], [5,'Necronium',[4,6]], [6,'Phazon',[6,6]], [8,'Drakkonite',[6,8]], [10,'Mirium',[8,8]], [12,'Argol',[8,10]], [15,'Paradon',[10,10]], [18,'Crystilium',[10,12]], [22,'Ragnaron',[12,12]], [26,'Transpherion',[6,6],2], [30,'Xpidinium',[8,8],2], [34,'Umbrexium',[10,10],2], [39,'Dianium',[12,12],2], [44,'Zennium',[8,8],5], [49,'Rupium',[10,10],5], [59,'Crixium',[12,12],5], [69,'Zeltexa',[10,10],10], [79,'Magnesium',[12,12],10], [100,'Iron',[12,12],30] ];
function spec(job){let sides,label;
 if(job.phase==='success'){sides=[10];label='Mining: roll under '+job.cutoff;}
 if(job.phase==='chart'){sides=[10,10];label='Random Mineral Chart: tens, then ones (10 means zero)';}
 if(job.phase==='mythic'){sides=[job.mythicDie];label='Mythic Mineral Chart';}
 if(job.phase==='quantity'){sides=job.quantityDice;label=job.mineral+' quantity';}
 if(job.phase==='salvage'){sides=[10,10,10];label='Vulture Drone: recovered component';}
 return sides?{attributeKey:'dexterity',attributeLabel:label,skill:'Engineering',sides,bonus:0,difficulty:null,difficultyLabel:label,exertionAvailable:0}:null;
}
function clearRequest(room,job){for(const u of room.units||[])u.pendingShipRolls=(u.pendingShipRolls||[]).filter(r=>r.extractionRoll?.jobId!==job.id);}
function enqueue(room,ship,job){if(room.outsideCombat||!spec(job))return;const unit=room.units?.find(u=>u.id===job.operatorId);if(!unit||unit.currentHp<=0||unit.vacuum)return;
 if(!unit.pendingShipRolls?.some(r=>r.extractionRoll?.jobId===job.id))(unit.pendingShipRolls||=[]).push({id:randomUUID(),label:spec(job).attributeLabel,extractionRoll:{shipId:ship.id,sicId:job.sicId,jobId:job.id,phase:job.phase},rollSpec:spec(job)});
}
function advance(room,campaign,seconds){if(!Number.isFinite(seconds)||seconds<0)return false;let changed=false;
 for(const {ship,job}of jobs(room)){if(['complete','cancelled'].includes(job.phase))continue;const block=reason(room,ship,job);
  if(block.cancel){job.phase='cancelled';job.result=block.cancel;clearRequest(room,job);notify(room,campaign,ship,block.cancel+'.');changed=true;continue;}
  if(job.paused!==(block.pause||'')){job.paused=block.pause||'';changed=true;}if(job.paused)continue;
  if(job.phase==='working'){const step=Math.min(job.remaining,seconds);job.remaining-=step;changed=step>0||changed;
   if(job.remaining<=1e-7){if(job.type==='mining-laser'){const target=room.spaceObjects.find(o=>o.id===job.targetId);job.cutoff=target.miningTarget||6;target.quantity--;if(target.quantity<=0)room.spaceObjects.splice(room.spaceObjects.indexOf(target),1);job.phase='success';}else{job.candidates=eligible(room.starships.find(s=>s.id===job.targetId)).map(i=>({id:i.id,type:i.type,blueprintType:i.blueprintType}));if(!job.candidates.length){job.phase='cancelled';job.result='No undamaged installed SICs remain';notify(room,campaign,ship,job.result+'.');continue;}job.phase='salvage';}notify(room,campaign,ship,job.targetName+': extraction finished. Resolve the recovery dice.');changed=true;}
  }enqueue(room,ship,job);
 }return changed;
}
function resolve(room,ship,job,phase,values,campaign){if(job.phase!==phase||!spec(job))throw Error('This extraction roll is no longer pending.');const s=spec(job);if(!Array.isArray(values)||values.length!==s.sides.length||values.some((n,i)=>!Number.isInteger(n)||n<1||n>s.sides[i]))throw Error('Roll the displayed dice before submitting.');
 let text;
 if(phase==='success'){if(values[0]<job.cutoff){job.phase='chart';text='Mining successful. Roll the Random Mineral Chart.';}else{job.phase='complete';text='No minerals recovered from this attempt.';}}
 else if(phase==='chart'){const n=(values[0]%10)*10+values[1]%10||100;if(n<=3){job.mythicDie=[6,8,10][n-1];job.phase='mythic';text='Mythic mineral vein!';}else{const row=chart.find(r=>n<=r[0]);job.mineral=row[1];job.quantityDice=row[2];job.multiplier=row[3]||1;job.phase='quantity';text='Found '+job.mineral+'. Roll quantity.';}}
 else if(phase==='mythic'){const n=values[0];job.mineral=n===1?'Aethion':n<=3?'Infinium':n<=6?'Carmot':'Dark Phazon';job.quantityDice=[n<=6?4:6];job.quantityHalf=n===1;job.quantitySubtract=n<=3?1:0;job.phase='quantity';text='Found '+job.mineral+'. Roll quantity.';}
 else if(phase==='quantity'){const sum=values.reduce((a,b)=>a+b,0),quantity=Math.max(0,(job.quantityHalf?Math.ceil(sum/2):sum)*(job.multiplier||1)-(job.quantitySubtract||0));ship.ship.minerals||={};ship.ship.minerals[job.mineral]=Number(ship.ship.minerals[job.mineral]||0)+quantity;job.phase='complete';text=quantity+' '+job.mineral+' added to ship storage.';}
 else if(phase==='salvage'){const target=room.starships.find(t=>t.id===job.targetId);if(!wreck(target))throw Error('This wreck has already been salvaged or is gone.');const candidates=job.candidates.filter(c=>eligible(target).some(i=>i.id===c.id));if(!candidates.length)throw Error('No undamaged SIC remains.');const n=(values[0]%10)*100+(values[1]%10)*10+values[2]%10,limit=Math.floor(1000/candidates.length)*candidates.length;if(n>=limit){text='Roll again to select a component fairly.';}else{if(ship.ship.sicInventory.length>=400)throw Error('Ship SIC storage is full. Make space before recovering the component.');const item=candidates[n%candidates.length];ship.ship.sicInventory.push({id:'salvaged-'+job.id,type:item.type,...(item.blueprintType?{blueprintType:item.blueprintType}:{}),storage:true,salvaged:true,salvageSource:target.id});ship.buildRevision=(ship.buildRevision||0)+1;target.ship.salvagedAt=Date.now();job.phase='complete';text=maps.definition(item.type).name+' salvaged into storage. The wreck has been exhausted.';}}
 clearRequest(room,job);job.result=text;notify(room,campaign,ship,text);enqueue(room,ship,job);return {text,spent:false};
}
function command(room,ship,unit,body,campaign){const data=state(ship),fingerprint=JSON.stringify([unit.id,body.kind,body.sicId,body.targetId,body.jobId,body.phase,body.diceResults]),old=data.receipts.find(r=>r.id===body.requestId);if(old){if(old.fingerprint!==fingerprint)throw Error('Receipt belongs to another extraction command.');return {...old.result,duplicate:true};}
 const item=maps.installedItems(ship).find(i=>i.id===body.sicId&&['mining-laser','vulture-drone'].includes(i.type));if(!item)throw Error('Install a Mining Laser or Vulture Drone.');let result;
 const job=data.jobs[item.id];
 if(body.kind==='extract-cancel'){if(!job||job.id!==body.jobId)throw Error('Job no longer exists.');job.phase='cancelled';clearRequest(room,job);result={text:'Extraction cancelled.',spent:false};}
 else if(body.kind==='extract-roll'){if(!job||job.id!==body.jobId)throw Error('Job no longer exists.');result=resolve(room,ship,job,body.phase,body.diceResults,campaign);}
 else if(body.kind==='extract-start'){if(job&&!['complete','cancelled'].includes(job.phase))throw Error('Finish or cancel the current job first.');if(!room.outsideCombat&&room.activeId!==unit.id)throw Error('Wait for your turn.');const target=targets(room,ship,item.type).find(t=>t.id===body.targetId);if(!target)throw Error(item.type==='mining-laser'?'Move within one hex of an asteroid.':'Choose a wreck within sensor range.');const seconds=item.type==='mining-laser'?14400:240;const next={id:randomUUID(),sicId:item.id,type:item.type,targetId:target.id,targetName:target.name,operatorId:unit.id,characterId:unit.characterId,seconds,remaining:seconds,phase:'working'};const block=reason(room,ship,next);if(block.cancel||block.pause)throw Error(block.cancel||block.pause);if(item.type==='vulture-drone')next.position={...point(room,target.id)};data.jobs[item.id]=next;result={text:item.type==='mining-laser'?'Mining started: four hours per attempt.':'Vulture Drone launched: 240 active seconds.',spent:!room.outsideCombat};}
 else throw Error('Unknown extraction command.');data.receipts.push({id:body.requestId,fingerprint,result});data.receipts=data.receipts.slice(-256);return result;
}
function inspect(room,ship,sicId){const item=maps.installedItems(ship).find(i=>i.id===sicId),job=state(ship).jobs[sicId];return {targets:targets(room,ship,item?.type),job:job?{...job,candidates:undefined,rollSpec:spec(job)}:null};}
module.exports={state,jobs,targets,eligible,reason,advance,command,inspect,resolve,spec,wreck};
