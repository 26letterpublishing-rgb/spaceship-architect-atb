// Authoritative camera coverage. Never publish this module or raw surveillanceState.
const {randomUUID}=require('node:crypto');
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power');
const cameras=ship=>maps.installedItems(ship).filter(i=>maps.definition(i.type).surveillance);
function online(room,ship,item){
  return Boolean(item&&stations.online(item)&&!item.impaired&&!item.impairmentPoints&&item.status!=='impaired'&&!ship.destroyedAt&&!ship.escapedAt&&power.output(ship,room.units).en>=power.demand(ship));
}
function hostile(room,ship,unit){
  if(ship.crewCharacterIds?.includes(unit.characterId)||ship.crewNpcUnitIds?.includes(unit.id)||unit.shipAi&&unit.location?.starshipId===ship.id)return false;
  const home=room.starships.find(s=>s.crewCharacterIds?.includes(unit.characterId)||s.crewNpcUnitIds?.includes(unit.id));
  if(home?.id===ship.id)return false;
  if(home?.ship.affiliation&&home.ship.affiliation===ship.ship.affiliation)return false;
  return home?home.controlType!==ship.controlType:unit.team===(ship.controlType==='gm'?'pc':'npc');
}
function occupants(room,ship){
  const layout=maps.buildLayout(ship.ship);
  return (room.units||[]).filter(u=>u.location?.starshipId===ship.id&&!u.location.escapePodId&&ship.ship.gridCells.includes(u.location.square)&&!layout.footprint.get(u.location.square)?.exterior);
}
function reconcile(room){
  let changed=require('./ship-intruders').reconcile(room);
  for(const ship of room.starships||[]){
    const installed=cameras(ship);if(!installed.length&&!ship.ship.surveillanceState)continue;
    let state=ship.ship.surveillanceState;
    if(!state){state=ship.ship.surveillanceState={present:[],reports:[]};changed=true;}
    const active=installed.some(item=>online(room,ship,item));
    const present=active?occupants(room,ship).filter(u=>hostile(room,ship,u)).map(u=>u.id):[];
    const arrivals=present.filter(id=>!state.present?.includes(id));
    if(arrivals.length){
      const layout=maps.buildLayout(ship.ship);ship.ship.doorStates||={};
      for(const key of Object.keys(ship.ship.doorStates))ship.ship.doorStates[key]=require('./ship-doors').broken(ship,key)?'open':'closed';
      for(const square of ship.ship.gridCells)for(const side of maps.SIDES){const edge=layout.boundary(square,side.name);if(edge.kind==='door'&&!require('./ship-doors').broken(ship,edge.key))ship.ship.doorStates[edge.key]='closed';}
      state.reports=[...(state.reports||[]),{id:randomUUID(),at:new Date().toISOString(),text:`Intruder Alert! ${ship.title}: enemy aboard. Doors closed.`}].slice(-20);
      changed=true;
    }
    if(JSON.stringify(state.present)!==JSON.stringify(present)){state.present=present;changed=true;}
  }
  return changed;
}
function inspect(room,unit,sicId){
  const access=stations.access(room,unit,sicId);
  if(!access?.definition.surveillance||access.blocked||!online(room,access.ship,access.item))throw Error('Occupy an operational Surv. Camera station, or maintain a successful camera hack.');
  const ship=access.ship;
  // Only visual identity and current interior position; never sheets, HP, ATB or secrets.
  return {shipId:ship.id,title:ship.title,controlled:Boolean(access.controlled),columns:maps.gridColumns(ship.ship),rows:maps.gridRows(ship.ship),
    cells:[...ship.ship.gridCells],doors:{...ship.ship.doorStates},
    crew:occupants(room,ship).map(u=>({name:u.characterName||'Crew',square:u.location.square,mesh:u.location.mesh,hostile:hostile(room,ship,u)})),
    reports:(ship.ship.surveillanceState?.reports||[]).slice(-5)};
}
module.exports={cameras,online,hostile,occupants,reconcile,inspect};
