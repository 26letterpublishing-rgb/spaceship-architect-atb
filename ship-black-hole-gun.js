'use strict';
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power'),distances=require('./ship-distances'),crypto=require('node:crypto');
const cost=n=>n*(n+1)/2;
const state=ship=>ship.ship.blackHoleGunState||={cooldowns:{},receipts:[]};
function command(room,unit,body,{outsideCombat=false}={}){try{
 const a=stations.access(room,unit,body.sicId);if(!a?.definition.blackHoleGun||a.blocked)throw Error('Use an available Black Hole Gun console.');
 if(outsideCombat)throw Error('Begin an encounter to launch a black hole.');
 const data=state(a.ship),receipt=String(body.receipt||''),intensity=Number(body.intensity),q=Number(body.q),r=Number(body.r),fingerprint=JSON.stringify([unit.id,a.id,intensity,q,r]);
 if(!/^[-\w]{8,120}$/.test(receipt))throw Error('Missing launch receipt.');
 const previous=data.receipts.find(p=>p.id===receipt);if(previous){if(previous.fingerprint!==fingerprint)throw Error('Launch receipt already used.');return {ok:true,duplicate:true,ship:a.ship};}
 if(room.activeId!==unit.id||unit.timedAction||unit.delayedAction||unit.delayTimer||unit.consoleHold||unit.shieldRestabilizing)throw Error('Wait for your turn and finish the current action.');
 if(unit.shipAi)throw Error('Ship AI never spends AU.');
 if(!Number.isInteger(intensity)||intensity<1||intensity>100)throw Error('Choose an intensity from 1 to 100.');
 const origin=distances.positions(room.starships,room.shipPositions).find(p=>p.id===a.ship.id);
 if(!Number.isInteger(q)||!Number.isInteger(r)||Math.abs(q)>10000||Math.abs(r)>10000||!origin||distances.hexDistance(origin,{q,r})>5+1e-7)throw Error('Choose a whole hex within 5 units.');
 if(a.item.impaired||a.item.impairmentPoints||a.item.status==='impaired'||a.item.unstable||a.item.bootRemaining)throw Error('Repair and restart the gun before firing.');
 if(a.ship.currentHullHp<=0||a.ship.escapedAt||a.ship.dockedIn||maps.cloaked(a.ship)||a.ship.ship.warpState?.phase==='traveling'||power.output(a.ship,room.units).en<power.demand(a.ship))throw Error('Restore ship power and disengage cloak or warp.');
 if(data.cooldowns[a.id]>0)throw Error('Gun cooling down: '+Math.ceil(data.cooldowns[a.id])+' seconds.');
 if((room.spaceObjects||[]).length>=100)throw Error('The map already holds 100 objects.');
 const mineral=['Dark Phazon','Dark Phaeon'].find(k=>Number(a.ship.ship.minerals?.[k])>=1);if(!mineral)throw Error('Requires 1 Dark Phazon in ship storage.');
 if(!power.spend(room,a.ship.id,cost(intensity)))throw Error('Requires '+cost(intensity)+' available AU.');
 a.ship.ship.minerals[mineral]--;data.cooldowns[a.id]=360;
 const distance=distances.hexDistance(origin,{q,r}),id='object-'+crypto.randomUUID();room.spaceObjects||=[];
 room.spaceObjects.push({id,kind:'object',name:'Black Hole Orb '+id.slice(-6).toUpperCase(),q:origin.q,r:origin.r,quantity:1,mineral:null,gunOrb:{target:{q,r},intensity,remaining:distance*12},pullCycle:{remaining:0,fields:[]}});
 data.receipts.push({id:receipt,fingerprint});data.receipts=data.receipts.slice(-100);
 return {ok:true,ship:a.ship,resetAtb:true,text:'Black Hole Gun launched toward '+q+', '+r+'; intensity '+intensity+', '+cost(intensity)+' AU and 1 Dark Phazon spent.'};
 }catch(error){return {ok:false,error:error.message};}}
function cooldowns(room,seconds){if(!(seconds>0)||!Number.isFinite(seconds))return;for(const ship of room.starships||[])for(const id of Object.keys(ship.ship.blackHoleGunState?.cooldowns||{}))ship.ship.blackHoleGunState.cooldowns[id]=Math.max(0,ship.ship.blackHoleGunState.cooldowns[id]-seconds);}
function advance(room,seconds){
 if(!(seconds>0)||room.hardPaused||room.holdPaused)return;
 cooldowns(room,seconds);
 room.spaceObjects=(room.spaceObjects||[]).filter(o=>{
  if(o.gunDecay){o.gunDecay.remaining-=seconds;while(o.gunDecay.remaining<=1e-8){o.intensity--;o.gunDecay.remaining+=15;}return o.intensity>0;}
  if(!o.gunOrb)return true;
  const flight=o.gunOrb,fraction=flight.remaining>0?Math.min(1,seconds/flight.remaining):1;
  o.q+=(flight.target.q-o.q)*fraction;o.r+=(flight.target.r-o.r)*fraction;flight.remaining=Math.max(0,flight.remaining-seconds);
  if(flight.remaining<=1e-8){o.q=flight.target.q;o.r=flight.target.r;o.kind='black-hole';o.name='Temporary Black Hole '+o.id.slice(-6).toUpperCase();o.intensity=flight.intensity;o.gunDecay={remaining:15};delete o.gunOrb;delete o.pullCycle;
   for(const ship of room.starships||[]){const p=room.shipPositions?.find(p=>p.id===ship.id);if(!p||maps.gravityFieldActive(ship)||ship.dockedIn||ship.escapedAt||ship.ship.warpState?.phase==='traveling')continue;const hex=distances.roundHex(p);if(hex.q===o.q&&hex.r===o.r){ship.currentHullHp=ship.ship.currentHullHp=0;ship.navigation=null;}}
  }return true;
 });
}
module.exports={cost,state,command,advance,cooldowns};
