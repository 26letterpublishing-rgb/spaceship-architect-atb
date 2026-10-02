const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power');
const identity=u=>u.characterId||u.id;
function state(ship){return ship.ship.remoteState||={controllers:{},receipts:[]};}
function control(ship,id){return state(ship).controllers[id]||={links:[],selected:{},cooldown:0};}
function command(room,unit,body,{campaign,outsideCombat=false}={}){
 const access=stations.access(room,unit,body.sicId),physical=stations.physicalStation(room,unit);
 if(!access||(!access.definition.remoteController&&!access.definition.remoteReceiver)||access.offline)return {ok:false,error:'Use an available Remote Controller or Receiver.'};
 const ship=access.ship,receipt=String(body.receipt||'');if(!/^[\w-]{8,120}$/.test(receipt))return {ok:false,error:'Missing command receipt.'};
 if(state(ship).receipts.includes(receipt))return {ok:true,duplicate:true,ship,free:true};
 const remotes=stations.remotes(room,unit),local=physical?.ship.id===ship.id;
 if(unit.delayedAction||unit.timedAction||unit.pendingShipRolls?.length)return {ok:false,error:'Finish the current action first.'};
 let text='';
 if(body.kind==='remote-take'){
  if(!access.definition.remoteController||!local||physical.cell.sicId!==access.id)return {ok:false,error:'Station at the Controller to take its remote.'};
  const data=control(ship,access.id);if(data.holder&&data.holder!==identity(unit))return {ok:false,error:'Another character is carrying this remote.'};
  data.holder=identity(unit);const record=campaign?.characters?.find(c=>c.id===unit.characterId);
  if(record){record.character.items||=[];if(!record.character.items.some(i=>i.remoteControllerId===access.id))record.character.items.push({id:'remote-'+access.id,remoteControllerId:access.id,catalogId:'personal-remote-controller',name:'Personal Remote Controller',description:'Size C. Linked to '+ship.title+'. Open Console View to operate linked receivers within 10 hexes.',sizeClass:'C',quantity:1,unitCost:0});}text='Remote Controller taken (Size C).';
 }else if(body.kind==='remote-link'){
  if(!access.definition.remoteReceiver||!local||maps.addonHost(ship,access.item)?.item.id!==physical.cell.sicId)return {ok:false,error:'Station at this Receiver’s Bridge with a carried remote.'};
  const remote=remotes.find(r=>r.carried&&(!body.controllerId||r.item.id===body.controllerId));if(!remote)return {ok:false,error:'Carry a Remote Controller first.'};
  const data=control(remote.home,remote.item.id);data.links=[...new Set([...data.links,ship.id])];text='Receiver linked to '+remote.home.title+'.';
 }else if(body.kind==='remote-select'||body.kind==='remote-disconnect'){
  const remote=remotes.find(r=>r.item.id===access.id);if(!remote)return {ok:false,error:'Station here or carry this remote.'};
  if(body.kind==='remote-select'&&!remote.links.some(s=>s.id===body.targetId))return {ok:false,error:'Selected receiver is not linked, powered or within 10 hexes.'};
  control(remote.home,remote.item.id).selected[identity(unit)]=body.kind==='remote-disconnect'?null:body.targetId;text=body.kind==='remote-disconnect'?'Remote view disconnected.':'Remote Bridge access connected.';
 }else if(body.kind==='remote-unlink'){
  if(!access.definition.remoteReceiver||!local)return {ok:false,error:'Use the receiving ship’s local Bridge.'};
  for(const home of room.starships)for(const data of Object.values(home.ship.remoteState?.controllers||{})){data.links=data.links.filter(id=>id!==ship.id);for(const key of Object.keys(data.selected||{}))if(data.selected[key]===ship.id)delete data.selected[key];}text='Receiver unlinked.';
 }else if(body.kind==='remote-cancel'){
  if(!access.definition.remoteReceiver||!local)return {ok:false,error:'Only local Bridge crew may cancel remote orders.'};
  for(const other of room.units||[]){const task=other.delayedAction,order=task&&(task.shipOrder||task.weaponOrder||task.missileOrder||task.lockOrder||task.sensorOrder||task.commandOrder);if(other.location?.starshipId!==ship.id&&order?.shipId===ship.id){other.delayedAction=null;other.remoteBatch=[];}}
  if(ship.navigation?.pilotId&&room.units.find(u=>u.id===ship.navigation.pilotId)?.location?.starshipId!==ship.id)ship.navigation=null;text='Local crew cancelled incoming remote orders.';
 }else return {ok:false,error:'Unknown remote command.'};
 state(ship).receipts=[...state(ship).receipts,receipt].slice(-100);return {ok:true,ship,free:true,text};
}
function advance(room,seconds){for(const ship of room.starships||[])for(const data of Object.values(ship.ship.remoteState?.controllers||{}))data.cooldown=Math.max(0,(data.cooldown||0)-seconds);}
function accessFor(room,unit,body){const a=stations.access(room,unit,body.sicId);return a?.remotePilot?a:null;}
function validate(room,unit,body){const access=accessFor(room,unit,body);if(!access)return null;const remote=stations.remotes(room,unit).find(r=>r.links.some(s=>s.id===access.ship.id)&&r.state.selected?.[identity(unit)]===access.ship.id);if(!remote)return 'Remote connection lost.';if(remote.state.cooldown>1e-7)return 'Remote Controller is cycling: '+remote.state.cooldown.toFixed(1)+' active seconds.';return null;}
function capture(room,unit,body,access){
 if(!access?.remotePilot||unit.remoteBatch?.length)return;
 const remote=stations.remotes(room,unit).find(r=>r.state.selected?.[identity(unit)]===access.ship.id);if(!remote)return;
 const data=control(remote.home,remote.item.id),receipt=body.requestId||body.receipt;data.broadcastReceipts||=[];if(receipt&&data.broadcastReceipts.includes(receipt))return;if(receipt)data.broadcastReceipts=[...data.broadcastReceipts,receipt].slice(-100);data.cooldown=12;
 const origin=require('./ship-targets').point(room,access.ship.id),delta=body.destination&&origin?{q:body.destination.q-origin.q,r:body.destination.r-origin.r}:null;
 unit.remoteBatch=remote.links.filter(s=>s.id!==access.ship.id).map(s=>({shipId:s.id,controllerId:remote.item.id,homeId:remote.home.id,primary:access.ship.id,body:structuredClone(body),type:access.item.type,delta}));
}
function next(room,unit){
 if(!unit.remoteBatch?.length||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.pendingShipRolls?.length||room.units.some(u=>u.delayedAction?.awaitingRoll)||room.starships.some(s=>s.auCommands?.some(c=>c.unitId===unit.id)))return false;
 const job=unit.remoteBatch.shift(),home=room.starships.find(s=>s.id===job.homeId),remote=stations.remotes(room,unit).find(r=>r.item.id===job.controllerId),target=remote?.links.find(s=>s.id===job.shipId),item=target&&maps.installedItems(target).find(i=>i.type===job.type&&stations.online(i));
 const report=text=>{unit.remoteReports=[...(unit.remoteReports||[]),text].slice(-12);};
 if(!target||!item||!home||!(home.auState?.available>=4)){report((target?.title||'Receiver')+': skipped (signal, matching SIC or 4 AU unavailable).');return true;}
 const cfg=control(home,job.controllerId),previous=cfg.selected[identity(unit)],active=room.activeId;cfg.selected[identity(unit)]=target.id;room.activeId=unit.id;
 const body={...job.body,sicId:item.id,requestId:require('node:crypto').randomUUID(),receipt:require('node:crypto').randomUUID()};
 if(job.delta){const p=require('./ship-targets').point(room,target.id);body.destination={q:Math.round(p.q+job.delta.q),r:Math.round(p.r+job.delta.r)};body.boostIds=[];}
 let result;power.spend(room,home.id,4);
 try{
  if(body.action==='weaponCommand')result=require('./ship-weapons').queue(room,unit,body);
  else if(body.action==='lockCommand')result=require('./ship-locks').queue(room,unit,body);
  else if(body.action==='sensorCommand')result=require('./ship-sensors').queue(room,unit,body);
  else if(body.action==='shipCommand')result=require('./ship-commands').queue(room,unit,body);
  else if(body.action==='playerCombatAction'&&body.kind==='moveStarship')result=require('./ship-navigation').queue(room,unit,body);
  else if(body.action==='shieldCommand')result=require('./ship-shields').command(room,unit,body);
  else if(body.action==='utilityCommand')result=require('./ship-utilities').setGravity(room,unit,body);
  else result={ok:false,error:'This command has no equivalent receiver action.'};
 }catch(e){result={ok:false,error:e.message};}finally{room.activeId=active;}
 if(result?.ok){report(target.title+': command accepted.');unit.remoteReturn={homeId:home.id,controllerId:job.controllerId,targetId:previous};}
 else{home.auState.current+=4;home.auState.available+=4;cfg.selected[identity(unit)]=previous;report(target.title+': skipped — '+result?.error);}
 return true;
}
function restore(room,unit){if(unit.remoteReturn&&!unit.delayedAction&&!unit.timedAction&&!unit.pendingShipRolls?.length){const r=unit.remoteReturn,home=room.starships.find(s=>s.id===r.homeId);if(home)control(home,r.controllerId).selected[identity(unit)]=r.targetId;delete unit.remoteReturn;}}
function project(visible,full,characterId){
 const unit=full.units.find(u=>u.characterId===characterId);if(!unit)return visible;
 const remotes=stations.remotes(full,unit);if(!remotes.length)return visible;
 let result={...visible,starships:[...visible.starships],shipPositions:[...visible.shipPositions]};
 for(const remote of remotes){
  const home=result.starships.find(s=>s.id===remote.home.id);if(home)home.ship={...home.ship,remoteState:structuredClone(remote.home.ship.remoteState)};
  const target=remote.links.find(s=>s.id===remote.state.selected?.[identity(unit)]);if(!target)continue;
  const picture=require('./ship-sensors').view({...full,sensorObserverId:null},target.id);
  for(const ship of picture.starships){const i=result.starships.findIndex(s=>s.id===ship.id);if(i<0)result.starships.push(ship);else if(ship.id===target.id)result.starships[i]=ship;}
  for(const pos of picture.shipPositions){const i=result.shipPositions.findIndex(p=>p.id===pos.id);if(i<0)result.shipPositions.push(pos);else if(pos.id===target.id)result.shipPositions[i]=pos;}
 }
 return result;
}
module.exports={project,state,control,command,advance,validate,accessFor,capture,next,restore};
