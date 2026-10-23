(function(){
  const queued=new Set(),observed=new Set(),sizes=new WeakMap();let pending=false;
  function fit(card){
    if(!card.isConnected||!card.getClientRects().length||!card.clientWidth)return;
    const key=card.clientWidth+':'+card.clientHeight+':'+card.textContent;if(sizes.get(card)===key)return;sizes.set(card,key);
    for(const [selector,max,min] of [['.sic-poker-heading h3',30,12],['.sic-poker-rules',22,10],['.sic-poker-stats',16,9],['footer',16,9]]){
      const box=card.querySelector(selector);if(!box)continue;
      const leaves=selector==='.sic-poker-stats'?[...box.querySelectorAll('dt,dd')]:selector==='.sic-poker-rules'?[...box.querySelectorAll('p')]:[box];
      const apply=n=>{leaves.forEach(e=>e.style.setProperty('font-size',n+'px','important'));if(selector==='.sic-poker-heading h3')box.nextElementSibling?.style.setProperty('font-size',(n+2)+'px','important');};
      const over=()=>selector==='.sic-poker-heading h3'&&box.clientHeight+(box.nextElementSibling?.offsetHeight||0)+20>box.closest('.sic-poker-heading').clientHeight||box.scrollHeight>box.clientHeight+1||box.scrollWidth>box.clientWidth+1||leaves.some(e=>e.scrollWidth>e.clientWidth+1);
      let lo=min,hi=max;apply(lo);while(hi-lo>.5){const mid=(hi+lo)/2;apply(mid);if(over())hi=mid;else lo=mid;}apply(Math.floor(lo*2)/2);
    }
  }
  function schedule(card){queued.add(card);if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;for(const c of queued)fit(c);queued.clear();});}
  const resize=new ResizeObserver(entries=>entries.forEach(e=>schedule(e.target)));
  const visible=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)schedule(e.target);}));
  function observe(root=document){for(const card of observed){if(!card.isConnected){resize.unobserve(card);visible.unobserve(card);observed.delete(card);queued.delete(card);}}for(const card of root.querySelectorAll('.sic-display-card')){if(!observed.has(card)){observed.add(card);resize.observe(card);visible.observe(card);}schedule(card);}}
  window.SACardFit={observe,fit};document.addEventListener('DOMContentLoaded',()=>observe());document.fonts?.ready.then(()=>observe());
})();
