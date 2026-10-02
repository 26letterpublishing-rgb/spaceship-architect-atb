const maps=require('./ship-map-core'),sensors=require('./ship-sensors'),distances=require('./ship-distances'),targets=require('./ship-targets');
const at=(room,id)=>room.shipPositions.find(p=>p.id===id)||{q:0,r:0};
function fired(room,source,target,weaponId,{missile=false,random=Math.random}={}){
 if(!source||!target||source.id===target.id||target.isMissile||target.isDrone||target.isProbe||target.isMine||target.isFloatingBody||target.isSalvageDrone)return;
 const known=sensors.knowledge(target),origin=at(room,source.id);
 const relay=maps.installedItems(target).find(i=>maps.definition(i.type).relayTriangulator&&maps.operational(i));
 if(!missile&&relay&&(!(relay.impaired||relay.impairmentPoints>0||relay.status==='impaired')||random()<.5)){
  sensors.detect(room,target,source);sensors.report(target,{text:'Relay Pulse Sub-Triangulator: firing ship located.',targetId:source.id,relay:true});return;
 }
 if(known.contacts[source.id]?.level==='detected')return;
 const echo=maps.attachments(source,weaponId,'pulse-relay-echo-reverberator').some(i=>maps.operational(i)),radius=echo?12:3;
 const signal=source.ship.relaySignals||={},key=weaponId+':'+target.id,old=signal[key];
 let position=old?.q===origin.q&&old?.r===origin.r&&old?.radius===radius?old.position:null;
 if(!position){const offsets=[];for(let q=-radius;q<=radius;q++)for(let r=-radius;r<=radius;r++){const d=distances.hexDistance({q:0,r:0},{q,r});if(d<=radius&&d>(echo?2:0))offsets.push({q,r});}const o=offsets[Math.min(offsets.length-1,Math.floor(random()*offsets.length))];position={q:origin.q+o.q,r:origin.r+o.r};signal[key]={q:origin.q,r:origin.r,radius,position};}
 known.contacts[source.id]={id:'signal-'+target.id+'-'+weaponId,level:'unknown',title:'Unknown Object',position:{...position},uncertainty:radius,passive:true,firingSignal:true};
 sensors.report(target,{text:'Unknown Object: weapon signal detected.',unknownDetected:true,targetId:known.contacts[source.id].id});
}
function gmMarkers(room){const result=[];for(const observer of room.starships.filter(s=>s.controlType==='pc'))for(const [id,c]of Object.entries(observer.sensorState?.contacts||{})){if(!['unknown','last-known'].includes(c.level)||!c.position)continue;const target=targets.find(room,id);result.push({id:'gm-contact-'+observer.id+'-'+c.id,title:`${c.level==='last-known'?'Last Known Location':'Unknown Object'} (${target?.title||'Object'})`,observerTitle:observer.title,gmContactMarker:true,contactLevel:c.level,mapColor:c.level==='last-known'?'#ff575f':'#75d9ef',uncertainty:c.uncertainty,position:{...c.position},ship:{gridCells:[],placements:[],sicInventory:[]}});}return result;}
module.exports={fired,gmMarkers};
