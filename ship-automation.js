// Server-owned policy. Candidates still pass through the ordinary action validators.
const maps=require('./ship-map-core'),stations=require('./station-access'),locks=require('./ship-locks'),sensors=require('./ship-sensors'),weapons=require('./ship-weapons'),distances=require('./ship-distances'),ammo=require('./missile-ammunition');
const active=u=>Boolean(!u?.automationSuspended&&u?.automationMode&&u.automationMode!=='off');
function free(room,unit,loc){return !room.units.some(other=>other!==unit&&[other.location,other.timedAction?.stationOnArrival&&(other.travelRoute?.at(-1)||other.timedAction.destination)].some(p=>p&&p.starshipId===loc.starshipId&&p.square===loc.square&&p.mesh===loc.mesh));}
function seats(ship){return [...maps.buildLayout(ship.ship).footprint].flatMap(([square,cell])=>!cell.exterior&&!cell.blocked&&stations.online(cell.item)?cell.stations.filter(s=>s.x===cell.column&&s.y===cell.row).map(s=>({starshipId:ship.id,sicId:cell.sicId,square,mesh:s.mesh,stationed:true,bridge:!!maps.definition(cell.type).bridge})):[]);}
function move(room,unit,ship,loc,station=true){
  const route=maps.meshRoute(maps.buildLayout(ship.ship),unit.location,loc);if(!route)return null;
  if(!route.length)return station?{action:'playerCombatAction',kind:'enterStation',stationName:maps.definition(ship.ship.sicInventory.find(i=>i.id===loc.sicId)?.type).name}:null;
  return {action:'playerCombatAction',kind:'move',route:(route.length?route:[loc]).map(p=>({...p,environment:'starship',starshipId:ship.id,sicId:loc.sicId})),stationOnArrival:station,stationSlot:loc.mesh,stationName:maps.definition(ship.ship.sicInventory.find(i=>i.id===loc.sicId)?.type).name};
}
// Search uses only the ship's own state and disclosed contacts, never hidden positions.
function searchCandidates(room,unit,ship,access,detectedTargets){
  const nav=require('./ship-navigation'),known=sensors.knowledge(ship),origin=require('./ship-targets').point(room,ship.id);
  if(!known.automationSearch||known.automationSearch.encounterId!==room.encounterId)known.automationSearch={encounterId:room.encounterId,origin:{q:origin.q,r:origin.r},legs:0};
  const memory=known.automationSearch;
  unit.automationSearchReason='';
  if(ship.navigation?.phase==='powered'||ship.navigation?.phase==='drift'||room.units.some(u=>u.delayedAction?.shipOrder?.shipId===ship.id)){
    unit.automationSearchReason='Waiting for the current ship route to finish.';return [];
  }
  const contacts=Object.values(known.contacts).filter(c=>c.position&&['unknown','last-known'].includes(c.level));
  const sensorsHere=access.filter(a=>a.definition.sensor);
  const scan=known.lastScan,same=scan&&scan.encounterId===room.encounterId&&distances.hexDistance(scan.origin,origin)<.01&&scan.range===(sensors.installed(ship)?.range||0);
  if(!detectedTargets.length&&!same&&!room.units.some(u=>u.delayedAction?.sensorOrder?.shipId===ship.id)&&!(known.pulse?.remaining>0))return sensorsHere.map(a=>({action:'sensorCommand',kind:'area',sicId:a.id}));
  if(room.units.some(u=>u.delayedAction?.sensorOrder?.shipId===ship.id)||known.pulse?.remaining>0){unit.automationSearchReason='Waiting for the current sensor sweep.';return [];}
  const disclosed=[...detectedTargets.map(t=>t.contact),...contacts].sort((a,b)=>distances.hexDistance(origin,a.position)-distances.hexDistance(origin,b.position)||String(a.id).localeCompare(String(b.id)));
  const contact=disclosed[0];
  if(!detectedTargets.length&&contacts.length&&memory.legs>=12){unit.automationSearchReason='Unknown-contact search exhausted. Choose a new course or improve sensors.';return [];}
  if(contact&&contact.level==='unknown'&&!(contact.uncertainty>1)&&sensorsHere.length){
    const hex=distances.roundHex(contact.position),key=JSON.stringify([hex,origin,sensors.installed(ship)?.range]);
    if(memory.hexScan!==key){return sensorsHere.map(a=>({action:'sensorCommand',kind:'hex',sicId:a.id,hex,automationSearchCommit:{hexScan:key}}));}
  }
  const pilot=nav.access(room,unit);
  if(!pilot||pilot.speed<=0){unit.automationSearchReason='Cannot search or approach: an operational pilot station, thrusters and positive Move Speed are required.';return [];}
  let destination;
  if(contact&&distances.hexDistance(origin,contact.position)>1.5){
    const d=distances.hexDistance(origin,contact.position),n=Math.min(4,Math.max(0,d-1))/d;
    destination=distances.roundHex({q:origin.q+(contact.position.q-origin.q)*n,r:origin.r+(contact.position.r-origin.r)*n});
  }else if(detectedTargets.length){unit.automationSearchReason='No usable attack: check weapon access, lock, ammunition and available EN/AU.';return [];}
  else{
    if(memory.legs>=6){unit.automationSearchReason='Search completed without an engageable contact. Set a new course or improve sensors; GM control remains available.';return [];}
    const phase=[...ship.id].reduce((n,c)=>n+c.charCodeAt(0),0)%6,dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],dir=dirs[(phase+memory.legs)%6];
    // Short legs avoid the existing post-route drift (which starts beyond five units).
    const radius=4;
    destination={q:memory.origin.q+dir[0]*radius,r:memory.origin.r+dir[1]*radius};
  }
  if(![destination.q,destination.r].every(n=>Number.isInteger(n)&&Math.abs(n)<=10000)){unit.automationSearchReason='Search route reaches the map coordinate limit. Choose a course manually.';return [];}
  return [{action:'playerCombatAction',kind:'moveStarship',destination,boosts:[],automationSearchCommit:{legs:memory.legs+1}}];
}
function acceptedSearch(room,unit,candidate){
  if(!candidate.automationSearchCommit)return;
  const ship=room.starships.find(s=>s.id===unit.location?.starshipId);if(!ship)return;
  Object.assign(sensors.knowledge(ship).automationSearch,candidate.automationSearchCommit);
}
// Ordinary crew use only their own systems and disclosed contact conditions.
// These are inexpensive prechecks, not replacements for authoritative validators.
function npcShipCandidates(room,unit,ship){
  if(ship.currentHullHp<=0||ship.destroyedAt||ship.escapedAt||ship.ship.warpState?.phase==='traveling')return [];
  const power=require('./ship-power'),points=i=>Math.max(Number(i.impairmentPoints)||0,i.impaired||i.status==='impaired'?1:0);
  const access=stations.consoles(room,unit).filter(a=>!a.blocked&&!a.controlled).sort((a,b)=>a.id.localeCompare(b.id));
  const known=sensors.knowledge(ship),origin=require('./ship-targets').point(room,ship.id);
  const au=Math.max(0,Number(ship.auState?.available??((ship.auState?.current||0)-(ship.auState?.reserved||0)))||0),en=power.output(ship,room.units).en;
  const pending=(key,match)=>room.units.some(u=>u.delayedAction?.[key]?.shipId===ship.id&&match(u.delayedAction[key]));
  const reportPending=id=>room.units.some(u=>(u.queuedEffects||[]).some(e=>e.sensorReport?.shipId===ship.id&&e.sensorReport.targetId===id));
  const targets=room.starships.filter(t=>t.id!==ship.id&&t.controlType!==ship.controlType&&t.currentHullHp>0&&!t.destroyedAt&&!t.escapedAt&&t.ship.warpState?.phase!=='traveling'&&known.contacts[t.id]?.level==='detected'&&known.contacts[t.id]?.position)
    .map(t=>({target:t,contact:known.contacts[t.id],range:distances.hexDistance(origin,known.contacts[t.id].position)}))
    .sort((a,b)=>a.range-b.range||a.target.id.localeCompare(b.target.id));
  const shots=[],progress=[],repairs=[];
  for(const {target,contact,range} of targets){
    const locked=weapons.weaponLock(room,unit,ship,target.id),shielded=contact.shieldCondition>0;
    for(const a of access.filter(a=>a.definition.weapon)){
      const d=a.definition,rail=['ballistic-rail-cannon','ballistic-rail-repeater'].includes(d.weaponFamily);
      if(maps.cloaked(ship)||(!rail&&en<1)||((d.noShieldDamage||rail)&&shielded))continue;
      if(d.devastation&&require('./ship-devastation').reason(room,ship,a.item))continue;
      if(d.ionDisruptor&&ship.ship.fieldState?.systems?.[a.id]?.cooldown>0)continue;
      if(d.missileLauncher){
        if(!locked||d.mineLauncher||(!d.phazonTorpedo&&points(a.item))||ship.ship.missileState?.cooldowns?.[a.id]>0||pending('missileOrder',o=>o.sicId===a.id)||require('./ship-missiles').pending(room))continue;
        const rounds=d.phazonTorpedo?(range<=24&&au>=8&&Number(ship.ship.minerals?.Phazon)>=1?[{id:'phazon-torpedo',dice:3}]:[]):Object.entries(ammo.magazine(ship,a.id)).filter(([id,n])=>n>0&&ammo.catalog[id]&&!ammo.catalog[id].flares&&!ammo.catalog[id].mine&&!ammo.catalog[id].seeker).map(([id])=>ammo.catalog[id]);
        for(const r of rounds)shots.push({score:(r.dice||1)*4.5/(d.phazonTorpedo?9:1),command:{action:'weaponCommand',sicId:a.id,targetId:target.id,ammunition:r.id,missile:true}});
      }else{
        if(d.requiresLock&&!locked||rail&&!weapons.ironAmmo(ship))continue;
        const p=weapons.profile(d,a.item,range),cost=p.cost+(!d.devastation&&!d.ionDisruptor&&!rail&&ship.weaponState?.repeatWindow?.[a.id]>0?(d.energyCost||0):0);
        if(p.count<=0||cost>au)continue;
        shots.push({score:(p.count*((p.dieSides||d.damageDie||4)+1)/2+(p.bonus||0))/(1+cost),command:{action:'weaponCommand',sicId:a.id,targetId:target.id,boosts:0,sacrifice:0}});
      }
    }
    if(range>sensors.rangeAgainst(room,ship,target))continue;
    if(!locks.locked(room,ship,target.id)&&!pending('lockOrder',o=>o.kind==='lock'&&o.targetId===target.id))for(const a of access.filter(a=>a.definition.lockOn)){
      const n=locks.state(ship).targets.filter(l=>l.systemId===a.id&&!l.sharedFrom).length;
      if(n<(a.definition.maxTargets||1)&&(n?Number(a.definition.extraTargetAu)||0:0)<=au)progress.push({action:'lockCommand',kind:'lock',sicId:a.id,targetId:target.id});
    }
    if(!sensors.analysis(ship,target.id)&&!reportPending(target.id)&&!pending('sensorOrder',o=>o.kind==='analysis'&&o.targetId===target.id))for(const a of access.filter(a=>a.definition.sensor))progress.push({action:'sensorCommand',kind:'analysis',sicId:a.id,targetId:target.id});
  }
  const destinations=seats(ship).filter(s=>free(room,unit,s)).sort((a,b)=>Number(b.bridge)-Number(a.bridge)||a.sicId.localeCompare(b.sicId)||a.square-b.square||a.mesh-b.mesh);
  for(const item of maps.installedItems(ship).filter(i=>points(i)&&i.status!=='destroyed').sort((a,b)=>a.id.localeCompare(b.id))){
    if(pending('maintenanceOrder',o=>o.sicId===item.id)||room.units.some(u=>u!==unit&&u.automationRepairTarget===item.id&&u.timedAction))continue;
    for(const seat of destinations.filter(s=>s.sicId===item.id)){
      if(unit.location.stationed&&unit.location.square===seat.square&&Number(unit.location.mesh)===Number(seat.mesh)){repairs.push({action:'shipMaintenance',kind:'repair',sicId:item.id});break;}
      const order=move(room,unit,ship,seat);if(order){repairs.push({...order,repairTarget:item.id});break;}
    }
  }
  if(unit.automationRepairTarget&&repairs.length){const repair=repairs.find(c=>(c.repairTarget||c.sicId)===unit.automationRepairTarget);if(repair)return [repair];}
  // A physical engine seat is not necessarily a useful combat console.
  // Keep productive operators and committed repairs in place; reposition idle crew legally.
  if(!stations.station(room,unit)||(!access.length&&!repairs.length)){
    if(unit.timedAction||unit.travelRoute?.length||unit.delayedAction)return [];
    if(repairs.length)return repairs;
    const bridge=destinations.filter(s=>s.bridge).map(s=>move(room,unit,ship,s)).filter(Boolean);
    if(bridge.length){unit.automationSearchReason='Cannot reach an available Bridge station. Check crew access, occupied stations and doors.';return bridge;}
    const alternatives=destinations.filter(s=>!s.bridge&&s.sicId!==unit.location.sicId&&stations.consoles(room,{...unit,location:s}).some(a=>!a.blocked&&!a.controlled)).map(s=>move(room,unit,ship,s)).filter(Boolean);
    unit.automationSearchReason=alternatives.length?'':'No available reachable Bridge or usable combat station. Check crew access, occupied stations and doors.';
    return alternatives;
  }
  shots.sort((a,b)=>b.score-a.score||a.command.sicId.localeCompare(b.command.sicId)||a.command.targetId.localeCompare(b.command.targetId)||String(a.command.ammunition||'').localeCompare(String(b.command.ammunition||'')));
  const search=(!shots.length&&!progress.length&&!repairs.length)?searchCandidates(room,unit,ship,access,targets):[];
  return [...shots.map(s=>s.command),...progress,...repairs,...search];
}
function candidates(room,unit,random=Math.random){
  if(unit.securityDroid)return require('./ship-security-droids').candidates(room,unit);
  const ship=room.starships.find(s=>s.id===unit.location?.starshipId);
  if(!ship&&!unit.shipAi){
    const engine=require('./combat-engine'),arena=require('./combat-arena'),rules=require('./combat-rules'),weapon=engine.heldWeapon(unit);
    const origin=arena.position(unit),friendly=u=>Boolean(u.team==='pc'||u.allyNpc);
    const enemies=room.units.filter(u=>{
      const position=arena.position(u);
      return u.id!==unit.id&&u.currentHp>0&&!u.defeatedAt&&!position?.starshipId&&
        (position?.arenaId||'')===(origin?.arenaId||'')&&friendly(u)!==friendly(unit)&&arena.canTarget(room,unit,u);
    });
    const targetFor=w=>{
      if(!w||w.groundLocation||(w.ammo&&!w.ammoInventoryId)||!['ranged','melee'].includes(w.category)||['bore-launcher','mine-launcher'].includes(w.id))return null;
      return enemies.find(target=>w.category==='melee'?rules.meleeTargetAllowed(room,unit,target,w):rules.attackPlan(w,{distance:rules.mappedDistance(room,unit,target)??1,charges:w.inventoryId===unit.heldWeaponId?engine.completedCharges(unit):0,attackType:'ranged',strengthDice:unit.strengthDice}).allowed);
    };
    const enemy=targetFor(weapon);
    if(!enemy){
      const alternative=(unit.weapons||[]).find(w=>w.inventoryId!==unit.heldWeaponId&&!w.groundLocation&&!w.ammo&&targetFor(engine.heldWeapon({...unit,heldWeaponId:w.inventoryId})));
      return alternative?[{action:'playerCombatAction',kind:'drawWeapon',inventoryId:alternative.inventoryId}]:[];
    }
    if(weapon.aimRequired&&!unit.aim)return [{action:'playerCombatAction',kind:'aim'}];
    if(weapon.requiredCharge&&engine.completedCharges(unit)<1)return [{action:'playerCombatAction',kind:'charge'}];
    return [{action:'playerCombatAction',kind:weapon.category==='melee'?'melee':'fire',targetId:enemy.id,distance:1}];
  }
  if(!ship)return [];
  if(!unit.shipAi&&unit.team==='npc')return npcShipCandidates(room,unit,ship);
  const out=[],seat=stations.station(room,unit),access=stations.consoles(room,unit).filter(a=>!a.blocked&&!a.controlled);
  const targets=room.starships.filter(s=>s.id!==ship.id&&s.currentHullHp>0&&!s.escapedAt&&s.controlType!==ship.controlType&&sensors.knowledge(ship).contacts[s.id]?.level==='detected').sort((a,b)=>distances.hexDistance(require('./ship-targets').point(room,ship.id),require('./ship-targets').point(room,a.id))-distances.hexDistance(require('./ship-targets').point(room,ship.id),require('./ship-targets').point(room,b.id)));
  const lock=(target)=>access.filter(a=>a.definition.lockOn&&(!unit.shipAi||!a.definition.extraTargetAu||!locks.state(ship).targets.some(l=>l.systemId===a.id))).map(a=>({action:'lockCommand',kind:'lock',sicId:a.id,targetId:target.id}));
  if(unit.shipAi&&['automatic','defense'].includes(unit.automationMode)){
    for(const enemy of room.starships.filter(s=>locks.state(s).targets.some(l=>l.targetId===ship.id)))out.push({action:'lockCommand',kind:'break',sicId:access.find(a=>a.definition.lockOn)?.id,targetId:enemy.id});
    if(unit.automationMode==='defense'){out.push({action:'shipCommand',kind:'evade',sicId:unit.location.sicId});return out;}
  }
  if(!unit.shipAi&&unit.automationRepairTarget){const item=require('./ship-maintenance').local(ship,unit.location);if(item?.id===unit.automationRepairTarget&&(item.impaired||item.impairmentPoints>0))return [{action:'shipMaintenance',kind:'repair',sicId:item.id}];unit.automationRepairTarget=null;}
  if(!unit.shipAi&&!seat){
    const available=seats(ship).filter(s=>free(room,unit,s)).map(s=>({s,rank:s.bridge?0:random()})).sort((a,b)=>Number(b.s.bridge)-Number(a.s.bridge)||a.rank-b.rank);
    return available.map(({s})=>move(room,unit,ship,s)).filter(Boolean);
  }
  if((!unit.shipAi||unit.automationMode==='automatic')&&!targets.length)for(const a of access.filter(a=>a.definition.sensor))out.push({action:'sensorCommand',kind:'area',sicId:a.id});
  for(const target of targets){
    if(!unit.shipAi&&!sensors.analysis(ship,target.id))for(const a of access.filter(a=>a.definition.sensor))out.push({action:'sensorCommand',kind:'analysis',sicId:a.id,targetId:target.id});
    if(!locks.locked(room,ship,target.id)&&(!unit.shipAi||target.currentShieldHp>0))out.push(...lock(target));
    const range=distances.hexDistance(require('./ship-targets').point(room,ship.id),require('./ship-targets').point(room,target.id));
    const choices=access.filter(a=>a.definition.weapon).map(a=>({a,rank:random()})).sort((x,y)=>unit.shipAi?(Number(y.a.definition.tier)||0)-(Number(x.a.definition.tier)||0):x.rank-y.rank);
    const shots=[];
    for(const {a} of choices){
      const d=a.definition;
      if(d.devastation&&require('./ship-devastation').reason(room,a.ship,a.item))continue;
      if(d.missileLauncher){
        if(unit.shipAi&&target.currentShieldHp>0)continue;
        for(const [key,n]of Object.entries(ammo.magazine(ship,a.id)).sort(([a],[b])=>(ammo.catalog[b]?.tier||0)-(ammo.catalog[a]?.tier||0)))if(n>0&&!ammo.catalog[key]?.flares)shots.push({action:'weaponCommand',sicId:a.id,targetId:target.id,ammunition:key,missile:true});
      }else{
        if(d.ammoMineral==='Iron'&&!weapons.ironAmmo(ship))continue;
        if(target.currentShieldHp>0&&(d.noShieldDamage||d.weaponFamily==='ballistic-rail-cannon'))continue;
        const p=weapons.profile(d,a.item,range),repeat=!d.devastation&&d.weaponFamily!=='ballistic-rail-cannon'&&ship.weaponState?.repeatWindow?.[a.id]>0?d.energyCost:0;
        if(p.count<=0||unit.shipAi&&(p.cost+repeat)>0)continue;
        shots.push({action:'weaponCommand',sicId:a.id,targetId:target.id,boosts:0,sacrifice:0});
      }
    }
    if(unit.shipAi&&target.currentShieldHp<=0)shots.sort((a,b)=>Number(!!b.missile)-Number(!!a.missile));
    out.push(...shots);
  }
  if(!unit.shipAi){
    const damaged=maps.installedItems(ship).filter(i=>i.impaired||i.impairmentPoints>0||i.status==='impaired');
    for(const item of damaged){
      if(require('./ship-maintenance').local(ship,unit.location)?.id===item.id)out.push({action:'shipMaintenance',kind:'repair',sicId:item.id});
      else {const cell=[...maps.buildLayout(ship.ship).footprint].find(([,c])=>c.sicId===item.id&&!c.exterior&&!c.blocked);if(!cell)continue;const dest={starshipId:ship.id,sicId:item.id,square:cell[0],mesh:4};const action=move(room,unit,ship,dest,false);if(action)out.push({...action,repairTarget:item.id});}
    }
    for(const s of seats(ship).filter(s=>free(room,unit,s)&&s.sicId!==unit.location.sicId).sort((a,b)=>Number(b.bridge)-Number(a.bridge))) {const action=move(room,unit,ship,s);if(action)out.push(action);}
  }
  return out;
}
module.exports={active,free,seats,candidates,acceptedSearch};
