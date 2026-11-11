(function(){
 const confirmSelector='[data-arena-confirm],[data-arena-bottom-confirm],[data-bottom-confirm-move],[data-destination-confirm],[data-inline-confirm-move],#confirmCombatMove,.ship-navigation-dialog button[type="submit"]';

 const destinations=new Map();
 function dropDestination(button){const v=destinations.get(button);if(!v)return;v.observer?.disconnect();v.resize?.disconnect();v.viewport.removeEventListener('scroll',schedule);v.circle.remove();destinations.delete(button);}
 function positionDestinations(){for(const [button,v] of destinations){
   if(!button.isConnected||!v.viewport.isConnected){dropDestination(button);continue;}
   const c=v.circle;if(c.disabled!==button.disabled)c.disabled=button.disabled;if(c.textContent!==button.textContent)c.textContent=button.textContent;c.setAttribute('aria-label',button.textContent.trim());
   c.hidden=!v.target?.isConnected||!v.viewport.getClientRects().length;if(c.hidden)continue;
   const b=v.viewport.getBoundingClientRect(),r=v.target.getBoundingClientRect(),scale=b.width/(v.viewport.offsetWidth||b.width)||1,size=56*scale,gap=8*scale;
   const row=v.viewport.querySelector?.('.embedded-move-bottom')?.getBoundingClientRect();
   const limit=row&&row.top>b.top&&row.top<b.bottom?row.top:b.bottom;
   const right=b.right-gap-size,bottom=limit-gap-size;
   const x=Math.max(b.left+gap,Math.min(right,r.right+gap<=right?r.right+gap:r.left-size-gap));
   const y=Math.max(b.top+gap,Math.min(bottom,r.top+r.height/2-size/2));
   c.style.left=((x-b.left)/scale+v.viewport.scrollLeft)+'px';c.style.top=((y-b.top)/scale+v.viewport.scrollTop)+'px';
 }}
 window.SAMovementConfirm={sync(button,{viewport,target,movingElement,active}){
   if(!button)return;if(!active||!viewport){dropDestination(button);return;}
   let v=destinations.get(button);if(v&&v.viewport!==viewport){dropDestination(button);v=null;}
   if(!v){const circle=viewport.ownerDocument.createElement('button');circle.type='button';circle.className='interior-move-confirm';circle.dataset.destinationConfirm='';circle.dataset.uiSound='none';
     circle.addEventListener('click',e=>{e.stopPropagation();if(!button.disabled)button.click();});viewport.classList.add('move-confirm-viewport');viewport.append(circle);
     v={circle,viewport,target};destinations.set(button,v);viewport.addEventListener('scroll',schedule,{passive:true});
     if(typeof ResizeObserver!=='undefined'){v.resize=new ResizeObserver(schedule);v.resize.observe(viewport);}
     if(movingElement){v.observer=new MutationObserver(schedule);v.observer.observe(movingElement,{attributes:true,attributeFilter:['style','data-display-rotation']});}
   }v.target=target;positionDestinations();
 },refresh:schedule};
 window.addEventListener('resize',schedule);window.addEventListener('pagehide',()=>{for(const b of [...destinations.keys()])dropDestination(b);});
 function arrange(){
  positionDestinations();
  for(const first of document.querySelectorAll('[data-route-mode="direct"],[data-crew-route="direct"]')){
   if(first.parentElement.classList.contains('move-route-pill'))continue;
   const parent=first.parentElement,second=parent.querySelector('[data-route-mode="custom"],[data-crew-route="custom"]');if(!second)continue;
   const pill=document.createElement('span');pill.className='move-route-pill';pill.setAttribute('role','group');pill.setAttribute('aria-label','Route type');first.before(pill);pill.append(first,second);
   const scope=parent.closest('.arena-live-footer,.inline-map-actions,.combat-map-panel,.ship-navigation-dialog')||parent;
   const minor=[...scope.querySelectorAll('[data-route-undo],[data-route-clear],[data-crew-undo],[data-crew-clear],[data-arena-cancel],[data-inline-cancel-move],#cancelCombatMove,[data-cancel-move]')];
   if(minor.length){const row=document.createElement('span');row.className='move-secondary';parent.append(row);row.append(...minor);}
  }
  for(const host of document.querySelectorAll('.arena-live,[data-inline-ship-map]')){
   const toolbar=host.querySelector(host.matches('[data-inline-ship-map]')?'.inline-map-footer':'.arena-toolbar:not(.arena-live-footer)');if(!toolbar)continue;
   const buttons=[...host.querySelectorAll('[data-arena-zoom],[data-arena-fit],[data-arena-focus],[data-preview-zoom],[data-interior-fit],[data-interior-focus],[data-expand-interior]')];
   if(!buttons.length)continue;
   let box=toolbar.querySelector('.move-map-navigation');if(!box){box=document.createElement('nav');box.className='move-map-navigation';box.setAttribute('aria-label','Map view');toolbar.append(box);}
   for(const button of buttons)if(button.parentElement!==box)box.append(button);
  }
  for(const chart of document.querySelectorAll('.ship-navigation-dialog .pilot-chart')){
   let box=chart.querySelector('.move-map-navigation');if(!box){box=document.createElement('nav');box.className='move-map-navigation';chart.querySelector('.pilot-chart-title').append(box);}
   for(const button of chart.querySelectorAll('[data-zoom],[data-auto-zoom],[data-enlarge-navigation]'))if(button.parentElement!==box)box.append(button);
  }
  for(const button of document.querySelectorAll(confirmSelector))button.classList.toggle('next-action-glow',!button.disabled);
 }
 let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;arrange();});}
 new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='disabled'))schedule();}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 schedule();
})();
