const maps=require('./ship-map-core'),build=require('./showcase-fleet-builder');
module.exports=function(id,crew=[],npcs=[]){
 const types=['en-engine-6','en-engine-6','en-engine-6','au-engine-6','bridge-4','sensors-8','life-support','nutritional-supplement','cpu-security-4','lock-on-8','shield-2','shield-1','repair-drone-3','medbay','meeting-room','gym','library','escape-pods','surv-camera','exhaust-thruster-5','exhaust-thruster-5','exhaust-thruster-5','ionic-pulse-thruster-5',
 'rapid-laser-5','beam-laser-4','ripple-cannon-4','ion-pulse-cannon-1','missile-launcher-3','darkveil-4','hacking-module-5','warp-drive-5','science-lab','3d-printer','mineral-processor','security-droid','black-hole-gun','mine-launcher','transporter','sensor-lure','remote-controller','remote-receiver','lock-on-triangulator','phazon-torpedo-launcher','hull-breach-repair-drone','relay-pulse-sub-triangulator','pulse-relay-echo-reverberator','analysis-screening','probe-launcher','hull-plating','heat-resistance','laser-resistance','burst-shield-reactivator','emergency-shield-recharger','static-shield','antenna-4','holographic-projector','vulnerability-fortification','power-core-damper','scramble-box','vr-training-room','ship-ai','bar','hibernation-chamber','brig','cloaking-device','devastation-laser-2','ballistic-rail-cannon','ballistic-rail-repeater','self-destruct','manipulation-arm','tractor-beam','docking-bay','ripple-reflector','ionic-force-displacers','transport-scrambler','hack-alert','ion-disruptor','gravity-absolution-field','land-wheels','mining-laser','vulture-drone'];
 const record=build({id,title:'Jack-of-Everything',side:'pc',color:'#35c9ff',focus:'400-hull testing flagship · weapons, science, boarding, drones & warp',everything:true,crew,npcs,types});
 record.ship.sicInventory.push({id:id+'-spare-ew-ftl',type:'ew-ftl-drive',storage:true,status:'stored',stationLayout:'corners-v1'});
 record.ship.groupCredits=9999999;
 for(const type of Object.keys(require('./missile-ammunition').catalog))record.ship.missileStorage[type]=100;
 const launcher=record.ship.sicInventory.find(i=>i.type==='missile-launcher-3');
 record.ship.missileAmmo[launcher.id]={'missile-1':2,'spread-missiles-1':2,'spread-missiles-5':1,'missile-5':2,'missile-flares':1};
 for(const grade of Object.keys(record.ship.warpFuel))record.ship.warpFuel[grade]=100;
 return record;
};
