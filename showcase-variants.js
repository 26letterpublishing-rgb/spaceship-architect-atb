const build=require('./showcase-fleet-builder');
const roles=[
 ['science',['Foundry','Workshop'],'Fabrication, mineral processing & research',['mining-laser','vulture-drone','science-lab','3d-printer','mineral-processor','library','tractor-beam','manipulation-arm']],
 ['devastation',['Hothead','Sunburn'],'Charged lasers, rail weapons & layered shields',['devastation-laser-1','ion-disruptor','ionic-force-displacers','ballistic-rail-repeater','ballistic-rail-cannon','shield-2','static-shield','burst-shield-reactivator','emergency-shield-recharger','ripple-reflector']],
 ['transport',['Gatecrasher','Party Crasher'],'Boarding, cameras, brig & escape pods',['transporter','transport-scrambler','surv-camera','brig','escape-pods','hacking-module-3','medbay']],
 ['mines',['Breadcrumbs','Tripwire'],'Mines, missiles, flares & salvage',['mine-launcher','missile-launcher-1','tractor-beam','manipulation-arm','surv-camera']],
 ['cloak',['Peekaboo','Hideaway'],'Cloaking, Darkveil, hacking & security',['analysis-screening','cloaking-device','darkveil-8','hacking-module-4','scramble-box','hack-alert','surv-camera','ion-pulse-cannon-3']],
 ['ai',['Autopilot','Handyman'],'Ship AI, repairs, defenses & backup power',['hull-breach-repair-drone','ship-ai','holographic-projector','backup-generator','shield-2','static-shield','vulnerability-fortification','power-core-damper','hull-plating','heat-resistance','laser-resistance']],
 ['crew',['Clubhouse','Lifeboat'],'Crew rooms, training, medicine & survival',['vr-training-room','medbay','library','surv-camera','gym','meeting-room','bar','hibernation-chamber','brig','escape-pods']],
 ['warp',['Road Trip','Long Haul'],'Warp, gravity immunity, docking & land travel',['warp-drive-2','ew-ftl-drive','gravity-absolution-field','docking-bay','land-wheels','hibernation-chamber']],
 ['sensors',['Lookout','Radar Love'],'Sensors, antenna, hacking & reflected fire',['antenna-4','surv-camera','hacking-module-5','ripple-reflector','ripple-cannon-5','beam-laser-5']],
 ['probes',['Scout','Busybody'],'All probe grades, attachments, hacking & salvage',['probe-launcher','hacking-module-3','tractor-beam','manipulation-arm','docking-bay']]
];
const colors=['#48d9eb','#fa9c68','#b39cff','#f1d16a','#73d9a2','#79a8ff','#f39bc3','#b9d56f','#ee7b85','#94c9e7','#58d2b3','#f5b576','#c4a6ed','#d6c269','#a8cfb9','#91b3ef','#e9a7d2','#c8d78a','#f19c91','#b5d5e8'];
let cached;
module.exports=function(){if(cached)return structuredClone(cached);const result=[];for(const side of ['pc','gm'])for(const [key,names,focus,source]of roles){const types=source.map(t=>side==='gm'&&t==='devastation-laser-1'?'devastation-laser-2':t);result.push(build({id:`showcase-${side}-${key}`,title:names[side==='pc'?0:1],side,focus,types,color:colors[result.length],large:['crew','warp','devastation'].includes(key)}));}
 result.push(build({id:'showcase-pc-cleanser',title:'Cleaning Lady',focus:'Planetary Cleanser, Black Hole Gun & layered shields',color:'#d99bff',large:true,types:['planetary-cleanser','black-hole-gun','shield-2','static-shield','self-destruct','surv-camera']}));
 const menace=require('./showcase-menace')();menace.title=menace.ship.title='Menace';menace.ship.class='Capital ship: Cleanser, cloaking, gravity & heavy weapons';menace.ship.mapColor='#ec738d';result.push(menace);cached=structuredClone(result);return result;};
module.exports.roles=roles;
