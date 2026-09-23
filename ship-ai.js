const maps=require('./ship-map-core'),rooms=require('./ship-crew-rooms'),stations=require('./station-access'),power=require('./ship-power');
const enabled=ship=>maps.installedItems(ship).find(item=>maps.definition(item.type).shipAi&&stations.online(item)&&rooms.roomData(ship,item.id).enabled!==false);
function configure(room,ship,mode){
  if(!['off','defense','offense'].includes(mode))throw Error('Choose Defense, Offense or Off.');
  const item=maps.installedItems(ship).find(i=>maps.definition(i.type).shipAi&&(mode==='off'||stations.online(i)));if(!item)throw Error('Install and power an online Ship AI first.');
  if(mode!=='off'&&power.output(ship,room.units).en<power.demand(ship))throw Error('Restore sufficient ship power first.');
  const policy=require('./ship-automation'),unit=room.units.find(u=>u.id==='ship-ai-'+ship.id);
  const details=rooms.roomData(ship,item.id),available=policy.seats(ship).filter(s=>s.bridge&&policy.free(room,unit,s)),seat=available.find(s=>s.square===(unit?.location?.square??details.automationSeat?.square)&&s.mesh===(unit?.location?.mesh??details.automationSeat?.mesh))||available[0];
  if(mode!=='off'&&!seat)throw Error('Free up one station first');
  details.automationSeat=mode==='off'?null:seat;
  rooms.roomData(ship,item.id).automationMode=mode;if(mode!=='off')rooms.roomData(ship,item.id).enabled=true;
  if(unit){unit.automationSuspended=false;unit.automationMode=mode;if(mode==='off'){unit.location.stationed=false;unit.atb=0;delete unit.automationPresentation;}}
}
function sync(room,makeUnit){
  for(const ship of room.starships||[]){
    const item=enabled(ship),id='ship-ai-'+ship.id;let unit=room.units.find(u=>u.id===id);
    const available=item&&ship.currentHullHp!==0&&!ship.escapedAt&&power.output(ship,room.units).en>=power.demand(ship);
    if(!available){if(unit){unit.shipAi=true;unit.speed=0;unit.atb=0;unit.defeatedAt||=Date.now();unit.location={starshipId:ship.id,stationed:false};unit.automationMode='off';const installed=maps.installedItems(ship).find(i=>maps.definition(i.type).shipAi);if(installed)rooms.roomData(ship,installed.id).automationMode='off';}continue;}
    const details=rooms.roomData(ship,item.id),bridge=maps.installedItems(ship).find(i=>maps.definition(i.type).bridge&&stations.online(i)),placement=bridge&&ship.ship.placements.find(p=>p.sicId===bridge.id);
    const seats=bridge?maps.componentDefinition(bridge).stations.map(s=>({starshipId:ship.id,sicId:bridge.id,square:placement.cell+s.y*maps.gridColumns(ship.ship)+s.x,mesh:s.mesh,stationed:true})):[];
    const free=loc=>require('./ship-automation').free(room,unit,loc);
    const seat=details.automationMode==='off'?null:seats.find(s=>(unit?.location?.square??details.automationSeat?.square)===s.square&&(unit?.location?.mesh??details.automationSeat?.mesh)===s.mesh&&free(s))||seats.find(free);
    if(!seat&&details.automationMode&&details.automationMode!=='off')details.automationMode='off';
    details.automationSeat=details.automationMode&&details.automationMode!=='off'?seat:null;
    details.station=seat?'Bridge station occupied':details.automationMode==='off'?'Automation off / bridge station released':'Standby: no free bridge station';
    if(!unit&&seat){unit=makeUnit({team:'npc',characterName:details.name||'Ship AI',playerName:'GM',speed:10.5,commandWindow:94,color:'#91e7cb',initialAtb:0,location:seat,shipAi:true,maximumHp:20,currentHp:20,physicalSkill:2.5,mentalSkill:2.5,physicalAttribute:8,mentalAttribute:8,raceType:'mechanical',allyNpc:ship.controlType==='pc'},room.threshold||100);unit.id=id;room.units.push(unit);}
    if(unit){
      unit.shipAi=true;unit.actorType='ship-ai';unit.characterName=details.name||'Ship AI';unit.location=seat||{starshipId:ship.id,sicId:bridge?.id||'',stationed:false};
      unit.dexterityBoxes=unit.intellectBoxes=8;unit.highestPerceptionDie=6;unit.physicalAttribute=unit.mentalAttribute=8;unit.automationMode=details.automationMode||'off';unit.speed=seat?10.5:0;unit.commandWindow=94;unit.currentHp=20;unit.maximumHp=20;unit.defeatedAt=seat?null:Date.now();unit.moveSpeed=0;unit.raceType='mechanical';unit.controlledBy='gm';
      for(const k of ['dexterityDice','strengthDice','intellectDice','healthDice','willpowerDice','perceptionDice','luckDice','charismaDice'])unit[k]=[6,6,6,6];
      for(const k of ['engineeringSkill','computerSkill','hackingSkill','sensorSkill','weaponSystemsSkill','pilotSkill','anatomySkill','mathematicsSkill','projectileSkill','meleeSkill','dodgeSkill','weaponMechanics','physicalSkill','mentalSkill','initiativeSkill','enduranceSkill','awarenessSkill'])unit[k]=2.5;
    }
  }
}
function detectIntrusion(room,targetId,sicId){
  const ship=room.starships.find(s=>s.id===targetId),target=ship?.ship.sicInventory.find(i=>i.id===sicId);
  if(!ship||!enabled(ship)||!maps.definition(target?.type).bridge||power.output(ship,room.units).en<power.demand(ship))return;
  const text='Ship AI alert: unauthorized intrusion detected at the bridge.';
  rooms.state(ship).aiAlert={id:require('node:crypto').randomUUID(),text,at:Date.now()};
  const knowledge=require('./ship-sensors').knowledge(ship);knowledge.reports=[{id:rooms.state(ship).aiAlert.id,text,at:new Date().toISOString()},...knowledge.reports].slice(0,40);
}
function reservedSeat(ship){const item=enabled(ship),details=item&&rooms.roomData(ship,item.id);return details?.automationMode&&details.automationMode!=='off'?details.automationSeat:null;}
module.exports={sync,enabled,detectIntrusion,configure,reservedSeat};
