(function(){
  const seen=new Set();let tray=null,noticeNode=null,noticeTimer=null,combatActive=false;
  // The campaign shell owns the answer for its embedded consoles. A paused
  // encounter remains combat; a console preview or preparation screen does not.
  function isCombatActive(){const win=host().defaultView;return win===window?combatActive:Boolean(win.SAInterfaceNotices?.isCombatActive());}
  function setCombatActive(active){const next=Boolean(active);if(next===combatActive)return;combatActive=next;if(!next){critical.queue?.splice(0);critical.close?.();for(const card of tray?.children||[])if(card.dataset.allowOutsideCombat!=='true'){card.remove();}if(noticeNode?.dataset.allowOutsideCombat!=='true'&&noticeNode)noticeNode.hidden=true;}host().defaultView.SAInterfaceNoticeHost?.refresh();}
  function host(){let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}if(!doc.querySelector('link[data-result-feedback],link[href*="result-feedback.css"]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('result-feedback.css',location.href).href;link.dataset.resultFeedback='';doc.head.append(link);}return doc;}
  function noticeHost(){
    const doc=host(),win=doc.defaultView;
    if(win.SAInterfaceNoticeHost)return win.SAInterfaceNoticeHost;
    const rail=doc.createElement('aside');rail.className='interface-notice-rail';rail.setAttribute('aria-label','Notifications');rail.setAttribute('popover','manual');doc.body.append(rail);
    let queued=false;
    function refresh(){
      const active=[...rail.children].some(n=>!n.hidden&&(!n.classList.contains('result-notifications')||n.children.length));
      if(win.SAExploreSession?.active?.()===false)return;
      if(active&&!rail.matches(':popover-open'))rail.showPopover();else if(!active&&rail.matches(':popover-open'))rail.hidePopover();
    }
    function schedule(){if(queued)return;queued=true;win.requestAnimationFrame(()=>{queued=false;refresh();});}
    // A popover stays above dialogs without moving the page or resizing consoles.
    const observer=new win.MutationObserver(records=>{if(records.some(r=>r.target.tagName==='DIALOG')){if(rail.matches(':popover-open'))rail.hidePopover();schedule();}});
    observer.observe(doc.documentElement,{subtree:true,attributes:true,attributeFilter:['open']});
    win.addEventListener('sa-perspective-visibility',()=>{schedule();if(!critical.active)critical.resume?.();});
    doc.addEventListener('visibilitychange',schedule);
    const api={mount(node,key=''){if(key){const old=[...rail.children].find(n=>n.dataset.noticeKey===key);if(old&&old!==node)old.remove();node.dataset.noticeKey=key;}if(node.parentElement!==rail)rail.append(node);schedule();return node;},refresh,schedule,remove(node){node?.remove();refresh();}};
    win.addEventListener('pagehide',()=>observer.disconnect(),{once:true});win.SAInterfaceNoticeHost=api;return api;
  }
  function critical(key,message,type='danger'){
    const doc=host(),win=doc.defaultView;
    if(win!==window&&win.SAResultFeedback)return win.SAResultFeedback.critical(key,message,type);
    const queue=critical.queue??=[],keys=critical.keys??=new Set();if(keys.has(key))return;keys.add(key);if(keys.size>500)keys.delete(keys.values().next().value);queue.push({message,type});if(!critical.active)next();
    critical.resume=next;
    function next(){
      if(win.SAExploreSession?.active?.()===false){critical.active=false;return;}
      const item=queue.shift();if(!item){critical.active=false;return;}critical.active=true;
      const banner=doc.createElement('aside');banner.className='critical-flight-banner';banner.dataset.type=item.type;banner.setAttribute('role','alert');banner.setAttribute('popover','manual');
      const track=doc.createElement('div'),text=doc.createElement('span');track.className='critical-flight-track';text.textContent=item.message;track.append(text);
      let closed=false,timer;const close=()=>{if(closed)return;closed=true;clearTimeout(timer);banner.remove();critical.close=null;next();};
      critical.close=close;const button=doc.createElement('button');button.type='button';button.textContent='×';button.setAttribute('aria-label','Dismiss alert');button.onclick=close;banner.append(track,button);doc.body.append(banner);banner.showPopover();
      const reduce=win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const width=track.clientWidth,length=text.scrollWidth,ms=Math.max(7000,(width+length)/115*1000);
      if(!reduce){text.animate([{transform:`translateX(${width}px)`},{transform:`translateX(${-length}px)`}],{duration:ms,fill:'forwards'});}
      timer=setTimeout(()=>{banner.animate([{opacity:1},{opacity:0}],{duration:650,fill:'forwards'}).finished.then(close).catch(close);},reduce?8000:ms);
    }
  }
  function closeButton(node,onClose=()=>{},label='Dismiss notification'){
    const b=node.ownerDocument.createElement('button');b.type='button';b.className='notice-dismiss';b.textContent='\u00d7';b.setAttribute('aria-label',label);
    b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onClose();node.hidden=true;noticeHost().refresh();});return b;
  }
  function notice(message,type='',duration=4800,{allowOutsideCombat=false}={}){
    if(!isCombatActive()&&!allowOutsideCombat)return;
    const doc=host();
    if(!noticeNode){noticeNode=doc.createElement('aside');noticeNode.className='interface-notice';noticeNode.setAttribute('role','status');noticeNode.append(doc.createElement('span'),closeButton(noticeNode));}
    noticeNode.dataset.allowOutsideCombat=String(allowOutsideCombat);noticeNode.querySelector('span').textContent=message;noticeNode.dataset.outcome=type;noticeNode.hidden=false;noticeHost().mount(noticeNode);noticeHost().schedule();
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{noticeNode.hidden=true;noticeHost().refresh();},duration);
  }
  function stored(key){try{return sessionStorage.getItem(key);}catch{return false;}}
  function push(key,title,message,{topLayer=false,reputation=null,details=null,allowOutsideCombat=false}={}){
    const storageKey='sa-result:'+key;if(seen.has(key)||stored(storageKey))return;seen.add(key);
    if(!isCombatActive()&&!allowOutsideCombat){try{sessionStorage.setItem(storageKey,'1');}catch{}return;}
    const doc=host();
    if(!tray?.isConnected)tray=doc.querySelector('.result-notifications');
    if(!tray){tray=doc.createElement('div');tray.className='result-notifications';tray.setAttribute('aria-label','Action results');}
    tray.hidden=false;
    const card=doc.createElement('article'),heading=doc.createElement('strong'),text=doc.createElement('p');
    card.dataset.allowOutsideCombat=String(allowOutsideCombat);card.setAttribute('role','status');heading.textContent=title;text.textContent=message;
    card.dataset.outcome=/failed|missed|cancelled/i.test(message)?'failed':/success|succeeded|complete|restored|cleared|damage confirmed/i.test(message)?'success':'pending';card.dataset.resultKey=storageKey;
    const ok=closeButton(card,()=>{try{sessionStorage.setItem(storageKey,'1');}catch{}card.remove();if(!tray.children.length)tray.hidden=true;},'Dismiss '+title);
    card.append(heading,text);
    if(details||reputation){
      const view=doc.createElement('button');view.type='button';view.textContent='View Results';view.className='notice-action';view.onclick=()=>{
        view.disabled=true;
        const dialog=doc.createElement('dialog');dialog.className='notification-result-detail';const h=doc.createElement('h2');h.textContent=title;const p=doc.createElement('p');p.textContent=details||message;dialog.append(h,p);
        if(reputation&&window.SAReputationUI){const block=doc.createElement('div');block.innerHTML=window.SAReputationUI.comparison(reputation);dialog.append(block);}
        const done=doc.createElement('button');done.textContent='Close';done.onclick=()=>dialog.close();dialog.append(done);dialog.onclose=()=>{dialog.remove();view.disabled=false;};doc.body.append(dialog);dialog.showModal();
      };card.append(view);
    }
    ok.textContent='Dismiss';
    card.append(ok);tray.append(card);noticeHost().mount(tray,'action-results');noticeHost().schedule();
  }
  function observe(){const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;for(const unit of state.units||[]){for(const result of unit.actionResults||[]){const owns=bridge.mode()==='gm'?result.controller==='gm'||unit.team==='npc':unit.id===bridge.myUnitId()&&result.controller!=='gm';if(owns&&result.stage!=='input')push(`${state.roomCode}:${unit.id}:${result.id}`,result.label,(Number.isFinite(result.total)?`Roll total ${Number(result.total.toFixed(2))}. `:'')+result.text);}}}
  window.addEventListener('sa-combat-state',event=>{const state=event.detail?.state||window.SACombatBridge?.state();setCombatActive(state?.hasEngagedClock&&!state.practice&&!state.catalogPreview&&!state.encounterEndedAt);observe();});
  window.addEventListener('pagehide',()=>{critical.queue?.splice(0);critical.close?.();if(tray?.ownerDocument===document)tray.remove();noticeNode?.remove();clearTimeout(noticeTimer);try{host().defaultView.SAInterfaceNoticeHost?.refresh();}catch{}});
  window.SAInterfaceNotices={host:noticeHost,closeButton,isCombatActive,setCombatActive};window.SAResultFeedback={push,notice,critical};
}());
