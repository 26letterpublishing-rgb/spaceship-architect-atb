// Authoritative room air. A percentage measures ideal atmosphere, not chemical O2 concentration.
const maps=require('./ship-map-core');
const DEPLETION=90/165,REFILL=1.5,THRESHOLD=10,EPS=1e-7;
const cache=new WeakMap();
function layout(ship){const s=ship.ship||ship,key=JSON.stringify([s.gridCells,s.placements,(s.sicInventory||[]).map(i=>[i.id,i.type,i.rotation,i.stationLayout])]);const old=cache.get(s);if(old?.key===key)return old.value;const value=maps.buildLayout(s);cache.set(s,{key,value});return value;}
function sync(ship){
  const s=ship.ship||ship,l=layout(ship),old=s.atmosphereState;
  const initial=old?100:s.oxygenState?Math.max(0,Math.min(100,10+(Number(s.oxygenState.graceRemaining)||0)*DEPLETION)):100;
  const cells={};for(const square of l.hull)if(!l.footprint.get(square)?.exterior){const value=old?.cells?.[square];cells[square]=Number.isFinite(value)?Math.max(0,Math.min(100,value)):initial;}
  s.atmosphereState={version:1,shipId:ship.id||old?.shipId,cells};return s.atmosphereState;
}
function groups(ship,actors=[]){
  const l=layout(ship),s=ship.ship||ship,data=sync(ship),seen=new Set(),result=[],doors=new Set();
  // A passage opens only while the actor crosses its actual doorway.
  for(const p of actors){const move=p.movement;if(p.shipId!==ship.id||move?.kind!=='move')continue;const route=move.routeSegment||[],index=Math.min(route.length-1,Math.floor((1-Math.max(0,move.remaining)/Math.max(.001,move.total))*route.length));const point=route[index];if(point?.doorKey)doors.add(point.doorKey);}
  for(const start of Object.keys(data.cells).map(Number)){
    if(seen.has(start))continue;const cells=[start];seen.add(start);
    for(let n=0;n<cells.length;n++)for(const side of l.sides){const square=cells[n],next=square+side.offset;if(!side.valid(square)||seen.has(next)||data.cells[next]===undefined)continue;const e=l.edge(square,next);if(e.kind==='wall'||e.kind==='door'&&s.doorStates?.[e.key]!=='open'&&!doors.has(e.key))continue;seen.add(next);cells.push(next);}
    const vent=cells.some(k=>{const c=l.footprint.get(k),d=c&&s.fieldState?.systems?.[c.sicId];return c?.type==='docking-bay'&&d?.doorOpen&&!d.shield;});
    const cockpit=cells.every(k=>{const c=l.footprint.get(k);return /^cockpit-/.test(c?.type||'')&&maps.operational(c.item)&&!c.item.impaired&&!c.item.impairmentPoints;});
    const supplied=maps.oxygenEnabled(ship)||cockpit;
    const oxygen=cells.reduce((n,k)=>n+data.cells[k],0)/cells.length;
    result.push({cells,oxygen,vent,supplied,rate:vent||!supplied?-DEPLETION:REFILL});
  }
  return result;
}
function advance(ship,seconds,actors=[]){const list=groups(ship,actors),data=(ship.ship||ship).atmosphereState;for(const g of list){const oxygen=Math.max(0,Math.min(100,g.oxygen+g.rate*Math.max(0,seconds)));for(const k of g.cells)data.cells[k]=oxygen;}return data;}
function at(ship,location){const s=ship.ship||ship;if(!s.atmosphereState)sync(ship);const value=s.atmosphereState.cells[location?.square];return Number.isFinite(value)?value:Math.min(100,...Object.values(s.atmosphereState.cells));}
function nextEvent(ship){const list=groups(ship);return Math.min(Infinity,...list.filter(g=>g.rate<0&&g.oxygen>THRESHOLD+EPS).map(g=>(g.oxygen-THRESHOLD)/-g.rate));}
function active(ship){const s=ship.ship||ship;return !maps.oxygenEnabled(ship)||Object.values(s.fieldState?.systems||{}).some(d=>d.doorOpen&&!d.shield)||Object.values(s.atmosphereState?.cells||{}).some(v=>v<100-EPS);}
module.exports={DEPLETION,REFILL,THRESHOLD,sync,groups,advance,at,nextEvent,active,layout};
