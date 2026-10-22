'use strict';
// Intersect the traveled line with the actual hex cells around a star. This
// also covers fast-forwarded journeys without sampling or revealing a corridor.
const neighbors=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
function crossesHex(from,to,center){
 let lo=0,hi=1;
 for(const [q,r] of [[2,1],[1,2],[1,-1]]){
  const start=q*(from.q-center.q)+r*(from.r-center.r),delta=q*(to.q-from.q)+r*(to.r-from.r);
  if(Math.abs(delta)<1e-12){if(Math.abs(start)>1+1e-9)return false;continue;}
  const a=(-1-start)/delta,b=(1-start)/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>hi+1e-9)return false;
 }
 return true;
}
function discover(c,ship,from,to=from){
 if(ship?.controlType!=='pc'||!from||!to||from.mapId!==to.mapId||![from.q,from.r,to.q,to.r].every(Number.isFinite))return [];
 const map=c.starmaps?.maps.find(m=>m.id===to.mapId),found=[];
 for(const star of map?.stars||[]){
  if(!star.hidden||!neighbors.some(([q,r])=>crossesHex(from,to,{q:star.q+q,r:star.r+r})))continue;
  star.hidden=false;found.push(star.id);
  require('./campaign-starmaps').note(c,`${ship.title} detected ${star.name} nearby. It is now visible on the Galaxy Map.`,ship);
 }
 return found;
}
module.exports={crossesHex,discover};
