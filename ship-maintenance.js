const maps = require('./ship-map-core');
const sensors = require('./ship-sensors');
const stations = require('./station-access');
const offline=require('./ship-offline-events');
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
  const wasOnline=offline.capture(ship,item);
  if(body.kind==='repair'){
    if(!points(item))return {ok:false,error:'This SIC has no impairment to repair.'};
    unit.delayedAction={id:`repair-${receipt}`,kind:'action',label:'Repair SIC',rate:100/9,total:100,remaining:100,consumeTurn:true,resolving:false,maintenanceOrder:{shipId:ship.id,sicId:item.id,square:unit.location.square}};
  }else{
    const cell=maps.buildLayout(ship.ship).footprint.get(unit.location.square);
    if(!remoteBridge&&(!unit.location.stationed||!cell?.stations.some(s=>s.x===cell.column&&s.y===cell.row&&s.mesh===Number(unit.location.mesh))))return {ok:false,error:'Occupy this SIC’s station to change its power state.'};
    const crew=remoteBridge||(ship.crewCharacterIds||ship.ship.crewCharacterIds||[]).includes(unit.characterId)||(ship.crewNpcUnitIds||ship.ship.crewNpcUnitIds||[]).includes(unit.id);
    if(!crew)return {ok:false,error:'Registered ship crew administration rights are required.'};
    if(body.kind==='off'){
      item.disabled=true;item.status='powered-down';item.bootRemaining=0;delete item.bootDuration;
    }else{
      if((body.kind==='on'&&stations.online(item))||item.bootRemaining>0)return {ok:false,error:'This SIC is already online or restarting.'};
      const installed=new Set(ship.ship.placements.map(p=>p.sicId));
      const bridge=ship.ship.sicInventory.find(i=>installed.has(i.id)&&maps.definition(i.type).bridge);
      const seconds=maps.definition(bridge?.type).rebootSeconds;
      if(!Number.isFinite(seconds)||seconds<=0)return {ok:false,error:'Install a cockpit or bridge with a restart time.'};
      item.bootDuration=seconds;item.bootRemaining=seconds;item.disabled=true;item.status='offline';
    }
  }
  ship.maintenanceReceipts=[...ship.maintenanceReceipts,receipt].slice(-256);
  const offlineEventId=offline.record(ship,item,wasOnline,{defer:!room.roomCode});
  return {ok:true,ship,immediate:body.kind!=='repair',offlineEventId};
}
function calculationSources(room,unit,pending){
  const order=pending?.maintenanceOrder,ship=room.starships.find(s=>s.id===order?.shipId),item=ship?.ship.sicInventory.find(i=>i.id===order.sicId);if(!item)return null;
  const d=maps.definition(item.type),key=d.sensor||d.darkveil||d.lockOn?'sensorSkill':d.weapon?'weaponSystemsSkill':d.bridge?'computerSkill':'engineeringSkill',name=({sensorSkill:'Sensor Systems',weaponSystemsSkill:'Weapon Systems',computerSkill:'Computer Systems',engineeringSkill:'Engineering'})[key];
  const sides=unit.team==='npc'&&!unit.shipAi?require('./combat-engine').npcAttributeDice(unit.mentalAttribute):unit.intellectDice||[],rating=Number(unit[key]??(unit.team==='npc'?unit.mentalSkill:0))||0,difficulty=Math.max(10,Number(item.repairDifficulty)||10);
  return {version:1,kind:'sic-repair',sides:[...sides],rating,difficulty,summary:[d.name+'; '+(unit.team==='npc'&&!unit.shipAi?'NPC Mental':'Intellect')+' '+sides.map(n=>'D'+n).join('+')+'; '+name+' +'+rating+'; difficulty '+difficulty+'.','Fixed repair delay; speed '+Number((100/9).toFixed(2))+'/s; base 9s'+(pending.rollTiming?'; '+pending.rollTiming.outcome+'; final speed '+Number(pending.rate.toFixed(2))+'/s':'')+'.'],lines:[],gmLines:[]};
}
function resolve(room,unit,rollDie){
 const pending=unit.delayedAction,c=calculationSources(room,unit,pending);if(!c)return resolveInner(room,unit,rollDie);
 const order=pending.maintenanceOrder,ship=room.starships.find(s=>s.id===order.shipId),item=ship.ship.sicInventory.find(i=>i.id===order.sicId),before=points(item),previous=ship.sensorState?.reports?.[0],generated=[];
 const tracked=n=>{const v=rollDie(n);generated.push(v);return v;};Object.assign(tracked,rollDie);resolveInner(room,unit,tracked);
 const report=ship.sensorState?.reports?.[0],submitted=Number.isFinite(rollDie.submittedScore);c.values=submitted?(rollDie.submittedValues??pending.submittedRoll?.values??[]):generated;c.total=report!==previous?report.total:undefined;c.repaired=before-points(item);
 if(submitted){c.sides=[...(pending.rollSpec?.sides||c.sides),...Array(rollDie.exertion||0).fill(12)];}
 c.summary[0]+=' '+(report===previous?'Cancelled; no repair.':(submitted?'Submitted ':'Result ')+c.total+'; '+(c.values.length?'dice '+c.values.join(','):submitted?'manual dice unavailable':'no dice')+'; impairment removed '+c.repaired+'.');
 if(rollDie.exertion)c.summary[0]+=' Exertion +'+rollDie.exertion+'D12.';if(submitted)c.summary[0]+=' Unverified submission.';
 pending.calculation=c;
}
function resolveInner(room,unit,rollDie){
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
module.exports={local,points,restore,advance,queue,resolve,calculationSources,diagnostics,passTime};
