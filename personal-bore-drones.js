'use strict';
const arena=require('./combat-arena');
const {randomUUID}=require('node:crypto');
function launch(room,owner,kind,target,charges=0){
  const hp=kind==='hull-bore'?8:5,drone={id:'bore-'+randomUUID(),characterName:kind==='hull-bore'?'Hull Bore':'Skull Bore',playerName:owner.characterName,team:'npc',controlledBy:'gm',personalDrone:true,ownerId:owner.id,kind,speed:0,atb:0,moveSpeed:1+charges,currentHp:hp,maximumHp:hp,damageReduction:0,defenseScore:14,color:owner.color||'#d8bb74',location:{...owner.location},weapons:[],items:[],statuses:{},targetId:target?.id,targetLocation:target?.location?{...target.location}:null,flightProgress:0};
  room.units.push(drone);return drone;
}
function advance(room,effect,elapsed){
  const drone=room.units.find(u=>u.id===effect.droneId);
  if(!drone||drone.currentHp<=0||drone.defeatedAt){effect.cancelled=true;return false;}
  const target=drone.targetId?room.units.find(u=>u.id===drone.targetId):null;
  if(drone.targetId&&!target){effect.cancelled=true;return false;}
  const destination=target?.location||drone.targetLocation,g=arena.grid(room,drone.location);
  if(!g||!destination){effect.cancelled=true;return false;}
  let from=g.index(drone.location),to=g.index(destination);
  drone.flightProgress+=elapsed*Math.max(1,drone.moveSpeed)/3;
  let budget=Math.floor(drone.flightProgress);drone.flightProgress-=budget;
  while(budget>0&&from!==to){
    const dx=Math.sign(to%g.width-from%g.width),dy=Math.sign(Math.floor(to/g.width)-Math.floor(from/g.width));
    const choices=[from+dy*g.width+dx,from+dx,from+dy*g.width].filter(n=>n!==from);
    const next=choices.find(n=>g.floor.has(n)&&arena.canTarget(room,{location:g.location(from)},{location:g.location(n)}));
    if(next===undefined)break;from=next;drone.location=g.location(from);budget--;
  }
  if(from!==to){effect.remaining=Math.max(.1,(arena.distance(room,drone,{location:destination})||1)*3/Math.max(1,drone.moveSpeed)+(effect.weaponId==='hull-bore'?18:0));return false;}
  if(effect.weaponId==='hull-bore'){
    const drillingTime=effect.arrived?elapsed:budget*3/Math.max(1,drone.moveSpeed);
    effect.drillRemaining=(effect.drillRemaining??18)-drillingTime;effect.arrived=true;effect.remaining=Math.max(0,effect.drillRemaining);return effect.remaining<=1e-7;
  }
  drone.attachedId=target?.id;effect.remaining=0;return true;
}
function cleanup(room){
  for(const u of room.units){
    u.weaponTimers=(u.weaponTimers||[]).filter(t=>!t.droneId||room.units.some(d=>d.id===t.droneId&&d.currentHp>0&&!d.defeatedAt));
    if(u.personalDrone&&u.attachedId){const target=room.units.find(t=>t.id===u.attachedId);if(target)u.location={...target.location};}
  }
}
module.exports={launch,advance,cleanup};
