const stations = require('./station-access');
const maps = require('./ship-map-core');
const navigation = require('./ship-navigation');
const sensors = require('./ship-sensors');
const distances = require('./ship-distances');
const cooperation = require('./ship-cooperation');
const power = require('./ship-power');
const delays = require('./delay-rules');
const ROLL_ACTIONS = ['area', 'hex', 'analysis', 'evade', 'ram', 'skim'];
const names = { hail:'Hail Ship', team:'Team Execution', calculation:'Preemptive Calculation', evade:'Evasive Maneuvers', ram:'Ram', skim:'Skim' };
const skill = (unit, action) => Math.max(0, Number((['area','hex','analysis'].includes(action) ? unit.sensorSkill : unit.pilotSkill) ?? (unit.team === 'npc' ? unit.mentalSkill : 0)) || 0);
const mentalSkill = (unit,key) => Math.max(0,Number(unit[key]??(unit.team==='npc'?unit.mentalSkill:0))||0);
const position = (room, id) => distances.positions(room.starships, room.shipPositions).find(p => p.id === id);
function hex(p) {
  const x = Math.round(p.q), z = Math.round(p.r), y = Math.round(-p.q-p.r);
  const dx = Math.abs(x-p.q), dz = Math.abs(z-p.r), dy = Math.abs(y+p.q+p.r);
  return dx > dy && dx > dz ? {q:-y-z,r:z} : dz > dy ? {q:x,r:-x-y} : {q:x,r:z};
}
const sameHex = (room, a, b) => {const first=position(room,a.id),second=position(room,b.id);return Boolean(first&&second&&distances.hexDistance(hex(first),hex(second))===0);};
function report(ship, text, extra = {}) {
  const data = sensors.knowledge(ship);
  data.reports = [{text, ...extra, at:new Date().toISOString()}, ...data.reports].slice(0,30);
}
function validateTrigger(room,ship,t){
  const data=cooperation.state(ship),enemy=room.starships.find(s=>s.id===t?.targetId&&s.id!==ship.id);
  if(data.armed||room.units.some(u=>u.location?.starshipId===ship.id&&[u.delayedAction?.commandOrder,u.delayedAction?.shipOrder,u.delayedAction?.sensorOrder].some(o=>o?.trigger)))return {ok:false,error:'Only one conditional order may be armed per ship.'};
  if(!enemy||!sensors.knowledge(ship).reports.some(r=>r.analysis&&r.targetId===enemy.id))return {ok:false,error:'Systems Analysis of the triggering ship is required.'};
  if(!['movement','distance','hex','range'].includes(t.kind))return {ok:false,error:'Choose a movement trigger.'};
  if(['distance','range'].includes(t.kind)&&(!Number.isFinite(t.distance)||t.distance<=0||t.distance>10000))return {ok:false,error:'Enter a positive trigger distance.'};
  if(t.kind==='hex'&&(!t.hex||![t.hex.q,t.hex.r].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000)))return {ok:false,error:'Choose a trigger hex.'};
  if((ship.auState?.current||0)-(ship.auCommands||[]).reduce((sum,c)=>sum+(Number(c.cost)||0),0)<2)return {ok:false,error:'A conditional order requires 2 extra AU.'};
  return {ok:true,trigger:{kind:t.kind,targetId:enemy.id,distance:t.distance,hex:t.hex?{q:t.hex.q,r:t.hex.r}:null}};
}
function armExternal(room,unit,system){
  const delayed=unit.delayedAction,key=system==='pilot'?'shipOrder':'sensorOrder',order=delayed?.[key];
  if(!order?.trigger)return;
  unit.delayedAction=null;
  const seat=stations.station(room,unit),ship=room.starships.find(s=>s.id===order.shipId);
  if(!ship)return;
  if(!seat||seat.ship.id!==ship.id||(system==='sensor'?seat.key!==order.station:seat.cell.sicId!==order.sicId))return report(ship,'Conditional input interrupted: operator left the console.');
  const data=cooperation.state(ship);
  if(data.armed||!power.spend(room,ship.id,2))return report(ship,'Conditional order cancelled: another order is armed or 2 AU are unavailable.');
  data.armed={system,delayed,order,unitId:unit.id,location:{...unit.location},remaining:12,traveled:0};
  report(ship,'Conditional order armed for 12 combat seconds (2 AU spent).');
}
function queue(room, unit, body) {
  const seat = stations.station(room, unit);
  if (!seat || !maps.definition(seat.cell.type).bridge) return {ok:false,error:'Remain at an operational cockpit or bridge.'};
  const ship = seat.ship, data = cooperation.state(ship), receipt = String(body.requestId || '');
  if (!/^[\w-]{8,100}$/.test(receipt)) return {ok:false,error:'Invalid command receipt.'};
  if (data.receipts.includes(receipt)) return {ok:true,duplicate:true};
  if(body.kind==='evadeStep'){
    const step=data.evadeStep,target=step&&room.starships.find(s=>s.id===step.attackerId),destination=body.destination;
    if(!step||step.unitId!==unit.id||!target||!destination||![destination.q,destination.r].every(Number.isInteger))return {ok:false,error:'No successful evasion step is available for this pilot.'};
    const start=position(room,ship.id),attacker=position(room,target.id);
    if(distances.hexDistance(start,destination)>1+1e-8||distances.hexDistance(start,destination)<1e-8||distances.hexDistance(destination,attacker)<distances.hexDistance(start,attacker)-1e-8)return {ok:false,error:'Move up to one Unit, without moving closer to the attacker.'};
    room.shipPositions=distances.positions(room.starships,room.shipPositions).map(p=>p.id===ship.id?{...p,...destination}:p);
    if(ship.navigation?.phase==='powered'){
      const length=distances.hexDistance(destination,ship.navigation.target);
      if(length<1e-8){ship.navigation.phase='stopped';ship.navigation.remaining=0;}
      else ship.navigation.direction={q:(ship.navigation.target.q-destination.q)/length,r:(ship.navigation.target.r-destination.r)/length};
    }
    data.evadeStep=null;data.receipts=[...data.receipts,receipt].slice(-256);
    return {ok:true,free:true,ship};
  }
  if (['accept','decline','endCall'].includes(body.kind)) {
    const call = data.calls.find(c => c.id === body.callId);
    if (!call || (body.kind !== 'endCall' && call.status !== 'incoming')) return {ok:false,error:'That call is no longer awaiting an answer.'};
    const other = room.starships.find(s => s.id === call.shipId);
    const status = body.kind === 'accept' ? 'connected' : 'closed';
    call.status = status;
    const paired = other && cooperation.state(other).calls.find(c => c.id === call.id);
    if (paired) paired.status = status;
    const message=status==='connected'?`Hail answered: ${ship.title} and ${other?.title||call.title} are connected.`:`Hail ended: ${ship.title}.`;
    report(ship,message);if(other)report(other,message);
    data.receipts = [...data.receipts,receipt].slice(-256);
    return {ok:true,free:true,ship};
  }
  if (!names[body.kind]) return {ok:false,error:'Choose a ship operation.'};
  if (room.activeId !== unit.id || unit.consoleHold || unit.delayedAction || unit.delayTimer || unit.timedAction || unit.shieldRestabilizing || room.starships.some(s => s.auCommands?.some(c => c.unitId === unit.id))) return {ok:false,error:'Wait for your turn and finish the current action.'};
  if (['team','calculation'].includes(body.kind) && !ROLL_ACTIONS.includes(body.preparedAction)) return {ok:false,error:'Choose the roll this preparation supports.'};
  if(body.kind==='team'&&data.preparations.some(p=>p.kind==='team'&&p.unitId===unit.id&&p.action===body.preparedAction&&p.remaining>0))return {ok:false,error:'You are already prepared to assist that roll.'};
  if (body.kind === 'calculation' && Math.floor(mentalSkill(unit,'mathematicsSkill')) < 1) return {ok:false,error:'Mathematics 1 or higher is required for a lasting calculation.'};
  if (['evade','ram','skim'].includes(body.kind) && !navigation.access(room,unit)) return {ok:false,error:'Operational engines and thrusters are required.'};
  sensors.refresh(room);
  const target = room.starships.find(s => s.id === body.targetId && s.id !== ship.id);
  if (['hail','ram','skim'].includes(body.kind) && (!target || sensors.knowledge(ship).contacts[target.id]?.level !== 'detected')) return {ok:false,error:'Choose a detected ship.'};
  if (['ram','skim'].includes(body.kind) && !body.trigger && !sameHex(room,ship,target)) return {ok:false,error:'Both ships must occupy the same hex.'};
  let trigger=null;
  if(body.trigger){
    const checked=validateTrigger(room,ship,body.trigger);if(!checked.ok)return checked;trigger=checked.trigger;
  }
  const disclosed = body.disclosedPosition;
  if (body.kind === 'hail' && (!disclosed || ![disclosed.q,disclosed.r].every(Number.isInteger) || distances.hexDistance(position(room,ship.id),disclosed) > 5)) return {ok:false,error:'Choose your disclosed location within 5 Units of your ship.'};
  let settings = navigation.inputSettings(room,unit);
  if(['hail','team','calculation'].includes(body.kind)){
    const tier=Number(seat.cell.type.split('-').at(-1))||1,rating=Math.floor(mentalSkill(unit,'computerSkill'));
    settings={base:8,factors:{Quality:Math.min(4,Math.ceil(tier/2)),Performance:0,Efficiency:0,Situation:0,Execution:0,Ingenuity:rating>=6?4:rating>=5?3:rating>=3?2:rating>=1?1:0}};
    settings.rate=delays.calculate(settings).rate;
  }
  unit.delayedAction = {id:`command-${receipt}`,kind:'action',label:names[body.kind],rate:settings.rate,remaining:100,total:100,consumeTurn:true,resolving:false,settings,
    commandOrder:{kind:body.kind,shipId:ship.id,station:seat.key,targetId:target?.id,preparedAction:body.preparedAction,disclosedPosition:disclosed ? {q:disclosed.q,r:disclosed.r} : null,trigger,receipt}};
  data.receipts = [...data.receipts,receipt].slice(-256);
  return {ok:true,ship};
}
function resolveInput(room, unit, rollDie, triggeredOrder = null) {
  const order = triggeredOrder || unit.delayedAction?.commandOrder;
  if (!order) return;
  if(!triggeredOrder)unit.delayedAction = null;
  const ship = room.starships.find(s => s.id === order.shipId), seat = stations.station(room,unit);
  if (!ship) return;
  if (!seat || seat.key !== order.station) return report(ship,'Command input interrupted: operator or console unavailable.');
  const data = cooperation.state(ship), target = room.starships.find(s => s.id === order.targetId);
  if(order.trigger&&!triggeredOrder){
    if(data.armed||!power.spend(room,ship.id,2))return report(ship,'Conditional order cancelled: another order is armed or 2 AU are unavailable.');
    data.armed={order,unitId:unit.id,location:{...unit.location},remaining:12,traveled:0};
    return report(ship,'Conditional order armed for 12 combat seconds (2 AU spent).');
  }
  if (['team','calculation'].includes(order.kind)) {
    data.preparations.push({kind:order.kind,action:order.preparedAction,unitId:unit.id,skill:skill(unit,order.preparedAction),remaining:order.kind === 'team' ? 12 : Math.floor(mentalSkill(unit,'mathematicsSkill'))*12});
    return report(ship,`${unit.characterName}: ${names[order.kind]} prepared for ${order.preparedAction}.`);
  }
  if (order.kind === 'hail') {
    if (!target || sensors.knowledge(ship).contacts[target.id]?.level !== 'detected') return report(ship,'Hail cancelled: contact lost.');
    if(distances.hexDistance(position(room,ship.id),order.disclosedPosition)>5)return report(ship,'Hail cancelled: disclosed position is now more than 5 Units from the ship.');
    const own = {id:order.receipt,shipId:target.id,title:target.title,status:'outgoing'};
    data.calls = [own,...data.calls].slice(0,20);
    cooperation.state(target).calls = [{id:order.receipt,shipId:ship.id,title:ship.title,status:'incoming',disclosedPosition:order.disclosedPosition},...cooperation.state(target).calls].slice(0,20);
    return report(target,`Incoming hail from ${ship.title}.`);
  }
  if (!navigation.access(room,unit)) return report(ship,'Ship maneuver cancelled: propulsion unavailable.');
  const propulsion = maps.propulsion(ship);
  const result = cooperation.roll(room,ship,unit,order.kind,Array(propulsion.evadeCount).fill(propulsion.evadeDie),skill(unit,order.kind),rollDie,sensors.fusedTotal);
  if (order.kind === 'evade') {
    data.evasions ||= [];
    data.evasions.push({defense:Math.max(sensors.masking(room,ship),result.total+propulsion.hsm),unitId:unit.id,remaining:20});
    return report(ship,`Evasive Maneuvers active: Defense ${data.evasions.at(-1).defense} against all attacks for 20 combat seconds.`,result);
  }
  if (!target || !sameHex(room,ship,target)) return report(ship,'Collision cancelled: ships no longer occupy the same hex.');
  const defenses = cooperation.state(target).evasions ||= [];
  const prepared=defenses.filter(e=>e.remaining==null||e.remaining>0).sort((a,b)=>b.defense-a.defense)[0],defense=sensors.defense(room,target);
  if (result.total < defense) {
    if(prepared)cooperation.state(target).evadeStep={unitId:prepared.unitId,attackerId:ship.id};
    return report(ship,`${names[order.kind]} missed.`,result);
  }
  // Snapshot both conditions before simultaneous impact; never let processing order change damage.
  const a = {h:ship.currentHullHp || 0,s:ship.currentShieldHp || 0}, b = {h:target.currentHullHp || 0,s:target.currentShieldHp || 0};
  function impact(s, damage, hullOverflow) {
    let left = damage;
    const installed=new Set((s.ship?.placements||[]).map(p=>p.sicId));
    for (const [id,system] of Object.entries(s.shieldSystems || {})) {
      if(!installed.has(id)||!stations.online(s.ship?.sicInventory?.find(item=>item.id===id)))continue;
      const absorbed = Math.min(Math.max(0,system.hp || 0),left);
      system.hp -= absorbed; left -= absorbed;
      if(!system.hp){system.protection=0;system.protectionRemaining=0;system.regeneration=0;}
    }
    if(!s.shieldSystems){const absorbed=Math.min(Math.max(0,s.currentShieldHp||0),left);s.currentShieldHp-=absorbed;left-=absorbed;}
    if (hullOverflow) s.currentHullHp = Math.max(0,(s.currentHullHp || 0)-left);
  }
  if (order.kind === 'ram') {
    impact(ship,b.h+b.s+(b.s>a.s?Math.floor(b.s*.25):0),true);
    impact(target,a.h+a.s+(a.s>b.s?Math.floor(a.s*.25):0),true);
    const destroyedA = ship.currentHullHp <= 0, destroyedB = target.currentHullHp <= 0;
    if (destroyedA) impact(target,Math.floor(a.h*.25),true);
    if (destroyedB) impact(ship,Math.floor(b.h*.25),true);
  } else {
    impact(ship,b.s,false); impact(target,a.s,false);
    if (a.s > 0 && b.s >= a.s) impact(target,Math.floor(a.s*.25),true);
    if (b.s > 0 && a.s >= b.s) impact(ship,Math.floor(b.s*.25),true);
  }
  report(ship,`${names[order.kind]} connected with ${target.title}.`,result);
  report(target,`${ship.title} completed a ${names[order.kind].toLowerCase()} against this ship.`);
}
function advance(room, seconds, before = null, rollDie = sides => require('node:crypto').randomInt(1,sides+1)) {
  for (const ship of room.starships || []) {
    cooperation.advance(ship,seconds);
    const data=cooperation.state(ship),armed=data.armed;
    data.evasions=(data.evasions||[]).map(e=>({...e,remaining:Math.max(0,(e.remaining??20)-Math.max(0,seconds))})).filter(e=>e.remaining>0);
    if(!armed)continue;
    const start=before?.find(p=>p.id===armed.order.trigger.targetId),end=position(room,armed.order.trigger.targetId);
    let triggered=false;
    if(start&&end&&seconds>=0){
      const fraction=seconds>0?Math.min(1,armed.remaining/seconds):1,stop={q:start.q+(end.q-start.q)*fraction,r:start.r+(end.r-start.r)*fraction};
      const traveled=distances.hexDistance(start,stop);armed.traveled+=traveled;
      const trigger=armed.order.trigger;
      if(trigger.kind==='range'){
        const ownStart=before?.find(p=>p.id===ship.id)||position(room,ship.id),ownEnd=position(room,ship.id),steps=Math.max(1,Math.ceil((traveled+distances.hexDistance(ownStart,ownEnd))*4));
        for(let i=0;i<=steps&&!triggered;i++){const f=i/steps;triggered=distances.hexDistance({q:start.q+(stop.q-start.q)*f,r:start.r+(stop.r-start.r)*f},{q:ownStart.q+(ownEnd.q-ownStart.q)*f,r:ownStart.r+(ownEnd.r-ownStart.r)*f})<=trigger.distance;}
      }
      if(traveled>1e-8){
        if(trigger.kind==='movement')triggered=true;
        if(trigger.kind==='distance')triggered=armed.traveled>=trigger.distance;
        if(trigger.kind==='hex'){
          const steps=Math.max(1,Math.ceil(traveled*4));
          for(let i=1;i<=steps&&!triggered;i++)triggered=distances.hexDistance(hex({q:start.q+(stop.q-start.q)*i/steps,r:start.r+(stop.r-start.r)*i/steps}),trigger.hex)===0;
        }
      }
    }
    armed.remaining-=seconds;
    if(triggered){
      data.armed=null;
      const unit=room.units.find(u=>u.id===armed.unitId);
      if(unit){
        if((armed.system==='sensor'&&['area','hex','analysis'].includes(armed.order.kind))||(!armed.system&&['evade','ram','skim'].includes(armed.order.kind))){
          unit.pendingShipRolls ||= [];
          unit.pendingShipRolls.push({id:`trigger-${armed.order.receipt||armed.delayed?.id||unit.id}-${Date.now()}`,label:armed.delayed?.label||names[armed.order.kind],armed});
          report(ship,`${unit.characterName}: conditional order triggered; roll required.`);
          continue;
        }
        const operator={...unit,defeatedAt:null,location:armed.location,timedAction:null};
        if(armed.system){
          operator.delayedAction=armed.delayed;
          if(armed.system==='pilot'){
            const result=navigation.resolveInput(room,operator);report(ship,result.ok?'Conditional movement launched.':result.error);
          }else{
            operator.queuedEffects=unit.queuedEffects ||= [];
            sensors.resolveInput(room,operator,rollDie);
          }
        }else resolveInput(room,operator,rollDie,armed.order);
      }
    }else if(armed.remaining<=0){data.armed=null;report(ship,'Conditional order expired without its trigger.');}
  }
}
module.exports = {queue,resolveInput,advance,sameHex,ROLL_ACTIONS,validateTrigger,armExternal};
