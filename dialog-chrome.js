// Only dismissal controls may be replaced by X. Labels/handlers can change between stages.
(function(){
 const controls=new WeakMap(),modalOrder=new WeakMap();let modalSequence=0;
 document.addEventListener?.('beforetoggle',event=>{if(event.target.tagName==='DIALOG'&&event.newState==='open')modalOrder.set(event.target,++modalSequence);},true);
 const selector='dialog,[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"],.combat-action-dialog[role="dialog"]';
 const dismissal=/^(close|dismiss|cancel|exit|keep going|not now|ok|got it|understood|back|later|combat view|close (dialog|window|sheet|room|console)|exit console|back to (fleet|roster|prepare combat|sic card)|keep current character)$/i;
 function isDismissal(button){
  if(button.classList.contains('dialog-circle-close')||button.hasAttribute('data-dialog-action')||button.hasAttribute('data-dialog-confirm'))return false;
  if(button.hasAttribute('data-dialog-dismiss'))return true;
  // A form submission is an action, including a button with no explicit type.
  if(button.type==='submit'&&button.form&&!(button.form.method==='dialog'&&button.value==='cancel'))return false;
  const text=button.textContent.trim();
  return dismissal.test(text)||(/^[\u00d7\u2715x]$/i.test(text)&&/^close\b/i.test(button.getAttribute('aria-label')||''));
 }
 function restore(pair){
  if(!pair?.hiddenButton)return;
  const button=pair.hiddenButton;
  button.classList.remove('dialog-original-dismiss');
  for(const [name,value]of Object.entries(pair.originalAttributes)){
   if(value===null)button.removeAttribute(name);else button.setAttribute(name,value);
  }
  pair.hiddenButton=null;
 }
 function enhance(dialog){
  const panelClasses=['combat-action-panel','combat-map-panel','delay-dialog-panel','queued-effect-panel','backup-conflict-dialog'];
  const surface=[...dialog.children].find(n=>panelClasses.some(name=>n.classList.contains(name)))||dialog;
  // These are full-screen animation/iframe hosts, not popup boxes. Their inner prompts own the frame.
  const presentation=dialog.matches('.automatic-dice-dialog,.combat-effect-stage,.cleanser-cinema,.oxygen-roll,[aria-label="Ship action dice roll"]');
  if(!presentation&&!dialog.closest('.quick-prompts,[data-popup-theme="none"]')){surface.classList.add('sci-fi-dialog-surface');if(typeof getComputedStyle==='function'&&getComputedStyle(surface).position==='static')surface.classList.add('sci-fi-frame-static');}
  let pair=controls.get(dialog);
  const buttons=[...dialog.querySelectorAll('button')].filter(b=>b.closest(selector)===dialog&&!b.classList.contains('dialog-circle-close'));
  const dismissals=buttons.filter(isDismissal),available=dismissals.filter(b=>!b.disabled&&!b.closest('[hidden]'));
  const candidates=available.length?available:dismissals;
  const close=candidates.find(b=>b.hasAttribute('data-dialog-dismiss'))||candidates.find(b=>/^(close|dismiss|exit|combat view|back to)/i.test(b.textContent.trim()))||candidates[0];
  if(pair?.hiddenButton&&(pair.hiddenButton!==close||!isDismissal(pair.hiddenButton)||pair.hiddenButton.hasAttribute('data-dialog-keep')))restore(pair);
  if(!pair&&!close&&dialog.tagName!=='DIALOG')return;
  if(!pair){
   const x=document.createElement('button');x.type='button';x.className='dialog-circle-close';x.textContent='\u00d7';x.setAttribute('aria-label','Close dialog');
   const bar=document.createElement('div');bar.className='dialog-close-rail';bar.append(x);
   // Top-layer chrome is not clipped by scrolling/filtered dialog contents.
   if(typeof bar.showPopover==='function')bar.setAttribute('popover','manual');
   pair={x,bar,close:null,hiddenButton:null};controls.set(dialog,pair);
   dialog.classList.add('has-close-chrome');
   x.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    // Recheck synchronously: a relabel/re-render may precede the observer callback.
    enhance(dialog);
    if(pair.close){if(!pair.x.disabled&&isDismissal(pair.close))pair.close.click();}
    else if(dialog.tagName==='DIALOG'&&!pair.x.disabled){
     const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();
    }
   };
  }
  // Backdrop wrappers are not the visible box. Anchor to each reviewed panel type.
  if(pair.bar.parentElement!==surface)surface.prepend(pair.bar);
  if(window.requestAnimationFrame){pair.dialog=dialog;pair.surface=surface;positioned.add(pair);schedulePosition();}
  pair.close=close;
  const disabled=dialog.hasAttribute('data-required-roll')||(close?close.disabled||!!close.closest('[hidden]'):dialog.tagName!=='DIALOG');
  if(pair.x.disabled!==disabled)pair.x.disabled=disabled;
  if(close&&!close.hasAttribute('data-dialog-keep')&&!pair.hiddenButton){
   pair.hiddenButton=close;
   pair.originalAttributes={'aria-hidden':close.getAttribute('aria-hidden'),tabindex:close.getAttribute('tabindex')};
   close.classList.add('dialog-original-dismiss');close.setAttribute('aria-hidden','true');close.tabIndex=-1;
  }
 }
 // Fixed chrome can straddle a scrolling dialog's border without being clipped by its content.
 const positioned=new Set();let positionFrame=0;
 function positionCloses(){
  positionFrame=0;
  // Keep the decorative frame/glass on the viewport of long, scrolling popups.
  for(const surface of document.querySelectorAll('.sci-fi-dialog-surface')){
   if(!surface.getClientRects().length)continue;
   for(const [axis,value]of [['x',surface.scrollLeft],['y',surface.scrollTop]]){
    const key='--frame-scroll-'+axis,next=value+'px';if(surface.style.getPropertyValue(key)!==next)surface.style.setProperty(key,next);
   }
  }
  const modalDialogs=[...document.querySelectorAll('dialog:modal')].sort((a,b)=>(modalOrder.get(a)||0)-(modalOrder.get(b)||0));
  const topModal=modalDialogs.at(-1);
  const active=[];
  for(const pair of positioned){
   const visible=pair.dialog.isConnected&&pair.surface.getClientRects().length&&!pair.dialog.closest('[hidden],.hidden')&&(pair.dialog.tagName!=='DIALOG'||pair.dialog.open);
   if(visible&&!pair.wasVisible)pair.openOrder=++modalSequence;
   pair.wasVisible=!!visible;
   if(visible&&(!topModal||pair.dialog===topModal||topModal.contains(pair.dialog))){
    let layer=0;for(let n=pair.surface;n;n=n.parentElement){const z=parseInt(getComputedStyle(n).zIndex,10);if(Number.isFinite(z))layer=Math.max(layer,z);}
    active.push({pair,layer});
   }
  }
  active.sort((a,b)=>a.layer-b.layer||a.pair.openOrder-b.pair.openOrder);
  const activePair=active.at(-1)?.pair;
  for(const pair of positioned){
   if(!pair.dialog.isConnected){positioned.delete(pair);continue;}
   const {bar,surface,dialog}=pair;
   if((activePair&&pair!==activePair)||!surface.getClientRects().length||dialog.closest('[hidden],.hidden')||(dialog.tagName==='DIALOG'&&!dialog.open)){bar.style.visibility='hidden';if(bar.hasAttribute('popover')&&bar.matches(':popover-open'))bar.hidePopover();continue;}
   // A nested confirmation owns dismissal until it is closed; do not float its parent's X above it.
   const childOpen=[...dialog.querySelectorAll(selector)].some(child=>child!==dialog&&child.getClientRects().length&&!child.closest('[hidden],.hidden')&&(child.tagName!=='DIALOG'||child.open));
   if(childOpen){bar.style.visibility='hidden';if(bar.hasAttribute('popover')&&bar.matches(':popover-open'))bar.hidePopover();continue;}
   if(bar.hasAttribute('popover')&&!bar.matches(':popover-open')){try{bar.showPopover();}catch{}}
   const r=surface.getBoundingClientRect(),v=window.visualViewport;
   let left=v?.offsetLeft||0,top=v?.offsetTop||0,right=left+(v?.width||window.innerWidth),bottom=top+(v?.height||window.innerHeight);
   // A scrolling backdrop may own a scrollbar that visualViewport does not subtract.
   for(let parent=bar.hasAttribute('popover')?null:surface.parentElement;parent;parent=parent.parentElement){
    const css=getComputedStyle(parent),p=parent.getBoundingClientRect();
    if(/auto|scroll|hidden|clip/.test(css.overflowX)&&parent.clientWidth){left=Math.max(left,p.left+parent.clientLeft);right=Math.min(right,p.left+parent.clientLeft+parent.clientWidth);}
    if(/auto|scroll|hidden|clip/.test(css.overflowY)&&parent.clientHeight){top=Math.max(top,p.top+parent.clientTop);bottom=Math.min(bottom,p.top+parent.clientTop+parent.clientHeight);}
   }
   const x=Math.max(left+3,Math.min(right-37,r.right-17)),y=Math.max(top+3,Math.min(bottom-37,r.top-17));
   // Account for a transformed ancestor (animated FUBS/cards/embedded panels).
   const current=bar.getBoundingClientRect(),scaleX=current.width/34||1,scaleY=current.height/34||1;
   const nextLeft=(parseFloat(bar.style.left)||0)+(x-current.left)/scaleX;
   const nextTop=(parseFloat(bar.style.top)||0)+(y-current.top)/scaleY;
   if(Math.abs(current.left-x)>.25)bar.style.left=nextLeft+'px';
   if(Math.abs(current.top-y)>.25)bar.style.top=nextTop+'px';
   bar.style.visibility='visible';
  }
 }
 function schedulePosition(){if(!positionFrame)positionFrame=window.requestAnimationFrame(positionCloses);}
 if(window.requestAnimationFrame){
  window.addEventListener('resize',schedulePosition);
  document.addEventListener('scroll',schedulePosition,true);
  window.visualViewport?.addEventListener('resize',schedulePosition);
  window.visualViewport?.addEventListener('scroll',schedulePosition);
  // Also follows dialog animations and content resized by live updates.
  window.setInterval(schedulePosition,150);
 }
 function scan(root){if(root.nodeType!==1)return;if(root.matches(selector))enhance(root);root.querySelectorAll(selector).forEach(enhance);}
 const observer=new MutationObserver(records=>{
  const dialogs=new Set();
  for(const r of records){
   const element=r.target.nodeType===1?r.target:r.target.parentElement;
   const dialog=element?.closest(selector);if(dialog)dialogs.add(dialog);
   if(r.type==='attributes')scan(element);
   if(r.type==='childList')for(const node of r.addedNodes)scan(node);
  }
  dialogs.forEach(enhance);
 });
 observer.observe(document.documentElement,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','open','disabled','type','aria-label','data-required-roll','data-dialog-action','data-dialog-confirm','data-dialog-dismiss','data-dialog-keep']});
 scan(document.documentElement);
 // A server-issued reset crosses same-origin embedded views synchronously.
 // Never invoke a submit button while tearing down an obsolete prompt.
 const resetSeen=new Set();
 function resetView(signal){
  if(!signal?.id||resetSeen.has(signal.id))return;resetSeen.add(signal.id);
  window.dispatchEvent(new CustomEvent('sa-combat-reset',{detail:signal}));
  for(const dialog of document.querySelectorAll(selector)){
   if(dialog.tagName==='DIALOG'){if(dialog.open)dialog.close();}
   else if(['combat-action-dialog','combat-map-dialog','turn-dialog','delay-dialog','queued-effect-dialog','backup-conflict-shell'].some(name=>dialog.classList.contains(name)))dialog.classList.add('hidden');
   else {const pair=controls.get(dialog);if(pair?.close&&!pair.close.disabled&&isDismissal(pair.close))pair.close.click();else dialog.hidden=true;}
  }
  for(const frame of document.querySelectorAll('iframe')){try{frame.contentWindow.SADialogReset?.apply(signal);}catch{}}
 }
 window.SADialogReset={apply:resetView,broadcast(signal){let root=window;try{while(root.parent!==root&&!root.frameElement?.hasAttribute('data-explore-perspective'))root=root.parent;}catch{}root.SADialogReset?.apply(signal);resetView(signal);}};

 document.addEventListener?.('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.ctrlKey||event.altKey||event.metaKey)return;
  const target=event.target,dialog=target.closest?.(selector);
  const visible=node=>!node.disabled&&!node.closest('[hidden]')&&node.getClientRects().length;
  if(event.key==='Enter'&&target.matches?.('input')&&!target.form&&dialog&&['text','number','password','email','search','url','tel'].includes(target.type)){
   const candidates=[...dialog.querySelectorAll('button')].filter(b=>visible(b)&&!isDismissal(b)&&!b.classList.contains('dialog-circle-close')&&(/^(confirm|save|create|rename|add|load|apply|send|submit|continue|join|ok)(\b|$)/i.test(b.textContent.trim())||b.hasAttribute('data-dialog-confirm')));
   if(candidates.length===1&&target.reportValidity()){event.preventDefault();candidates[0].click();}
  }
  if(event.key==='Escape'&&dialog&&dialog.tagName!=='DIALOG'){
   const x=controls.get(dialog)?.x;if(x&&!x.disabled){event.preventDefault();x.click();}
  }
  if(event.key==='Tab'&&dialog&&dialog.tagName!=='DIALOG'){
   const nodes=[...dialog.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')].filter(n=>visible(n)&&n.tabIndex>=0);
   const next=event.shiftKey?nodes.at(-1):nodes[0];
   if(next&&target===(event.shiftKey?nodes[0]:nodes.at(-1))){event.preventDefault();next.focus();}
  }
  if(!['Home','End','PageUp','PageDown'].includes(event.key)||target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  // Scroll the panel containing focus, leaving the browser's page scroll as fallback.
  let scroller=target;
  while(scroller&&scroller!==document.body){
   const css=getComputedStyle(scroller);
   if(/auto|scroll/.test(css.overflowY)&&scroller.scrollHeight>scroller.clientHeight+1){
    event.preventDefault();scroller.scrollTo({top:event.key==='Home'?0:event.key==='End'?scroller.scrollHeight:scroller.scrollTop+(event.key==='PageUp'?-1:1)*scroller.clientHeight*.9,behavior:'auto'});return;
   }
   scroller=scroller.parentElement;
  }
 });
})();
