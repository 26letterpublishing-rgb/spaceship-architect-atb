(function(){
 // This separate lightweight layer interpolates robot movement without rebuilding the ship floorplan.
 const samples=new Map();let state=null,frame,lastDraw=0,hadBots=false;
 const point=(p,c)=>({x:p.square%c+(p.mesh%3+.5)/3,y:Math.floor(p.square/c)+(Math.floor(p.mesh/3)+.5)/3});
 window.addEventListener('sa-combat-state',e=>{state=e.detail.state;});
 function draw(){
  if(performance.now()-lastDraw<32){frame=requestAnimationFrame(draw);return;}lastDraw=performance.now();
  const live=window.SACombatBridge?.state()||state;
  const hasBots=live?.starships?.some(s=>Object.values(s.ship?.breachDroneState?.drones||{}).some(d=>d.phase!=='docked'));
  if(live&&!document.hidden&&(hasBots||hadBots)){
   const docs=[{doc:document}];try{if(parent!==window)docs.push({doc:parent.document});}catch{}
   for(const {doc} of [...docs])for(const f of doc.querySelectorAll('iframe[data-player-ship-details],#gmStarshipViewerFrame'))try{if(f.contentDocument)docs.push({doc:f.contentDocument,id:f.dataset.playerShipDetails||new URL(f.src).searchParams.get('ship')});}catch{}
   for(const {doc,id:fallbackId} of docs)for(const grid of doc.querySelectorAll('.inline-combat-map-grid,#combatMapGrid,.ship-grid')){
    const id=grid.closest('[data-inline-ship-map]')?.dataset.inlineShipMap||doc.querySelector('#combatMapShip')?.value||fallbackId,ship=live.starships?.find(s=>s.id===id);if(!ship){for(const n of grid.querySelectorAll('[data-breach-bot]'))n.remove();continue;}
    const c=window.SAShipMap.gridColumns(ship),first=grid.querySelector('[data-inline-square]');
    const origin=first?{x:Number(first.dataset.inlineSquare)%c,y:Math.floor(Number(first.dataset.inlineSquare)/c)}:{x:0,y:0};
    const columns=Number(grid.style.getPropertyValue('--inline-cols'))||c,rows=Number(grid.style.getPropertyValue('--inline-rows'))||window.SAShipMap.gridRows(ship);
    const ids=new Set();
    for(const d of Object.values(ship.ship.breachDroneState?.drones||{})){
     if(d.phase==='docked')continue;ids.add(d.id);let token=[...grid.querySelectorAll('[data-breach-bot]')].find(n=>n.dataset.breachBot===d.id);
     if(!token){token=doc.createElement('img');token.dataset.breachBot=d.id;token.src='hull-breach-drone-token.webp';token.alt='Hull Breach Repair Drone';token.style.cssText='position:absolute;z-index:35;pointer-events:none;object-fit:contain;transform:translate(-50%,-50%);filter:drop-shadow(0 0 3px #4eeaff)';grid.append(token);}
     const sig=JSON.stringify([d.location,d.segment]),old=samples.get(d.id);if(old?.sig!==sig)samples.set(d.id,{sig,at:performance.now()});
     let p=point(d.location,c);if(d.segment){const s=d.segment,a=point(s.from,c),b=point(s.to,c),extra=live.running&&!live.hardPaused&&!live.holdPaused&&!live.pausedForTurn&&!live.rollPaused?Math.min(.3,(performance.now()-samples.get(d.id).at)/1000):0,t=Math.min(1,Math.max(0,(s.elapsed+extra-(s.doorKey?.6:0))/(s.duration-(s.doorKey?.6:0))));p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
     token.style.left=(p.x-origin.x)/columns*100+'%';token.style.top=(p.y-origin.y)/rows*100+'%';token.style.width=65/columns+'%';token.style.height=65/rows+'%';token.title=d.phase==='repairing'?`Repairing: D${d.die} in ${Math.ceil(d.remaining)}s`:'Hull Breach Repair Drone: '+d.phase;
    }
    for(const token of grid.querySelectorAll('[data-breach-bot]'))if(!ids.has(token.dataset.breachBot))token.remove();
   }
  }
  hadBots=hasBots;frame=requestAnimationFrame(draw);
 }
 frame=requestAnimationFrame(draw);window.addEventListener('pagehide',()=>cancelAnimationFrame(frame),{once:true});
})();
