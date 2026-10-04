// Explore keeps independent pages alive. Only the visible page renders combat.
(() => {
  let root=window;
  try { while(root.frameElement&&!root.frameElement.hasAttribute('data-explore-perspective'))root=root.parent; } catch {}
  if(!root.frameElement?.hasAttribute('data-explore-perspective'))return;
  let active=!root.frameElement.hidden;
  const apply=value=>{
    active=Boolean(value);document.documentElement.dataset.exploreActive=String(active);
    window.dispatchEvent(new CustomEvent('sa-perspective-visibility',{detail:{active}}));
    for(const frame of document.querySelectorAll('iframe'))frame.contentWindow?.postMessage({type:'sa-explore-visibility',active},location.origin);
  };
  window.SAExploreSession={active:()=>active};
  window.addEventListener('message',event=>{
    if(event.origin===location.origin&&event.source===parent&&event.data?.type==='sa-explore-visibility')apply(event.data.active);
  });
  document.addEventListener('load',event=>{if(event.target.tagName==='IFRAME')event.target.contentWindow?.postMessage({type:'sa-explore-visibility',active},location.origin);},true);
  apply(active);
})();
