(function(){
  const selector='.combat-token,.player-ship-token,.ship-detail-crew,.player-ship-station.occupied,.combat-station-marker.occupied';
  const figure=window.SATokenArt?.figure('human',0)||''; // Existing default appearance, never the retired generic person.
  const previous=new WeakMap();
  function decorate(root=document){
    for(const e of root.querySelectorAll(selector)){
      if(e.dataset.securityDroid==='true'){e.querySelector('.crew-figure')?.remove();continue;}
      if(e.dataset.shipAi==='true'){if(!e.querySelector('.ai-station-icon')){e.replaceChildren();const image=document.createElement('img');image.className='ai-station-icon';image.src='ship-ai-station.png';image.alt='Ship AI bridge station';image.style.cssText='width:100%;height:100%;object-fit:cover;transform:scale(2.4)';e.style.overflow='hidden';e.append(image);}continue;}
      const art=window.SATokenArt,race=art?.atlas(e.dataset.tokenRace)?e.dataset.tokenRace:'human',choice=race===e.dataset.tokenRace?(art?.variant(e.dataset.tokenVariant)??0):0,key=art?.atlas(race)?race+':'+choice:'';
      if(e.dataset.renderedToken!==key){e.querySelector('.crew-figure')?.remove();e.dataset.renderedToken=key;}
      const isFallen=e.dataset.fallen==='true';if(e.querySelector('.crew-figure')&&e.classList.contains('crew-is-fallen')!==isFallen)e.querySelector('.crew-figure').remove();if(e.classList.contains('crew-is-fallen')!==isFallen)e.classList.toggle('crew-is-fallen',isFallen);
      if(!e.querySelector('.crew-figure')){e.dataset.crewInitial=e.textContent.trim();e.innerHTML=key?art.figure(race,choice):figure;if(!e.classList.contains('crew-token'))e.classList.add('crew-token');if(e.title)e.setAttribute('aria-label',e.title);}
      if(!e.classList.contains('crew-token'))e.classList.add('crew-token');
      const moving=!isFallen&&e.dataset.walking!=='false'&&e.matches('.combat-moving-token,.player-ship-moving-token,[data-walking=true]');
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
  let queued=false,oxygenDirty=false;const observer=new MutationObserver(records=>{
    const relevant=records.some(r=>r.type==='attributes'?r.target.matches?.(selector):Boolean(r.target.closest?.(selector)&&!r.target.closest(selector).querySelector('.crew-figure,.ai-station-icon'))||[...r.addedNodes,...r.removedNodes].some(n=>{if(n.nodeType!==1)return false;const oxygen=n.matches('.sa-room-oxygen')||n.querySelector('.sa-room-oxygen');if(oxygen)oxygenDirty=true;return oxygen||n.matches(selector)||n.querySelector(selector); }));
    if(relevant&&!queued){queued=true;requestAnimationFrame(()=>{queued=false;decorate();if(oxygenDirty){oxygenDirty=false;placeOxygen();}});}
  });
  function start(){decorate();placeOxygen();observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','data-walking','data-fallen','data-token-race','data-token-variant']});}
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  window.addEventListener('resize',placeOxygen);
  window.SACrewTokens={figure,decorate,placeOxygen};
}());
