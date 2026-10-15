// Shared purchasing card inspector. Installed-card management remains in the builder.
(function(){
 function open(source,o={}){
  const doc=o.document||document,d=doc.createElement('dialog');d.className='sic-card-dialog sic-inspection shared-card-inspector';d.setAttribute('aria-label',o.title||source.querySelector('h3')?.textContent||'Card details');
  d.innerHTML='<button data-close-sic-card aria-label="Back to cards">Back</button><div data-sic-card-dialog-body><aside class="sic-inspector-tools"></aside></div><p role="alert"></p>';
  const body=d.querySelector('[data-sic-card-dialog-body]'),tools=body.querySelector('aside'),card=window.SASicMarket.previewCard(source);body.append(card);
  function action(label,fn,disabled=false){const b=doc.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){d.querySelector('[role=alert]').textContent=e.message;}finally{b.disabled=disabled;}};tools.append(b);return b;}
  if(o.purchase)action('Purchase',async()=>{if(await o.purchase())d.close();},!!o.disabled).disabled=!!o.disabled;
  if(o.blueprint)action('Buy blueprint',o.blueprint,!!o.disabled).disabled=!!o.disabled;
  if(o.preview)action('Preview Console',()=>o.preview(d));
  let zoom=1;const set=n=>{zoom=Math.max(.5,Math.min(3,n));card.style.zoom=zoom;d.style.setProperty('--inspection-width',(350*zoom+220)+'px');};
  const fit=()=>set(Math.min(1,(doc.defaultView.innerHeight-100)/520,(doc.defaultView.innerWidth-240)/350));
  action('−',()=>set(zoom-.15)).setAttribute('aria-label','Zoom out card');action('Fit Card',fit);action('+',()=>set(zoom+.15)).setAttribute('aria-label','Zoom in card');
  body.onwheel=e=>{if(!e.target.closest('.sic-display-card'))return;e.preventDefault();set(zoom+(e.deltaY<0?.15:-.15));};d.querySelector('[data-close-sic-card]').onclick=()=>d.close();d.onclose=()=>{d.remove();o.trigger?.focus({preventScroll:true});};doc.body.append(d);d.showModal();fit();window.SACardFit.observe(d);return d;
 }
 async function previewConsole(type,doc=document){
  await Promise.all(['ship-navigation-ui.css','space-map.css','health-display.css','combat-workspace.css','combat-actions.css','console-common.css'].map(name=>{if([...doc.styleSheets].some(s=>s.href?.split('?')[0]===new URL(name,location.href).href))return;return new Promise((resolve,reject)=>{const l=doc.createElement('link');l.rel='stylesheet';l.href=name;l.onload=resolve;l.onerror=reject;doc.head.append(l);});}));
  const f=doc.createElement('iframe');f.title='Static console preview';f.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';f.src='index.html?catalogPreview='+encodeURIComponent(type);doc.body.append(f);const close=event=>{if(event.origin===location.origin&&event.source===f.contentWindow&&event.data?.type==='sa-close-console-preview'){f.remove();doc.defaultView.removeEventListener('message',close);}};doc.defaultView.addEventListener('message',close);
 }
 window.SACardInspector={open,previewConsole};
})();
