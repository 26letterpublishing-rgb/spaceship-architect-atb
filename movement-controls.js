(function(){
 const confirmSelector='[data-arena-confirm],[data-inline-confirm-move],#confirmCombatMove,.ship-navigation-dialog button[type="submit"]';
 function arrange(){
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
