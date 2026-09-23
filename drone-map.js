(function(){

 function update(grids,ship,drones){
  const active=(drones||[]).filter(d=>['repairing','returning'].includes(d.phase));
  for(const grid of grids){
   let layer=grid.querySelector('.drone-map-layer');if(!layer){layer=document.createElement('div');layer.className='drone-map-layer';layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:15;overflow:visible';grid.append(layer);}
   const valid=new Set(active.map(d=>d.id));for(const img of layer.children)if(!valid.has(img.dataset.droneId))img.remove();
   const origin=grid.getBoundingClientRect(),cells=(ship.gridCells||[]).map(n=>grid.querySelector(`[data-grid-index="${n}"],[data-inline-square="${n}"],[data-combat-square="${n}"]`)).filter(Boolean).map(c=>c.getBoundingClientRect());if(!cells.length||!origin.width)continue;
   const scale=origin.width/grid.offsetWidth||1,local=r=>({left:(r.left-origin.left)/scale,right:(r.right-origin.left)/scale,top:(r.top-origin.top)/scale,bottom:(r.bottom-origin.top)/scale,width:r.width/scale,height:r.height/scale}),bounds=cells.map(local);
   const left=Math.min(...bounds.map(r=>r.left))-10,right=Math.max(...bounds.map(r=>r.right))+10,top=Math.min(...bounds.map(r=>r.top))-10,bottom=Math.max(...bounds.map(r=>r.bottom))+10;
   const points=[[left,top],[right,top],[right,bottom],[left,bottom]],fraction=d=>((d.progress||0)/100)%1;
   for(const d of active){
    let img=[...layer.children].find(i=>i.dataset.droneId===d.id);if(!img){img=document.createElement('img');img.src=d.sprite||'repair-drone-1-sprite.webp';img.alt='Repair Drone repairing the outer hull';img.dataset.droneId=d.id;img.style.cssText='position:absolute;width:30px;height:30px;object-fit:contain;pointer-events:none;filter:drop-shadow(0 0 3px #7fffe0);transform:translate(-50%,-50%);transition:left .22s linear,top .22s linear';layer.append(img);}
    const place=(ship.placements||[]).find(p=>p.sicId===d.sicId),bayRect=place&&grid.querySelector(`[data-grid-index="${place.cell}"],[data-inline-square="${place.cell}"],[data-combat-square="${place.cell}"]`)?.getBoundingClientRect(),bay=bayRect&&local(bayRect);
    let t=fraction(d)*4,n=Math.floor(t),a=points[n],b=points[(n+1)%4],x=a[0]+(b[0]-a[0])*(t-n),y=a[1]+(b[1]-a[1])*(t-n);
    if(d.phase==='returning'){const f=Math.min(1,d.progress/1.5);x=left+((bay?bay.left+bay.width/2:left)-left)*f;y=top+((bay?bay.top+bay.height/2:top)-top)*f;img.style.opacity=String(1-f*.8);}else img.style.opacity='1';
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){x=bay?bay.left+bay.width/2:left;y=bay?bay.top+bay.height/2:top;img.style.transition='none';}
    img.style.left=x+'px';img.style.top=y+'px';
   }
  }
 }
 window.SADroneMap={update};
}());
