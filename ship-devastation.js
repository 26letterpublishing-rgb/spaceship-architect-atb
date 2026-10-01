(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./ship-map-core'):root.SAShipMap,node?require('./station-access'):root.SAStationAccess,node?require('./ship-power'):root.SAShipPower);if(node)module.exports=api;else root.SADevastation=api;})(typeof window==='object'?window:null,function(maps,stations,power){
 const state=ship=>ship.ship.devastationState||={systems:{},receipts:[]};
 const system=(ship,id)=>state(ship).systems[id]||={phase:'idle',remaining:0,upkeep:0};
 const impaired=item=>Boolean(item?.impaired||item?.impairmentPoints>0||item?.status==='impaired');
 function available(room,ship,item){return !!item&&stations.online(item)&&!item.bootRemaining&&!impaired(item)&&ship.currentHullHp!==0&&!ship.destroyedAt&&ship.ship.warpState?.phase!=='traveling'&&!maps.cloaked(ship)&&power.output(ship,room.units).en>=power.demand(ship);}
 function reason(room,ship,item){if((room.units||[]).some(u=>u.delayedAction?.weaponOrder?.shipId===ship.id&&u.delayedAction.weaponOrder.sicId===item.id))return 'Firing input is already committed for this weapon.';if(!available(room,ship,item))return 'Restore weapon integrity and EN; disengage Cloaking or Warp.';const s=system(ship,item.id);return s.phase==='ready'?'':s.phase==='cooldown'?'Cooling down: '+Math.ceil(s.remaining)+' seconds.':s.phase==='charging'?'Charging: '+Math.ceil(s.remaining)+' seconds.':'Charge this weapon before firing.';}
 function command(room,unit,body,{outsideCombat=false}={}){try{
  const a=stations.access(room,unit,body.sicId);if(!a?.definition.devastation||a.blocked)throw Error('Operate an available Devastation Laser or Bridge station.');
  const data=state(a.ship),receipt=String(body.receipt||''),fingerprint=JSON.stringify([unit.id,body.sicId,body.kind]);if(!/^[\w-]{8,120}$/.test(receipt))throw Error('Missing command receipt.');const prior=data.receipts.find(r=>r.id===receipt);if(prior){if(prior.fingerprint!==fingerprint)throw Error('Receipt belongs to another command.');return {ok:true,duplicate:true,ship:a.ship,text:prior.text};}
  if(!outsideCombat&&(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold||unit.shieldRestabilizing))throw Error('Wait for your turn and finish the current action.');
  const s=system(a.ship,a.id);let text;
  if(body.kind==='devastation-charge'){
   if(s.phase!=='idle')throw Error(s.phase==='cooldown'?'Wait for the '+Math.ceil(s.remaining)+' second cooldown.':'This weapon already has a charge or is charging.');
   if(!available(room,a.ship,a.item))throw Error('Restore weapon integrity and EN; disengage Cloaking or Warp.');
   if(unit.shipAi)throw Error('Ship AI never spends AU.');
   if(!power.spend(room,a.ship.id,a.definition.chargeAu))throw Error('Charging requires '+a.definition.chargeAu+' AU now and every 12 seconds.');
   Object.assign(s,{phase:'charging',remaining:a.definition.chargeSeconds,upkeep:12});text=a.definition.name+' charging: '+s.remaining+' active seconds.';
  }else if(body.kind==='devastation-discharge'){
   if(!['charging','ready'].includes(s.phase))throw Error('There is no stored charge to release.');Object.assign(s,{phase:'idle',remaining:0,upkeep:0});text=a.definition.name+' charge released.';
  }else throw Error('Choose Charge or Release Charge.');
  s.message=text;data.receipts.push({id:receipt,fingerprint,text});data.receipts=data.receipts.slice(-100);return {ok:true,ship:a.ship,text};
 }catch(e){return {ok:false,error:e.message};}}
 function active(ship){return Object.values(ship.ship.devastationState?.systems||{}).some(s=>s.phase!=='idle');}
 function needsPower(ship){return active(ship)||Boolean(ship.ship.devastationState&&ship.auState&&ship.auState.current<power.output(ship).au);}
 function next(ship){return Math.min(12,...Object.values(ship.ship.devastationState?.systems||{}).filter(s=>s.phase!=='idle').map(s=>s.phase==='cooldown'?Math.max(1e-6,s.remaining):Math.max(1e-6,Math.min(s.upkeep,s.phase==='charging'?s.remaining:12))));}
 function advance(room,ship,seconds){for(const [id,s]of Object.entries(ship.ship.devastationState?.systems||{})){
  const item=maps.installedItems(ship).find(i=>i.id===id),d=maps.definition(item?.type);
  if(s.phase==='cooldown'){s.remaining=Math.max(0,s.remaining-seconds);if(s.remaining<1e-8){s.phase='idle';s.remaining=0;s.message='Cooldown complete. Ready to charge.';}continue;}
  if(!['charging','ready'].includes(s.phase))continue;
  if(!d.devastation||!available(room,ship,item)){Object.assign(s,{phase:'idle',remaining:0,upkeep:0,message:'Charge lost: weapon integrity, power or normal-space operation interrupted.'});if(item&&impaired(item))item.unstable=true;continue;}
  if(s.phase==='charging'){s.remaining=Math.max(0,s.remaining-seconds);if(s.remaining<1e-8){s.phase='ready';s.remaining=0;s.message='Weapon ready to fire.';}}
  s.upkeep-=seconds;
  if(s.upkeep<1e-8){const meter=ship.auState;if(!meter||meter.available<d.chargeAu){Object.assign(s,{phase:'idle',remaining:0,upkeep:0,message:'Charge lost: insufficient AU for upkeep.'});continue;}meter.current-=d.chargeAu;meter.available=Math.max(0,meter.current-meter.reserved);s.upkeep=12;}
 }}
 function fire(ship,id){const s=system(ship,id);if(s.phase!=='ready')return false;const seconds=maps.definition(ship.ship.sicInventory.find(i=>i.id===id)?.type).cooldownSeconds;Object.assign(s,{phase:'cooldown',remaining:seconds,upkeep:0,message:'Shot fired. Cooling down for '+seconds+' active seconds.'});return true;}
 return {state,system,active,needsPower,next,advance,command,reason,fire,available};
});
