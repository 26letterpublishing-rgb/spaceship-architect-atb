const crypto=require('node:crypto'),maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power');
const timeline=require('./cleanser-timeline').current;
const CHARGE=120,COOLDOWN=7200,CINEMATIC=Math.ceil(timeline.duration*1000);
const state=ship=>ship.ship.cleanserState||={phase:'idle',remaining:0,cooldown:0,receipts:[]};
const pending=room=>['awaitingRoll','rolling','result','firing'].includes(room.planetaryEvent?.phase);
const mineralKey=ship=>['Dark Phazon','Dark Phaeon'].find(k=>(ship.ship.minerals?.[k]||0)>=1);
function available(room,ship){
 const s=state(ship),item=ship.ship.sicInventory.find(i=>i.id===s.sicId);
 return item&&maps.definition(item.type).planetaryCleanser&&ship.ship.placements.some(p=>p.sicId===item.id)&&stations.online(item)&&!item.impaired&&!item.impairmentPoints&&ship.currentHullHp>0&&!ship.escapedAt&&!ship.dockedIn&&!maps.cloaked(ship)&&ship.ship.warpState?.phase!=='traveling'&&power.output(ship,room.units).en>=power.demand(ship)&&power.output(ship,room.units).au>0;
}
function command(room,unit,body,{outsideCombat=false}={}){
 try{
  const access=stations.access(room,unit,String(body.sicId||''));
  if(!access?.definition.planetaryCleanser||access.blocked)throw Error('Operate an available Planetary Cleanser or Bridge station.');
  if(outsideCombat||room.encounterEndedAt)throw Error('Deploy the ship and a planet in an encounter first.');
  const ship=access.ship,s=state(ship),receipt=String(body.receipt||''),fingerprint=JSON.stringify([unit.id,body.kind,body.targetId||null]);
  if(!/^[\w-]{8,120}$/.test(receipt))throw Error('A command receipt is required.');
  const prior=s.receipts.find(r=>r.id===receipt);if(prior){if(prior.fingerprint!==fingerprint)throw Error('This receipt belongs to another command.');return {ok:true,duplicate:true,ship,text:prior.text};}
  if(pending(room)||room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold||unit.shieldRestabilizing)throw Error('Wait for your turn and finish the current action.');
  let text;
  if(body.kind==='cleanser-abort'){
   if(s.phase!=='charging')throw Error('The weapon is not charging.');
   s.phase='idle';s.remaining=0;text='Planetary Cleanser charge aborted. Dark Phazon was consumed.';
  }else if(body.kind==='cleanser-charge'){
   if(s.phase==='charging'||s.cooldown>0)throw Error(s.cooldown>0?'Planetary Cleanser cooling down: '+Math.ceil(s.cooldown)+' seconds.':'Planetary Cleanser already charging.');
   const planet=room.spaceObjects?.find(o=>o.id===body.targetId&&o.kind==='planet'&&!o.destroyedAt&&!o.collectedBy);
   if(!planet)throw Error('Choose an intact planet placed by the GM.');
   s.sicId=access.id;
   if(!available(room,ship))throw Error('Restore the weapon, sufficient EN and an AU supply; disengage Cloaking or Warp.');
   if(ship.auCommands?.length||(room.units||[]).some(u=>u.delayedAction?.shipOrder?.shipId===ship.id||u.delayedAction?.weaponOrder?.shipId===ship.id||u.delayedAction?.missileOrder?.shipId===ship.id))throw Error('Finish pending ship power and weapon orders first.');
   const mineral=mineralKey(ship);if(!mineral)throw Error('Requires 1 Dark Phazon in ship mineral stores.');
   ship.ship.minerals[mineral]--;Object.assign(s,{phase:'charging',remaining:CHARGE,targetId:planet.id,operatorId:unit.id,startedAt:Date.now(),lastReport:''});
   power.refresh(room);ship.auState.current=0;ship.auState.progress=0;ship.auState.available=0;
   text='Planetary Cleanser charging at '+planet.name+'. All AU diverted for 120 active seconds. Masking 0.';
  }else throw Error('Choose Charge or Abort.');
  s.lastReport=text;s.receipts=[...s.receipts,{id:receipt,fingerprint,text}].slice(-100);
  return {ok:true,ship,text};
 }catch(error){return {ok:false,error:error.message};}
}
function nextEvent(room){return Math.min(Infinity,...(room.starships||[]).map(ship=>ship.ship.cleanserState?.phase==='charging'?Math.max(0,ship.ship.cleanserState.remaining):Infinity));}
function advance(room,seconds){
 if(pending(room))return [];
 const reports=[];
 for(const ship of room.starships||[]){
  const s=ship.ship.cleanserState;if(!s)continue;
  const item=ship.ship.sicInventory.find(i=>i.id===s.sicId);if(item&&(item.impaired||item.impairmentPoints))item.unstable=true;
  s.cooldown=Math.max(0,(s.cooldown||0)-seconds);
  if(s.phase!=='charging')continue;
  const planet=room.spaceObjects?.find(o=>o.id===s.targetId&&o.kind==='planet'&&!o.destroyedAt&&!o.collectedBy);
  if(!available(room,ship)||!planet){s.phase='idle';s.remaining=0;s.lastReport='Planetary Cleanser charge interrupted. Progress lost; Dark Phazon remains spent.';reports.push(s.lastReport);continue;}
  s.remaining=Math.max(0,s.remaining-seconds);
  if(s.remaining>1e-6)continue;
  // A deliberately simulated spectacle, never a hidden 20,000-die rules roll.
  const now=Date.now();room.planetaryEvent={id:crypto.randomUUID(),phase:'awaitingRoll',cinematicVersion:3,createdAt:now,operatorId:s.operatorId,rollController:'player',shipId:ship.id,shipName:ship.title,targetId:planet.id,targetName:planet.name,variant:planet.variant||'ocean',q:planet.q,r:planet.r};
  s.phase='cooldown';s.cooldown=COOLDOWN;s.remaining=0;s.lastReport='Planetary Cleanser charged. Roll 20,000D12 damage against '+planet.name+'.';reports.push(s.lastReport);break;
 }
 return reports;
}
function finish(room,now=Date.now()){
 const e=room.planetaryEvent;if(e?.phase!=='firing'||now<e.endsAt)return false;
 const planet=room.spaceObjects?.find(o=>o.id===e.targetId&&o.kind==='planet');
 if(planet){planet.destroyedAt=now;planet.destroyedBy=e.shipId;}
 e.phase='complete';e.completedAt=now;return true;
}
// The server owns one simulated result. Retries and reconnects never reroll it.
function resolve(room,body,{gm=false,unit=null}={}){
 const e=room.planetaryEvent;
 if(!e||e.id!==body.eventId)throw Error('This Planetary Cleanser sequence has ended.');
 if(!gm&&(unit?.id!==e.operatorId||e.rollController==='gm'))throw Error('The firing operator or GM must resolve this damage roll.');
 if(body.kind==='takeover'){
  if(!gm)throw Error('Only the GM can take over this roll.');
  if(['awaitingRoll','rolling','result'].includes(e.phase))e.rollController='gm';
 }else if(body.kind==='roll'){
  if(e.phase==='awaitingRoll'){
   e.rollController=gm?'gm':'player';e.phase='rolling';e.rolledAt=Date.now();
   e.damage=crypto.randomInt(100000,160001);e.dice=Array.from({length:3},()=>crypto.randomInt(1,13));
  }else if(!['rolling','result','firing','complete'].includes(e.phase))throw Error('The damage roll is unavailable.');
 }else if(body.kind==='shown'){
  if(e.phase==='rolling'){e.phase='result';e.resultShownAt=Date.now();}
  else if(!['result','firing','complete'].includes(e.phase))throw Error('Roll the damage first.');
 }else if(body.kind==='confirm'){
  if(e.phase==='result'){e.phase='firing';e.startedAt=Date.now();e.endsAt=e.startedAt+CINEMATIC;}
  else if(!['firing','complete'].includes(e.phase))throw Error('View the damage result before firing.');
 }else throw Error('Choose a valid damage step.');
 return e;
}
function passTime(ship,minutes){const s=ship.ship.cleanserState;if(s)s.cooldown=Math.max(0,(s.cooldown||0)-minutes*60);}
function end(room){for(const ship of room.starships||[]){const s=ship.ship.cleanserState;if(s?.phase==='charging'){s.phase='idle';s.remaining=0;s.lastReport='Encounter ended; charge cancelled.';}}if(room.planetaryEvent?.phase==='firing')finish(room,room.planetaryEvent.endsAt);else if(pending(room))room.planetaryEvent.phase='cancelled';}
module.exports={CHARGE,COOLDOWN,CINEMATIC,state,pending,mineralKey,command,resolve,nextEvent,advance,finish,passTime,end};
