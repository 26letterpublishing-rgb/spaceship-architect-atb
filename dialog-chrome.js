// Retain existing close/cancel handlers; never reinterpret a confirm action as dismissal.
(function(){
 const controls=new WeakMap();
 const selector='dialog,[role="dialog"][aria-modal="true"]';
 function enhance(dialog){
  if(dialog.dataset.closeChrome){const pair=controls.get(dialog);if(pair){const disabled=pair.close.disabled||pair.close.hidden;if(pair.x.disabled!==disabled)pair.x.disabled=disabled;}return;}
  const buttons=[...dialog.querySelectorAll('button')].filter(b=>b.closest(selector)===dialog);
  const close=buttons.find(b=>/^(close|dismiss|cancel)(\b|$)/i.test((b.textContent||'').trim())||/^(close|dismiss)/i.test(b.getAttribute('aria-label')||'')||/(close|cancel|dismiss)/i.test(b.id)||b.matches('[data-close],[data-dismiss],[data-cancel]'))
    ||buttons.find(b=>/^(exit|keep going|not now|ok|got it|understood)$/i.test((b.textContent||'').trim()));
  if(!close&&dialog.tagName!=='DIALOG')return;
  dialog.dataset.closeChrome='true';dialog.classList.add('has-close-chrome');
  const x=document.createElement('button');x.type='button';x.className='dialog-circle-close';x.textContent='\u00d7';x.setAttribute('aria-label','Close dialog');
  x.onclick=e=>{e.preventDefault();e.stopPropagation();if(close){if(!close.disabled&&!close.hidden)close.click();}else{const event=new Event('cancel',{cancelable:true});if(dialog.dispatchEvent(event))dialog.close();}};
  if(close){controls.set(dialog,{close,x});x.disabled=close.disabled||close.hidden;}
  const bar=document.createElement('div');bar.className='dialog-close-rail';bar.append(x);dialog.prepend(bar);
  if(close&&(/^(dismiss|close|exit|ok|got it|understood)$/i.test(close.textContent.trim())||close.classList.contains('dialog-close'))){close.classList.add('dialog-original-dismiss');close.setAttribute('aria-hidden','true');close.tabIndex=-1;}
 }
 function scan(root){if(root.nodeType!==1)return;if(root.matches(selector))enhance(root);root.querySelectorAll(selector).forEach(enhance);}
 const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'){scan(r.target);const dialog=r.target.closest(selector);if(dialog)enhance(dialog);}else for(const node of r.addedNodes)scan(node);}});
 observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open','disabled']});scan(document.documentElement);
})();
