const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power');
function command(room,unit,body,{outsideCombat=false}={}){
  const access=stations.access(room,unit,String(body.sicId||''));
  if(!access||access.blocked||!access.definition.cloaking)return {ok:false,error:'Operate an available Cloaking Device station or Bridge.'};
  const ship=access.ship,receipt=String(body.receipt||''),data=ship.ship.cloakState||={active:false,receipts:[]};
  if(!/^[\w-]{8,120}$/.test(receipt)||typeof body.enabled!=='boolean')return {ok:false,error:'Choose a cloaking setting.'};
  const prior=data.receipts?.find(r=>r===receipt||r.id===receipt);if(prior)return typeof prior==='object'&&prior.enabled!==body.enabled?{ok:false,error:'This command receipt was already used for another setting.'}:{ok:true,duplicate:true,ship};
  if(!outsideCombat&&(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.consoleHold||unit.delayTimer||unit.shieldRestabilizing||unit.pendingShipRolls?.length||room.attackResolution))return {ok:false,error:'Wait for your turn and finish the current action.'};
  if(body.enabled){
    if(maps.cloaked(ship))return {ok:false,error:'Cloaking is already active.'};
    if(access.item.impaired||access.item.impairmentPoints>0||access.item.status==='impaired')return {ok:false,error:'Repair the Cloaking Device first.'};
    if(power.output(ship,room.units).en<power.demand(ship))return {ok:false,error:'Insufficient EN to operate the Cloaking Device.'};
    if(ship.auCommands?.length||(room.units||[]).some(u=>u.delayedAction?.shipOrder?.shipId===ship.id||u.delayedAction?.weaponOrder?.shipId===ship.id||u.delayedAction?.missileOrder?.shipId===ship.id))return {ok:false,error:'Finish pending ship and weapon orders before cloaking.'};
    if(!power.spend(room,ship.id,12))return {ok:false,error:'Cloaking requires 12 available AU.'};
    data.sicId=access.item.id;data.remaining=12;
  }
  data.active=body.enabled;data.receipts=[...(data.receipts||[]),{id:receipt,enabled:body.enabled}].slice(-40);
  return {ok:true,ship,enabled:data.active,resetAtb:!outsideCombat,text:`${unit.characterName}: Cloaking Device ${data.active?'activated':'deactivated'} aboard ${ship.title}${outsideCombat?'':'; turn used'}.`};
}
module.exports={command};
