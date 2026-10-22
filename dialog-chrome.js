// Only dismissal controls may be replaced by X. Labels/handlers can change between stages.
(function(){
 const controls=new WeakMap();
 const selector='dialog,[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]';
 const dismissal=/^(close|dismiss|cancel|exit|keep going|not now|ok|got it|understood|back|later|combat view|close (dialog|window|sheet|room|console)|exit console|back to (fleet|roster|prepare combat|sic card)|keep current character)$/i;
 function isDismissal(button){
  if(button.classList.contains('dialog-circle-close')||button.hasAttribute('data-dialog-action'))return false;
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
  let pair=controls.get(dialog);
  const buttons=[...dialog.querySelectorAll('button')].filter(b=>b.closest(selector)===dialog&&!b.classList.contains('dialog-circle-close'));
  const dismissals=buttons.filter(isDismissal),available=dismissals.filter(b=>!b.disabled&&!b.closest('[hidden]'));
  const candidates=available.length?available:dismissals;
  const close=candidates.find(b=>/^(close|dismiss|exit|combat view|back to)/i.test(b.textContent.trim()))||candidates[0];
  if(pair?.hiddenButton&&(pair.hiddenButton!==close||!isDismissal(pair.hiddenButton)))restore(pair);
  if(!pair&&!close&&dialog.tagName!=='DIALOG')return;
  if(!pair){
   const x=document.createElement('button');x.type='button';x.className='dialog-circle-close';x.textContent='\u00d7';x.setAttribute('aria-label','Close dialog');
   const bar=document.createElement('div');bar.className='dialog-close-rail';bar.append(x);
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
  if(pair.bar.parentElement!==dialog)dialog.prepend(pair.bar);
  pair.close=close;
  const disabled=dialog.hasAttribute('data-required-roll')||(close?close.disabled||!!close.closest('[hidden]'):dialog.tagName!=='DIALOG');
  if(pair.x.disabled!==disabled)pair.x.disabled=disabled;
  if(close&&!pair.hiddenButton){
   pair.hiddenButton=close;
   pair.originalAttributes={'aria-hidden':close.getAttribute('aria-hidden'),tabindex:close.getAttribute('tabindex')};
   close.classList.add('dialog-original-dismiss');close.setAttribute('aria-hidden','true');close.tabIndex=-1;
  }
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
 observer.observe(document.documentElement,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['hidden','open','disabled','type','aria-label','data-required-roll']});
 scan(document.documentElement);
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
