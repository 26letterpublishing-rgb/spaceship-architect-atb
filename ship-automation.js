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
function candidates(room,unit,random=Math.random){
  if(unit.securityDroid)return require('./ship-security-droids').candidates(room,unit);
  const ship=room.starships.find(s=>s.id===unit.location?.starshipId);
  if(!ship&&!unit.shipAi){
    const enemy=room.units.find(u=>u.id!==unit.id&&u.currentHp>0&&!u.defeatedAt&&!u.location?.starshipId&&(u.team==='pc'||u.allyNpc)!==(unit.team==='pc'||unit.allyNpc));
    if(!enemy)return [];
    const engine=require('./combat-engine'),weapon=engine.heldWeapon(unit),available=(unit.weapons||[]).find(w=>['ranged','melee'].includes(w.category));
    if(!weapon&&available)return [{action:'playerCombatAction',kind:'drawWeapon',inventoryId:available.inventoryId}];
    if(!weapon)return [];
    if(weapon.aimRequired&&!unit.aim)return [{action:'playerCombatAction',kind:'aim'}];
    if(weapon.requiredCharge&&engine.completedCharges(unit)<1)return [{action:'playerCombatAction',kind:'charge'}];
    return [{action:'playerCombatAction',kind:weapon.category==='melee'?'melee':'fire',targetId:enemy.id,distance:1}];
  }
  if(!ship)return [];
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
module.exports={active,free,seats,candidates};
