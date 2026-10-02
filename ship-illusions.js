// Server-owned projections: never physical scenery, targets or gravity bodies.
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power'),hex=require('./ship-distances');
const {randomUUID}=require('node:crypto');
const APPEARANCES=['Starship (Small)','Starship (Huge)','Galactic Monster','Asteroid (Small)','Asteroid (Huge)','Planet'];
const state=ship=>ship.ship.illusionState||={projectors:{},receipts:[]};
function entries(room){return (room.starships||[]).flatMap(ship=>Object.entries(ship.ship.illusionState?.projectors||{}).flatMap(([sicId,p])=>{const item=maps.installedItems(ship).find(i=>i.id===sicId);return p.active&&item&&stations.online(item)&&item.status!=='destroyed'&&!ship.destroyedAt&&power.output(ship,room.units).en>=power.demand(ship)?[{ship,item,p}]:[];}));}
function command(room,unit,body,{outsideCombat=false}={}){
 const a=stations.access(room,unit,body.sicId);if(!a?.definition.illusion||a.blocked)return {ok:false,error:'Use an available Sensor Lure console.'};
 const s=state(a.ship);if(s.receipts.includes(body.receipt))return {ok:true,duplicate:true,ship:a.ship};
 if(!outsideCombat&&(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.consoleHold))return {ok:false,error:'Wait for your turn.'};
 if(typeof body.receipt!=='string'||body.receipt.length<8)return {ok:false,error:'Missing command receipt.'};
 if(body.kind==='dismiss'){if(s.projectors[a.id])s.projectors[a.id].active=false;}
 else if(body.kind==='project'){
  if(!APPEARANCES.includes(body.appearance))return {ok:false,error:'Choose a projection appearance.'};
  const origin=require('./ship-targets').point(room,a.ship.id)||{q:0,r:0};
  s.projectors[a.id]={id:randomUUID(),active:true,appearance:body.appearance,variant:['ocean','desert','ice','volcanic'][require('node:crypto').randomInt(4)],origin:{q:origin.q+1,r:origin.r},position:{q:origin.q+1,r:origin.r},destination:null,scans:{},revealed:{},elapsed:0};
 }else return {ok:false,error:'Choose Project or Dismiss.'};
 s.receipts=[...s.receipts,body.receipt].slice(-64);return {ok:true,ship:a.ship,text:body.kind==='dismiss'?'Projection dismissed.':'Projection activated.'};
}
function reveal(room,observer,p){if(p.revealed[observer.id])return; p.revealed[observer.id]=true;require('./ship-sensors').report(observer,{text:`The ${p.appearance} is an illusion!`,objectRefs:[{id:p.id,label:p.appearance}]});}
function advance(room,seconds,random=Math.random){
 for(const {item,p}of entries(room)){
  if(!/Asteroid|Planet/.test(p.appearance)&&seconds>0){
   let left=seconds;
   // One hex per 12 active seconds; every destination stays within two hexes of the anchor.
   while(left>0){if(!p.destination){const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]],from=hex.roundHex(p.position),choices=dirs.map(([q,r])=>({q:from.q+q,r:from.r+r})).filter(to=>hex.hexDistance(to,p.origin)<=2);p.from={...p.position};p.destination=choices[Math.floor(random()*choices.length)]||{...p.origin};p.elapsed=0;}
    const step=Math.min(left,12-p.elapsed);p.elapsed+=step;left-=step;const t=p.elapsed/12;p.position={q:p.from.q+(p.destination.q-p.from.q)*t,r:p.from.r+(p.destination.r-p.from.r)*t};if(t>=1)p.destination=null;
   }
  }
  for(const observer of room.starships||[]){const at=require('./ship-targets').point(room,observer.id);if(at&&hex.hexDistance(hex.roundHex(at),hex.roundHex(p.position))===0)reveal(room,observer,p);if(item.impaired||item.impairmentPoints||item.status==='impaired')p.revealed[observer.id]=true;}
 }
}
function scanned(room,order){const observer=room.starships.find(s=>s.id===order?.shipId);if(!observer||!['area','hex','analysis'].includes(order?.kind))return [];const at=require('./ship-targets').point(room,observer.id);return entries(room).filter(({p})=>order.kind==='analysis'?order.targetId===p.id:order.hex?hex.hexDistance(order.hex,p.position)<=1:hex.hexDistance(at,p.position)<=maps.sensorStats(observer).range*1.5);}
function resolveScan(room,observer,order){for(const {p}of scanned(room,order)){p.scans[observer.id]=(p.scans[observer.id]||0)+1;if(p.scans[observer.id]>=5)reveal(room,observer,p);else require('./ship-sensors').report(observer,{text:`Scan of ${p.appearance}: check unsuccessful.`,objectRefs:[{id:p.id,label:p.appearance}]});}}
function objects(room,observers,{gm=false}={}){return entries(room).filter(({p})=>gm||observers.some(s=>hex.hexDistance(require('./ship-targets').point(room,s.id),p.position)<=maps.sensorStats(s).range)).map(({ship,item,p})=>{const known=gm||observers.some(s=>s.id===ship.id||p.revealed[s.id])||item.impaired||item.impairmentPoints;return {id:p.id,kind:'projection',name:(known?'Illusionary ':'')+p.appearance,appearance:p.appearance,variant:p.variant,...p.position,quantity:1,revealed:Boolean(known)};});}
function project(data,original,viewer){
 const operator=original.units.find(u=>u.characterId===viewer.characterId),access=operator?stations.consoles(original,operator):[];
 const observers=viewer.gm?[]:original.starships.filter(s=>viewer.spectator?s.controlType==='pc':original.units.some(u=>u.characterId===viewer.characterId&&(u.location?.starshipId===s.id||u.vacuum?.sourceShipId===s.id)));
 data.spaceObjects=[...(data.spaceObjects||[]),...objects(original,observers,{gm:viewer.gm})];
 for(const ship of data.starships||[]){
  const full=original.starships.find(s=>s.id===ship.id),owned=viewer.gm||observers.some(s=>s.id===ship.id);
  if(!owned){
   delete ship.ship?.illusionState;delete ship.ship?.securityDroidState;
   for(const a of access.filter(a=>a.ship.id===ship.id&&a.controlled)){
    if(a.definition.securityDroid&&full.ship.securityDroidState?.droids?.[a.id]){ship.ship.securityDroidState||={droids:{}};ship.ship.securityDroidState.droids[a.id]=structuredClone(full.ship.securityDroidState.droids[a.id]);}
    if(a.definition.illusion&&full.ship.illusionState?.projectors?.[a.id]){ship.ship.illusionState||={projectors:{}};ship.ship.illusionState.projectors[a.id]=structuredClone(full.ship.illusionState.projectors[a.id]);}
   }
  }
  if(ship.ship?.securityDroidState){ship.ship.securityDroidState.crewRoster=[...(full.crewCharacterIds||[]),...(full.crewNpcUnitIds||[])].map(id=>({id,name:original.units.find(u=>u.characterId===id||u.id===id)?.characterName||'Registered crew '+id}));}
 }
 return data;
}
module.exports={APPEARANCES,state,entries,command,advance,scanned,resolveScan,objects,project};
