const maps = require('./ship-map-core');
const sensors = require('./ship-sensors');
const stations = require('./station-access');
const points = item => Math.max(0, Math.floor(Number(item.impairmentPoints) || (item.impaired || item.status === 'impaired' ? 1 : 0)));
function local(ship, location) {
  if (!location || !Number.isInteger(location.square)) return null;
  return maps.buildLayout(ship.ship || ship).footprint.get(location.square)?.item || null;
}
function restore(item) {
  item.impaired = false; item.impairmentPoints = 0; item.repairDifficulty = 10;
  if (item.status === 'impaired') item.status = 'online';
  item.unstable = false;
}
function advance(ship, seconds) {
  for (const item of ship.ship?.sicInventory || []) {
    if (item.bootRemaining > 0) {
      item.bootRemaining = Math.max(0,item.bootRemaining-seconds);
      if(item.bootRemaining<1e-8)item.bootRemaining=0;
      if (!item.bootRemaining) {item.disabled=false;item.status=item.impaired?'impaired':'online';item.unstable=false;}
    }
  }
}
function queue(room, unit, body) {
  const remote=stations.access(room,unit,body.sicId);
  const remoteBridge=remote?.remotePilot&&['off','restart'].includes(body.kind);
  const ship=remoteBridge?remote.ship:room.starships.find(s=>s.id===unit?.location?.starshipId),loc=unit?.location;
  const localItem=ship&&local(ship,loc),requested=ship?.ship.sicInventory.find(i=>i.id===body.sicId);
  if(!['repair','off','on','restart'].includes(body.kind))return {ok:false,error:'Choose a maintenance operation.'};
  const cell=ship&&maps.buildLayout(ship.ship).footprint.get(loc.square);
  const seat=remoteBridge||stations.conscious(unit)&&loc.stationed&&cell?.stations.some(s=>s.x===cell.column&&s.y===cell.row&&s.mesh===Number(loc.mesh));
  const remotePower=remoteBridge||['off','restart'].includes(body.kind)&&seat&&maps.definition(localItem?.type).bridge&&ship.ship.placements.some(p=>p.sicId===requested?.id);
  const item=remotePower?requested:localItem;
  if(!item||item.id!==body.sicId||!seat||unit.timedAction)return {ok:false,error:'Station at this SIC to repair or power it on. A Bridge station can remotely power off or restart installed SICs.'};
  const receipt=String(body.requestId||'');ship.maintenanceReceipts ||= [];
  if(!/^[\w-]{8,100}$/.test(receipt))return {ok:false,error:'Invalid maintenance receipt.'};
  if(ship.maintenanceReceipts.includes(receipt))return {ok:true,duplicate:true};
  if(room.activeId!==unit.id||unit.delayedAction||unit.delayTimer||unit.consoleHold||unit.shieldRestabilizing||room.starships.some(s=>s.auCommands?.some(c=>c.unitId===unit.id)))return {ok:false,error:'Finish the current action and wait for your turn.'};
  if(body.kind==='repair'){
    if(!points(item))return {ok:false,error:'This SIC has no impairment to repair.'};
    unit.delayedAction={id:`repair-${receipt}`,kind:'action',label:'Repair SIC',rate:100/9,total:100,remaining:100,consumeTurn:true,resolving:false,maintenanceOrder:{shipId:ship.id,sicId:item.id,square:unit.location.square}};
  }else{
    const cell=maps.buildLayout(ship.ship).footprint.get(unit.location.square);
    if(!remoteBridge&&(!unit.location.stationed||!cell?.stations.some(s=>s.x===cell.column&&s.y===cell.row&&s.mesh===Number(unit.location.mesh))))return {ok:false,error:'Occupy this SIC’s station to change its power state.'};
    const crew=remoteBridge||(ship.crewCharacterIds||ship.ship.crewCharacterIds||[]).includes(unit.characterId)||(ship.crewNpcUnitIds||ship.ship.crewNpcUnitIds||[]).includes(unit.id);
    if(!crew)return {ok:false,error:'Registered ship crew administration rights are required.'};
    if(body.kind==='off'){
      item.disabled=true;item.status='powered-down';item.bootRemaining=0;
    }else{
      if((body.kind==='on'&&stations.online(item))||item.bootRemaining>0)return {ok:false,error:'This SIC is already online or restarting.'};
      const installed=new Set(ship.ship.placements.map(p=>p.sicId));
      const bridge=ship.ship.sicInventory.find(i=>installed.has(i.id)&&maps.definition(i.type).bridge);
      const seconds=maps.definition(bridge?.type).rebootSeconds;
      if(!Number.isFinite(seconds)||seconds<=0)return {ok:false,error:'Install a cockpit or bridge with a restart time.'};
      item.bootRemaining=seconds;item.disabled=true;item.status='offline';
    }
  }
  ship.maintenanceReceipts=[...ship.maintenanceReceipts,receipt].slice(-256);
  return {ok:true,ship,immediate:body.kind!=='repair'};
}
function resolve(room,unit,rollDie){
  const order=unit.delayedAction?.maintenanceOrder;if(!order)return;
  unit.delayedAction=null;
  const ship=room.starships.find(s=>s.id===order.shipId),item=ship&&local(ship,unit.location);
  if(!item||item.id!==order.sicId||unit.location.starshipId!==ship.id)return;
  const d=maps.definition(item.type),rating=d.sensor||d.darkveil||d.lockOn?unit.sensorSkill:d.weapon?unit.weaponSystemsSkill:d.bridge?unit.computerSkill:unit.engineeringSkill;
  const dice=unit.team==='npc'&&!unit.shipAi?require('./combat-engine').npcAttributeDice(unit.mentalAttribute):unit.intellectDice||[];
  const values=Number.isFinite(rollDie.submittedScore)?[]:dice.map(rollDie),total=Number.isFinite(rollDie.submittedScore)?rollDie.submittedScore:sensors.fusedTotal(values)+(Number(rating??(unit.team==='npc'?unit.mentalSkill:0))||0);
  const difficulty=Math.max(10,Number(item.repairDifficulty)||10);
  const success=points(item)>0&&total>=difficulty;
  if(success){item.impairmentPoints=points(item)-1;item.impaired=item.impairmentPoints>0;if(!item.impaired&&item.status==='impaired')item.status='online';item.repairDifficulty=difficulty+1;}
  const state=sensors.knowledge(ship);state.reports=[{at:new Date().toISOString(),text:`${unit.characterName}: Repair SIC ${success?'succeeded':'failed'} (difficulty ${difficulty}).`,values,total},...state.reports].slice(0,30);
}
function diagnostics(ship, characterId) {
  const item=local(ship,ship.characterLocations?.[characterId]);
  if(!item)throw Error('Move the character into the SIC room first.');
  ship.ship.diagnostics ||= [];
  if(ship.ship.diagnostics.some(job=>job.sicId===item.id))throw Error('Diagnostics are already scheduled for this SIC.');
  ship.ship.diagnostics.push({sicId:item.id,characterId,remainingMinutes:55});
}
function passTime(ship,minutes){
  const report=(job,text)=>{
    ship.ship.maintenanceReports=[{id:require('node:crypto').randomUUID(),at:new Date().toISOString(),characterId:job.characterId,sicId:job.sicId,text},...(ship.ship.maintenanceReports||[])].slice(0,30);
  };
  ship.ship.diagnostics=(ship.ship.diagnostics||[]).filter(job=>{
    const item=local(ship,ship.characterLocations?.[job.characterId]);
    if(!item||item.id!==job.sicId){report(job,'Diagnostics cancelled: the operator left the SIC room. No repair was completed.');return false;}
    job.remainingMinutes-=minutes;
    if(job.remainingMinutes>0)return true;
    restore(item);ship.ship.doorDamage={};require('./ship-security-droids').repair(ship);report(job,`${maps.definition(item.type).name}: System Repairs and Diagnostics complete. All ship doors repaired. All impairment cleared; repair difficulty reset to 10. Power state is unchanged.`);return false;
  });
  advance(ship,minutes*60);
}
module.exports={local,points,restore,advance,queue,resolve,diagnostics,passTime};
