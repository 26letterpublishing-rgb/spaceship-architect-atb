// Only dismissal controls may be replaced by X. Labels/handlers can change between stages.
(function(){
 const controls=new WeakMap();
 const selector='dialog,[role="dialog"][aria-modal="true"]';
 const dismissal=/^(close|dismiss|cancel|exit|keep going|not now|ok|got it|understood|back|later|combat view|close (dialog|window|sheet|room|console)|back to (fleet|roster|prepare combat)|keep current character)$/i;
 function isDismissal(button){
  if(button.classList.contains('dialog-circle-close')||button.hasAttribute('data-dialog-action'))return false;
  // A form submission is an action, including a button with no explicit type.
  if(button.type==='submit'&&button.form&&!(button.form.method==='dialog'&&button.value==='cancel'))return false;
  const text=button.textContent.trim();
  return dismissal.test(text)||(/^[Ã—âœ•x]$/i.test(text)&&/^close\b/i.test(button.getAttribute('aria-label')||''));
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
  const close=buttons.find(isDismissal);
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
  if(close&&!pair.hiddenButton&&(/^(dismiss|close|exit|ok|got it|understood)$/i.test(close.textContent.trim())||close.classList.contains('dialog-close'))){
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
})();
