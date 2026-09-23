(function(){
  const selector='.combat-token,.player-ship-token,.ship-detail-crew,.player-ship-station.occupied,.combat-station-marker.occupied';
  const figure='<svg class="crew-figure" viewBox="0 0 32 32" aria-hidden="true" data-perspective="overhead"><ellipse class="crew-foot crew-left-foot" cx="12" cy="18" rx="3" ry="5"/><ellipse class="crew-foot crew-right-foot" cx="20" cy="18" rx="3" ry="5"/><ellipse class="crew-body" cx="16" cy="17" rx="10" ry="6"/><ellipse class="crew-arm crew-left-limb" cx="5" cy="17" rx="3" ry="4"/><ellipse class="crew-arm crew-right-limb" cx="27" cy="17" rx="3" ry="4"/><ellipse class="crew-head" cx="16" cy="14" rx="6" ry="6"/><path class="crew-heading-mark" d="M13 10Q16 8 19 10"/></svg>';
  const previous=new WeakMap();
  function decorate(root=document){
    for(const e of root.querySelectorAll(selector)){
      if(e.dataset.shipAi==='true'){if(!e.querySelector('.ai-station-icon')){e.replaceChildren();const image=document.createElement('img');image.className='ai-station-icon';image.src='ship-ai-station.png';image.alt='Ship AI bridge station';image.style.cssText='width:100%;height:100%;object-fit:cover;transform:scale(2.4)';e.style.overflow='hidden';e.append(image);}continue;}
      if(!e.querySelector('.crew-figure')){e.dataset.crewInitial=e.textContent.trim();e.innerHTML=figure;if(!e.classList.contains('crew-token'))e.classList.add('crew-token');if(e.title)e.setAttribute('aria-label',e.title);}
      if(!e.classList.contains('crew-token'))e.classList.add('crew-token');
      const moving=e.dataset.walking!=='false'&&e.matches('.combat-moving-token,.player-ship-moving-token,[data-walking=true]');
      if(e.classList.contains('crew-walking')!==moving)e.classList.toggle('crew-walking',moving);
      const pos={x:parseFloat(e.style.left),y:parseFloat(e.style.top)},old=previous.get(e);
      if(moving&&!e.dataset.walking&&old&&Number.isFinite(pos.x+pos.y+old.x+old.y)&&(pos.x!==old.x||pos.y!==old.y))e.style.setProperty('--crew-heading',`${Math.atan2(pos.y-old.y,pos.x-old.x)*180/Math.PI+90}deg`);
      previous.set(e,pos);
    }
  }
  function placeOxygen(){
    const grids=new Map();
    for(const label of document.querySelectorAll('.sa-room-oxygen')){
      if(!label.getClientRects().length)continue;
      const cell=label.parentElement,grid=cell.parentElement,cellBox=cell.getBoundingClientRect(),scale=cellBox.height/(cell.offsetHeight||cellBox.height||1),height=cell.offsetHeight*Number(label.dataset.roomHeight||1);
      const obstacles=grids.get(grid)||[...grid.querySelectorAll('.combat-map-label,.player-ship-label,.sic-room-label,.ship-grid-label,.sic-grid-label,.combat-station-marker,.player-ship-station,.ship-station-marker,.sic-station-marker')].filter(e=>e.getClientRects().length).map(e=>{
        if(e.matches('.combat-map-label,.player-ship-label,.sic-room-label,.ship-grid-label,.sic-grid-label')){const range=document.createRange();range.selectNodeContents(e);return range.getBoundingClientRect();}return e.getBoundingClientRect();
      });
      grids.set(grid,obstacles);
      const old=Number.parseFloat(label.style.getPropertyValue('--oxygen-lift'))||2,box=label.getBoundingClientRect();let lift=2;
      const intersects=n=>obstacles.some(b=>box.right>b.left-2&&box.left<b.right+2&&box.bottom+(old-n)*scale>b.top-2&&box.top+(old-n)*scale<b.bottom+2);
      const limit=Math.max(2,height-box.height/scale-2);while(lift<limit&&intersects(lift))lift=Math.min(limit,lift+3);
      if(old!==lift)label.style.setProperty('--oxygen-lift',lift+'px');
    }
  }
  let queued=false;const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;decorate();placeOxygen();});}});
  function start(){decorate();observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','data-walking']});}
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  window.addEventListener('resize',placeOxygen);
  window.SACrewTokens={figure,decorate,placeOxygen};
}());
