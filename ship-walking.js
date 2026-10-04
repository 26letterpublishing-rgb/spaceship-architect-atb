(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ship-map-core'));else root.SAShipWalking=factory(root.SAShipMap);})(typeof window==='object'?window:this,function(maps){
 function point(p,columns){return {x:p.square%columns+(p.mesh%3+.5)/3,y:Math.floor(p.square/columns)+(Math.floor(p.mesh/3)+.5)/3};}
 function plan(record,id,destination,speed,now=Date.now()){
  const start=record.characterLocations[id],layout=maps.buildLayout(record.ship),route=maps.meshRoute(layout,start,destination);
  if(!route)throw Error('No route through the doorways reaches that location.');
  let from=start,end=0;const steps=[];
  for(const to of route){const edge=from.square!==to.square?layout.edge(from.square,to.square):null,door=edge?.kind==='door'?edge:null;
   const wait=door&&record.ship.doorStates?.[door.key]!=='open'?600:0;
   const duration=maps.walkingMilliseconds(from,to,speed,layout.columns)*(maps.gravityEnabled(record)?1:2);
   steps.push({from:{square:from.square,mesh:from.mesh},to,begin:end+wait,end:end+wait+duration,doorKey:door?.key});end+=wait+duration;from=to;
  }
  return {startedAt:now,duration:end,columns:layout.columns,steps,destination,gravity:maps.gravityEnabled(record),updatedAt:now};
 }
 function sample(job,now=Date.now()){
  const elapsed=Math.max(0,now-job.startedAt),step=job.steps.find(s=>s.end>elapsed),done=!step;
  if(done){const p=job.destination;return {...point(p,job.columns),location:p,done:true,walking:false,heading:0};}
  const f=Math.max(0,Math.min(1,(elapsed-step.begin)/Math.max(1,step.end-step.begin))),a=point(step.from,job.columns),b=point(step.to,job.columns);
  return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f,location:f<.5?step.from:step.to,heading:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+90,walking:elapsed>=step.begin,done:false,openDoorKeys:step.doorKey?[step.doorKey]:[]};
 }
 function advance(record,now=Date.now(),stop=false){const changed=[];for(const [id,job]of Object.entries(record.characterWalks||{})){
  // Change the remaining travel time, never the position already reached.
  const gravity=maps.gravityEnabled(record),elapsed=Math.max(0,(job.updatedAt||job.startedAt)-job.startedAt);
  if(job.gravity!==undefined&&job.gravity!==gravity){const factor=gravity ? 0.5 : 2;for(const step of job.steps){if(step.end>elapsed){step.begin=elapsed+(step.begin-elapsed)*factor;step.end=elapsed+(step.end-elapsed)*factor;}}job.duration=job.steps.at(-1)?.end||0;job.gravity=gravity;}
  job.updatedAt=now;
  const value=sample(job,now);record.characterLocations[id]={carryingId:record.characterLocations[id]?.carryingId||null,...value.location,...(!value.done?{stationed:false,stationSlot:null}:{})};
  const passenger=record.characterLocations[id].carryingId;if(passenger&&record.characterLocations[passenger])record.characterLocations[passenger]={...record.characterLocations[id],carryingId:null,carriedBy:id,stationed:false};
  if(value.done||stop){delete record.characterWalks[id];changed.push(id);}
 }return changed;}
 return {plan,sample,advance};
});
