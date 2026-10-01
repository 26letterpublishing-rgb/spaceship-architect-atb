const maps = require('./ship-map-core');
const stations = require('./station-access');
const oxygen = require('./ship-oxygen');

function setGravity(room, unit, body, { outsideCombat = false, gm = false, campaign } = {}) {
  const access=stations.access(room,unit,String(body.sicId||''));
  if(access?.definition.blackHoleGun)return require('./ship-black-hole-gun').command(room,unit,body,{outsideCombat});
  if(access?.definition.devastation)return require('./ship-devastation').command(room,unit,body,{outsideCombat});
  if(access?.definition.transporter)return require('./ship-transporter').command(room,unit,body,{outsideCombat});
  if(access?.definition.planetaryCleanser)return require('./ship-cleanser').command(room,unit,body,{outsideCombat});
  if(access?.definition.gravityField)return require('./ship-black-holes').command(room,unit,body,{outsideCombat});
  if(access?.definition.cloaking)return require('./ship-cloaking').command(room,unit,body,{outsideCombat});
  if(access?.definition.probeLauncher)return require('./ship-probes').command(room,unit,body,{outsideCombat});
  if(access?.definition.repairDrone)return outsideCombat?{ok:false,error:'Repair drone orders use an ATB turn during combat.'}:require('./ship-drones').command(room,unit,body);
  if(access?.definition.fieldUtility)return require('./ship-field-utilities').command(room,unit,body,{outsideCombat,gm,campaign});
  if(!access||access.blocked||access.definition.utility!=='life-support')return {ok:false,error:'Occupy an available Life Support or bridge station to operate environmental controls.'};
  if(!['gravity','oxygen'].includes(body.kind)||typeof body.enabled!=='boolean')return {ok:false,error:'Choose a gravity or oxygen setting.'};
  if(access.item.impaired||access.item.status==='impaired')return {ok:false,error:'Repair Life Support before changing its environmental settings.'};
  const ship=access.ship;
  if(!outsideCombat){
    const receipt=String(body.receipt||'').slice(0,120);
    if(receipt.length<8)return {ok:false,error:'Missing Life Support command receipt.'};
    if((unit.utilityReceipts||[]).includes(receipt))return {ok:true,duplicate:true,ship};
    if(oxygen.pending(room.starships)||room.attackResolution||room.itemResolution||(room.units||[]).some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length))return {ok:false,error:'Finish the pending roll before operating Life Support.'};
    if(room.activeId!==unit.id||unit.consoleHold||unit.delayedAction||unit.timedAction||unit.shieldRestabilizing||unit.auRestabilizing)return {ok:false,error:'Wait for your turn and finish any pending action.'};
    unit.utilityReceipts=[...(unit.utilityReceipts||[]),receipt].slice(-30);
  }
  if(body.kind==='oxygen'){
    oxygen.setEnabled(ship,body.enabled);
    return {ok:true,ship,enabled:body.enabled};
  }
  ship.ship.gravityEnabled=body.enabled;
  for(const traveler of room.units||[])if(traveler.location?.starshipId===ship.id)maps.updateMovementGravity(traveler.timedAction,maps.gravityEnabled(ship)?1:.5);
  return {ok:true,ship,enabled:maps.gravityEnabled(ship)};
}

module.exports={setGravity};
