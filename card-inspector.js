// Shared purchasing card inspector. Installed-card management remains in the builder.
(function(){
 function open(source,o={}){
  const doc=o.document||document,d=doc.createElement('dialog');d.className='sic-card-dialog sic-inspection shared-card-inspector';d.setAttribute('aria-label',o.title||source.querySelector('h3')?.textContent||'Card details');
  d.innerHTML='<button data-close-sic-card aria-label="Back to cards">Back</button><div data-sic-card-dialog-body><aside class="sic-inspector-tools"></aside></div><p role="alert"></p>';
  const body=d.querySelector('[data-sic-card-dialog-body]'),tools=body.querySelector('aside'),card=window.SASicMarket.previewCard(source);const stage=doc.createElement('div');stage.className='inspection-card-stage sic-market-item';stage.append(card);body.append(stage);card.style.animation='none';card.style.transition='none';
  function action(label,fn,disabled=false){const b=doc.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){d.querySelector('[role=alert]').textContent=e.message;}finally{b.disabled=disabled;}};tools.append(b);return b;}
  if(o.purchase){const buy=action('Purchase',async()=>{if(await o.purchase())d.close();},!!o.disabled);buy.className='sic-purchase-button';stage.append(buy);}
  if(o.blueprint)action('Buy blueprint',o.blueprint,!!o.disabled).disabled=!!o.disabled;
  if(o.preview)action('Preview Console',()=>o.preview(d));
  let zoom=1,fitted=true;const set=n=>{fitted=false;zoom=Math.max(.5,Math.min(3,n));card.style.transform='scale('+zoom+')';card.style.transformOrigin='top left';stage.style.width=(350*zoom)+'px';stage.style.height=(490*zoom)+'px';};
  const fit=()=>{
   const win=doc.defaultView,css=win.getComputedStyle(d),layout=win.getComputedStyle(body),stacked=layout.flexDirection==='column';
   const px=value=>parseFloat(value)||0,gap=px(layout.gap),toolbar=tools.getBoundingClientRect();
   const frameWidth=d.offsetWidth-body.clientWidth,frameHeight=d.offsetHeight-body.clientHeight;
   const width=Math.min(win.innerWidth,px(css.maxWidth)||win.innerWidth)-frameWidth-(stacked?0:toolbar.width+gap);
   const height=Math.min(win.innerHeight,px(css.maxHeight)||win.innerHeight)-frameHeight-(stacked?toolbar.height+gap:0);
   set(Math.min(1,width/350,height/490));fitted=true;
  };
  const resize=()=>{if(fitted)fit();};
  action('−',()=>set(zoom-.15)).setAttribute('aria-label','Zoom out card');action('Fit Card',fit);action('+',()=>set(zoom+.15)).setAttribute('aria-label','Zoom in card');
  body.onwheel=e=>{if(!e.target.closest('.sic-display-card'))return;e.preventDefault();set(zoom+(e.deltaY<0?.15:-.15));};d.querySelector('[data-close-sic-card]').onclick=()=>d.close();d.onclose=()=>{doc.defaultView.removeEventListener('resize',resize);d.remove();o.trigger?.focus({preventScroll:true});};doc.body.append(d);d.showModal();fit();doc.defaultView.addEventListener('resize',resize);doc.defaultView.requestAnimationFrame(()=>{if(d.open&&fitted)fit();});window.SACardFit.observe(d);return d;
 }
 function hasConsole(type){const d=window.SAShipMap.definition(type);return !!(d&&(d.shipControl||d.shield||d.sensor||d.weapon||d.lockOn||d.utility||d.hacking));}
 function consoleButton(type,doc=document,onError=()=>{}){
  if(!hasConsole(type))return null;const b=doc.createElement('button');b.type='button';b.className='sic-console-preview';b.textContent='Preview Console';b.setAttribute('aria-label','Preview '+window.SAShipMap.definition(type).name+' Console');
  b.onclick=async()=>{b.disabled=true;try{await previewConsole(type,doc);}catch(e){onError(e.message);}finally{b.disabled=false;}};return b;
 }
 async function previewConsole(type,doc=document){
  await Promise.all(['ship-navigation-ui.css','space-map.css','health-display.css','combat-workspace.css','combat-actions.css','console-common.css'].map(name=>{if([...doc.styleSheets].some(s=>s.href?.split('?')[0]===new URL(name,location.href).href))return;return new Promise((resolve,reject)=>{const l=doc.createElement('link');l.rel='stylesheet';l.href=name;l.onload=resolve;l.onerror=reject;doc.head.append(l);});}));
  const f=doc.createElement('iframe');f.title='Static console preview';f.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';f.src='index.html?catalogPreview='+encodeURIComponent(type);doc.body.append(f);const close=event=>{if(event.origin===location.origin&&event.source===f.contentWindow&&event.data?.type==='sa-close-console-preview'){f.remove();doc.defaultView.removeEventListener('message',close);}};doc.defaultView.addEventListener('message',close);
 }
 window.SACardInspector={open,previewConsole,hasConsole,consoleButton};
})();
