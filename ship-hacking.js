const {randomUUID} = require('node:crypto');
const puzzle = require('./hacking-puzzle');
const maps = require('./ship-map-core');
const stations = require('./station-access');
const sensors = require('./ship-sensors');
const distances = require('./ship-distances');
const maintenance = require('./ship-maintenance');

const state = room => room.hackingPrivate ||= {secrets:{},sessions:[],receipts:[]};
const skill = unit => Math.max(0,Number(unit.hackingSkill ?? (unit.team==='npc'?unit.mentalSkill:0))||0);
const key = (shipId,sicId) => JSON.stringify([shipId,sicId]);
const itemAt = (ship,id) => ship?.ship.placements?.some(p=>p.sicId===id) && ship.ship.sicInventory.find(i=>i.id===id);
function firewall(ship) {
  return Math.max(0,...(ship?.ship.placements||[]).map(p=>puzzle.firewallStats(itemAt(ship,p.sicId)||{})));
}
function connected(room,session,visited=new Set()) {
  if(visited.has(session.id))return false;visited.add(session.id);
  if(session.relayId){
    const relay=state(room).sessions.find(s=>s.id===session.relayId),secret=relay&&state(room).secrets[key(relay.targetId,relay.sicId)];
    if(!relay?.control||!relay.connected||secret?.id!==relay.secretId||!connected(room,relay,visited))return false;
  }
  const unit=room.units.find(u=>u.id===session.unitId),source=room.starships.find(s=>s.id===session.sourceId),target=room.starships.find(s=>s.id===session.targetId);
  const module=itemAt(source,session.moduleId),item=itemAt(target,session.sicId),seat=unit&&stations.station(room,unit);
  if(!unit||!source||!target||source.destroyedAt||target.destroyedAt||source.escapedAt||target.escapedAt||source.ship.warpState?.phase==='traveling'||target.ship.warpState?.phase==='traveling'||!stations.conscious(unit)||!module||!item||!stations.online(item)||!puzzle.moduleStats(module,skill(unit)).online||!puzzle.moduleStats(module,skill(unit)).qualified||!seat||seat.key!==session.station)return false;
  const position=id=>distances.positions(room.starships,room.shipPositions).find(p=>p.id===id);
  const bug=require('./ship-probes').bugLink(room,source,target);
  const blocked=maps.installedItems(target).some(i=>stations.online(i)&&(i.type==='static-shield'||i.type==='wired-downgrade'));
  return bug||(!blocked&&Boolean(sensors.installed(source)&&distances.hexDistance(position(source.id),position(target.id))<=sensors.rangeAgainst(room,source,target)));
}
function refresh(room) {
  const data=state(room);
  room.hackingGrants=[];
  for(const ship of room.starships){ship.hackedSystems=[];ship.firewallLevel=firewall(ship);}
  for(const [id,secret] of Object.entries(data.secrets)){
    const [shipId,sicId]=JSON.parse(id),ship=room.starships.find(s=>s.id===shipId),item=itemAt(ship,sicId);
    if(!item||!stations.online(item))delete data.secrets[id];
  }
  for(const session of data.sessions){
    const secret=data.secrets[key(session.targetId,session.sicId)];
    if(!secret||secret.id!==session.secretId){session.connected=false;session.control=false;session.solved=false;session.invalidated=true;continue;}
    const bridge=Boolean(maps.definition(itemAt(room.starships.find(s=>s.id===session.targetId),session.sicId)?.type).bridge);
    if(room.encounterEndedAt||!connected(room,session)){session.connected=false;if(!bridge||room.encounterEndedAt){session.control=false;session.solved=false;}}
    if(session.control&&(session.connected||bridge)){
      const target=room.starships.find(s=>s.id===session.targetId),item=itemAt(target,session.sicId);
      target.hackedSystems.push({sicId:session.sicId,bridge:Boolean(maps.definition(item.type).bridge),unitId:session.unitId,sessionId:session.id});
      if(session.connected)room.hackingGrants.push({unitId:session.unitId,targetId:session.targetId,sicId:session.sicId,sourceId:session.sourceId});
    }
  }
  for(const unit of room.units){
    for(const [field,request] of [['delayedAction',unit.delayedAction?.counterHack],['counterHackSwap',unit.counterHackSwap]]){
      if(!request)continue;
      const ship=room.starships.find(s=>s.id===request.shipId),item=ship&&maintenance.local(ship,unit.location),secret=data.secrets[key(request.shipId,request.sicId)];
      if(room.encounterEndedAt||!stations.conscious(unit)||item?.id!==request.sicId||secret?.id!==request.secretId)unit[field]=null;
    }
  }
}
function assertReady(room,unit,body) {
  if(room.encounterEndedAt||room.hasEngagedClock===false)throw Error('Begin combat before attempting a live hack.');
  if(!stations.conscious(unit))throw Error('An unconscious character cannot hack.');
  if(unit.counterHackSwap)throw Error('Finish the previous counter-hack position swap first.');
  if(require('./ship-oxygen').pending(room.starships)||room.attackResolution||room.itemResolution)throw Error('Resolve the pending roll before taking a hacking action.');
  if(body.kind!=='counter'&&room.starships.find(s=>s.id===unit.location?.starshipId)?.hackedSystems?.some(h=>h.bridge))throw Error('Bridge compromised. Move to the SIC for local power-off or reboot.');
  if(room.activeId!==unit.id||unit.atb<room.threshold||body.turnSerial!==unit.turnSerial||unit.consoleHold||unit.delayedAction||unit.delayTimer||unit.timedAction||unit.shieldRestabilizing||room.units.some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length))throw Error('Wait for this character\'s next earned turn and finish pending rolls.');
}
function open(room,unit,body) {
  const access=stations.access(room,unit,body.sicId);
  if(!access||access.blocked||access.kind!=='hacking')throw Error('Use an operational Hacking Module from a bridge or cockpit.');
  const stats=puzzle.moduleStats(access.item,skill(unit));
  if(!stats.online||!stats.qualified)throw Error(`This module requires Hacking ${stats.minimum} and working hardware.`);
  const target=room.starships.find(s=>s.id===body.targetId&&s.id!==access.ship.id),analysis=target&&sensors.analysis(access.ship,target.id);
  const item=target&&itemAt(target,body.targetSicId),definition=maps.definition(item?.type);
  if(!target||access.ship.sensorState?.contacts?.[target.id]?.level!=='detected'||!analysis?.layout?.sicInventory.some(i=>i.id===body.targetSicId)||!item||!stations.online(item))throw Error('Detect the ship and complete Systems Analysis to select an installed, online SIC.');
  if(!Number.isInteger(definition.security)||definition.security<1)throw Error('This SIC has no hackable Security rating.');
  const data=state(room);
  if(data.sessions.some(s=>s.moduleId===access.id&&s.sourceId===access.ship.id&&s.unitId!==unit.id&&s.connected))throw Error('Another operator is using this module. They must disconnect first.');
  const previous=data.sessions.find(s=>s.unitId===unit.id&&s.moduleId===access.id&&s.targetId===target.id&&s.sicId===item.id&&!s.invalidated);
  if(previous)return previous;
  const secret=data.secrets[key(target.id,item.id)] ||= puzzle.createSecret(definition.security,8);
  const session={id:randomUUID(),unitId:unit.id,sourceId:access.ship.id,moduleId:access.id,targetId:target.id,sicId:item.id,station:access.seat.key,
    secretId:secret.id,reduction:stats.reduction,firewall:firewall(target),history:[],connected:true,solved:false,control:false,observedVersion:secret.version};
  if(access.controlled){
    session.relayId=data.sessions.find(s=>s.unitId===unit.id&&s.targetId===access.ship.id&&s.control&&s.connected&&(s.sicId===access.id||maps.definition(itemAt(access.ship,s.sicId)?.type).bridge))?.id;
    if(!session.relayId)throw Error('The remote Hacking Module connection was lost.');
  }
  if(!connected(room,session))throw Error('Move within sensor range; protected targets require an active attached Hacking Bug.');
  data.sessions.push(session);
  return session;
}
function challenge(room,session) {
  const secret=state(room).secrets[key(session.targetId,session.sicId)];
  if(!secret||session.invalidated)throw Error('The SIC was rebooted. Open a new intrusion.');
  return puzzle.challenge({...secret,decoys:secret.decoys.slice(0,session.firewall)},session.reduction);
}
function command(room,unit,body) {
  refresh(room);
  const data=state(room),receipt=String(body.requestId||'');
  if(!/^[\w-]{8,100}$/.test(receipt))throw Error('Missing hacking request receipt.');
  const fingerprint=JSON.stringify([unit.id,body.kind,body.sicId,body.targetId,body.targetSicId,body.sessionId,body.guess,body.turnSerial]);
  const saved=data.receipts.find(r=>r.id===receipt);
  if(saved){if(saved.fingerprint!==fingerprint)throw Error('This receipt belongs to another hacking command.');return {...saved.result,duplicate:true};}
  let result={spent:false};
  if(body.kind==='open'){
    if(room.encounterEndedAt||room.hasEngagedClock===false)throw Error('Begin combat before attempting a live hack.');
    result.sessionId=open(room,unit,body).id;
    require('./ship-ai').detectIntrusion(room,body.targetId,body.targetSicId);
  }else if(body.kind==='counter'){
    assertReady(room,unit,body);
    const ship=room.starships.find(s=>s.id===unit.location?.starshipId),item=ship&&maintenance.local(ship,unit.location);
    if(!item||item.id!==body.sicId||!stations.online(item)||!Number.isInteger(maps.definition(item.type).security))throw Error('Move physically inside the SIC to counter-hack.');
    const secret=data.secrets[key(ship.id,item.id)] ||= puzzle.createSecret(maps.definition(item.type).security,8);
    if(secret.password.length<2)throw Error('This one-letter password has no two positions to swap. Reboot instead.');
    unit.delayedAction={id:`counter-${receipt}`,kind:'action',label:'Counter-hack',remaining:0,total:100,rate:1,resolving:true,awaitingRoll:true,consumeTurn:false,
      counterHack:{shipId:ship.id,sicId:item.id,secretId:secret.id},rollSpec:{sides:[6],bonus:0,skill:'Hacking',immediateResult:true,difficulty:skill(unit),difficultyLabel:`Roll strictly below Hacking ${skill(unit)}`}};
    result.spent=true;
  }else{
    const session=data.sessions.find(s=>s.id===body.sessionId&&s.unitId===unit.id);
    if(!session)throw Error('Open your own hacking session first.');
    if(body.kind==='disconnect'){session.connected=false;session.control=false;session.solved=false;}
    else{
      assertReady(room,unit,body);
      if(!connected(room,session)||session.invalidated)throw Error('Connection unavailable. Return to the module and sensor range, or open a new session after reboot.');
      if(body.kind==='guess'){
        const board=challenge(room,session),feedback=puzzle.evaluate(board.answer,board.candidates,body.guess);
        session.history.push({guess:[...body.guess],...feedback,at:Date.now(),version:board.version});
        session.history=session.history.slice(-200);session.connected=true;session.solved=feedback.success;session.control=feedback.success;
        session.observedVersion=board.version;
        if(feedback.success&&maps.definition(itemAt(room.starships.find(s=>s.id===session.targetId),session.sicId)?.type).bridge){
          for(const other of data.sessions)if(other!==session&&other.targetId===session.targetId&&other.sicId===session.sicId){other.control=false;other.solved=false;}
        }
        result.text=feedback.success?'Access granted. Console captured.':`${feedback.exact} exact; ${feedback.misplaced} correct letters elsewhere.`;
      }else if(body.kind==='off'){
        if(!session.solved||!session.control||!session.connected)throw Error('Capture this SIC before turning it off.');
        const target=room.starships.find(s=>s.id===session.targetId),item=itemAt(target,session.sicId);
        item.disabled=true;item.status='powered-down';item.bootRemaining=0;
        result.text=`${maps.definition(item.type).name} turned off. Registered crew must enter its room to restart it.`;
      }else if(body.kind==='impair'){
        if(!session.solved||!session.connected)throw Error('Solve the password before forcing impairment.');
        const target=room.starships.find(s=>s.id===session.targetId),item=itemAt(target,session.sicId);
        item.impaired=true;if(item.status==='online')item.status='impaired';
        if(item.unstable)item.impairmentPoints=Math.min(3,maintenance.points(item)+1);
        else item.impairmentPoints=Math.max(1,Math.min(3,maintenance.points(item)));
        result.text='SIC impairment applied; no hull damage or station destruction.';
      }else throw Error('Choose a hacking operation.');
      result.spent=true;
    }
  }
  data.receipts=[...data.receipts,{id:receipt,fingerprint,result}].slice(-512);
  refresh(room);
  return result;
}
function counterRoll(room,unit,value) {
  const pending=unit.delayedAction,order=pending?.counterHack;
  if(!order)throw Error('No counter-hacking roll is waiting.');
  const ship=room.starships.find(s=>s.id===order.shipId),item=ship&&maintenance.local(ship,unit.location),secret=state(room).secrets[key(order.shipId,order.sicId)];
  const success=puzzle.counterSuccess(value,skill(unit));
  if(!item||item.id!==order.sicId||!secret||secret.id!==order.secretId)throw Error('This SIC changed before the roll resolved.');
  if(success)unit.counterHackSwap={...order,id:pending.id,length:secret.password.length,rollController:pending.rollController};
  unit.delayedAction=null;
  return success?'Counter-hack succeeded. Choose two password positions to swap.':'Counter-hack failed. Password unchanged.';
}
function swap(room,unit,body,gm) {
  const request=unit.counterHackSwap;
  if(!request||request.id!==body.swapId)throw Error('No successful counter-hack is awaiting a swap.');
  if(request.rollController==='gm'&&!gm)throw Error('The GM owns this counter-hack.');
  const ship=room.starships.find(s=>s.id===request.shipId),item=ship&&maintenance.local(ship,unit.location),secret=state(room).secrets[key(request.shipId,request.sicId)];
  if(!stations.conscious(unit)||item?.id!==request.sicId||secret?.id!==request.secretId)throw Error('The operator or SIC is no longer available.');
  puzzle.swap(secret,body.first,body.second);unit.counterHackSwap=null;
}
function project(room,unit) {
  return state(room).sessions.filter(s=>s.unitId===unit.id).map(session=>{
    let board;try{board=challenge(room,session);}catch{}
    const changed=skill(unit)>=2&&board&&board.version!==session.observedVersion;
    return {id:session.id,moduleId:session.moduleId,sourceId:session.sourceId,targetId:session.targetId,sicId:session.sicId,
      connected:session.connected,solved:session.solved,control:session.control&&session.connected,captured:session.control,invalidated:session.invalidated,length:board?.length||0,candidates:board?.candidates||[],codeChanged:Boolean(changed),
      history:session.history.map(({version,...entry})=>({...entry,...(skill(unit)>=2?{stale:version!==board?.version}:{})}))};
  });
}
function capturedView(visible,full,characterId) {
  const unit=full.units.find(u=>u.characterId===characterId);
  if(!unit)return visible;
  const source=visible.starships.find(s=>s.id===unit.location?.starshipId);
  const grants=(unit.hackingSessions||[]).filter(s=>s.connected&&s.control).flatMap(g=>{
    const target=full.starships.find(s=>s.id===g.targetId);
    return maps.definition(itemAt(target,g.sicId)?.type).bridge?maps.installedItems(target).map(i=>({...g,sicId:i.id,bridgeCapture:true})):[g];
  });
  if(!grants.length)return visible;
  // A captured sensor console exposes its own sensor picture, never the raw enemy ship or crew.
  const sensorPictures=grants.filter(g=>maps.definition(itemAt(full.starships.find(s=>s.id===g.targetId),g.sicId)?.type).sensor).map(g=>sensors.view({...full,sensorObserverId:null},g.targetId));
  for(const picture of sensorPictures){
    const extra=picture.starships.filter(s=>s.id!==picture.sensorObserverId&&!visible.starships.some(v=>v.id===s.id));
    visible={...visible,starships:[...visible.starships,...extra],shipPositions:[...visible.shipPositions,...picture.shipPositions.filter(p=>extra.some(s=>s.id===p.id))]};
  }
  return {...visible,starships:visible.starships.map(ship=>{
    const controlled=grants.filter(g=>g.targetId===ship.id),actual=full.starships.find(s=>s.id===ship.id);
    if(!controlled.length||!actual)return ship;
    const sensorPicture=sensorPictures.find(p=>p.sensorObserverId===ship.id)?.starships.find(s=>s.id===ship.id);
    const environment=controlled.some(g=>maps.definition(itemAt(actual,g.sicId)?.type).utility==='life-support')?{gravityEnabled:actual.ship.gravityEnabled,oxygenEnabled:actual.ship.oxygenEnabled}:{};
    if(controlled.some(g=>maps.definition(itemAt(actual,g.sicId)?.type).cloaking))environment.cloakState=structuredClone(actual.ship.cloakState||null);
    const launchers=controlled.filter(g=>maps.definition(itemAt(actual,g.sicId)?.type).missileLauncher);
    if(launchers.length){environment.missileAmmo=Object.fromEntries(launchers.map(g=>[g.sicId,structuredClone(actual.ship.missileAmmo?.[g.sicId]||{})]));environment.missileState={flights:[],cooldowns:Object.fromEntries(launchers.map(g=>[g.sicId,actual.ship.missileState?.cooldowns?.[g.sicId]||0]))};}
    return {...ship,auState:actual.auState,hackedSystems:actual.hackedSystems,
      ...(controlled.some(g=>g.bridgeCapture)?{navigation:actual.navigation,commandSystems:actual.commandSystems}:{}),
      sensorState:sensorPicture?.sensorState||{contacts:source?.sensorState?.contacts||{},analyses:source?.sensorState?.analyses||{},reports:[]},
      shieldSystems:Object.fromEntries(Object.entries(actual.shieldSystems||{}).filter(([id])=>controlled.some(g=>g.sicId===id))),
      auCommands:(actual.auCommands||[]).filter(c=>c.unitId===unit.id),
      lockState:{targets:(actual.lockState?.targets||[]).filter(l=>controlled.some(g=>g.sicId===l.systemId)),reports:(actual.lockState?.reports||[]).filter(r=>r.operatorId===unit.id),failures:controlled.some(g=>maps.definition(itemAt(actual,g.sicId)?.type).lockOn)?actual.lockState?.failures||{}:{}},
      weaponState:{repeatWindow:actual.weaponState?.repeatWindow||{},reports:(actual.weaponState?.reports||[]).filter(r=>r.operatorId===unit.id)},
      ship:{...ship.ship,...environment,sicInventory:(ship.ship?.sicInventory||[]).map(item=>controlled.some(g=>g.sicId===item.id)?structuredClone(itemAt(actual,item.id)||item):item)}};
  })};
}
function publicUnit(room,unit){
  const result={...unit,hackingSessions:project(room,unit)};
  const withoutSecret=request=>{const {secretId,...visible}=request;return visible;};
  if(unit.delayedAction?.counterHack)result.delayedAction={...unit.delayedAction,counterHack:withoutSecret(unit.delayedAction.counterHack)};
  if(unit.counterHackSwap)result.counterHackSwap=withoutSecret(unit.counterHackSwap);
  return result;
}
module.exports={state,skill,firewall,refresh,command,counterRoll,swap,project,connected,challenge,capturedView,publicUnit};
