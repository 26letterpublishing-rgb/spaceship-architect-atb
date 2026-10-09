(function(){
  const seen=new Set();let tray=null,noticeNode=null,noticeTimer=null,combatActive=false;
  // The campaign shell owns the answer for its embedded consoles. A paused
  // encounter remains combat; a console preview or preparation screen does not.
  function isCombatActive(){const win=host().defaultView;return win===window?combatActive:Boolean(win.SAInterfaceNotices?.isCombatActive());}
  function setCombatActive(active){const next=Boolean(active);if(next===combatActive)return;combatActive=next;host().defaultView.SAInterfaceNoticeHost?.refresh();}
  function host(){let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}if(!doc.querySelector('link[data-result-feedback],link[href*="result-feedback.css"]')){const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('result-feedback.css',location.href).href;link.dataset.resultFeedback='';doc.head.append(link);}return doc;}
  function noticeHost(){
    const doc=host(),win=doc.defaultView;
    if(win.SAInterfaceNoticeHost)return win.SAInterfaceNoticeHost;
    const rail=doc.createElement('aside'),space=doc.createElement('div'),adjusted=new Map();
    rail.className='interface-notice-rail';rail.setAttribute('aria-label','Notifications');rail.setAttribute('popover','manual');
    space.className='interface-notice-space';space.hidden=true;space.setAttribute('aria-hidden','true');doc.body.prepend(space);doc.body.append(rail);
    let queued=false;
    const properties=['position','top','bottom','max-height','height'];
    function restore(dialog,saved){for(const name of properties){const old=saved[name];if(old.value)dialog.style.setProperty(name,old.value,old.priority);else dialog.style.removeProperty(name);}}
    function refresh(){
      if(!isCombatActive())for(const node of rail.children){node.hidden=true;if(node.classList.contains('result-notifications'))node.replaceChildren();}
      const active=[...rail.children].some(n=>!n.hidden),dialogs=[...doc.querySelectorAll('dialog[open]')],parent=dialogs.at(-1)||doc.body;
      if(rail.parentElement!==parent){if(rail.matches(':popover-open'))rail.hidePopover();parent.append(rail);}
      if(active&&!rail.matches(':popover-open'))rail.showPopover();else if(!active&&rail.matches(':popover-open'))rail.hidePopover();
      const height=active?Math.ceil(rail.getBoundingClientRect().height):0;
      space.style.height=height+'px';space.hidden=!height;doc.documentElement.style.setProperty('--interface-notice-height',height+'px');doc.body.classList.toggle('has-interface-notices',height>0);
      // Reserve real space above native dialogs too, without adding a grid cell to a console.
      for(const [dialog,saved] of adjusted){if(!height||!dialog.open||!dialog.isConnected){restore(dialog,saved);adjusted.delete(dialog);}}
      if(height)for(const dialog of dialogs){
        let saved=adjusted.get(dialog);
        if(!saved){saved=Object.fromEntries(properties.map(name=>[name,{value:dialog.style.getPropertyValue(name),priority:dialog.style.getPropertyPriority(name)}]));saved.full=dialog.getBoundingClientRect().height>=win.innerHeight*.85||dialog.matches('.shared-console-layout,.ship-navigation-dialog,.cleanser-station,.expanded-interior-dialog');adjusted.set(dialog,saved);}
        dialog.style.setProperty('position','fixed','important');dialog.style.setProperty('top',height+'px','important');dialog.style.setProperty('bottom','0','important');dialog.style.setProperty('max-height',`calc(100dvh - ${height}px - ${saved.full?0:16}px)`,'important');
        if(saved.full)dialog.style.setProperty('height',`calc(100dvh - ${height}px)`,'important');
      }
    }
    function schedule(){if(queued)return;queued=true;win.requestAnimationFrame(()=>{queued=false;refresh();});}
    new win.ResizeObserver(schedule).observe(rail);
    new win.MutationObserver(records=>{if(records.some(r=>r.target.tagName==='DIALOG'||[...r.addedNodes,...r.removedNodes].some(n=>n.tagName==='DIALOG')))schedule();}).observe(doc.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
    win.addEventListener('resize',schedule);
    const api={mount(node,key=''){if(!isCombatActive())node.hidden=true;if(key){const old=[...rail.children].find(n=>n.dataset.noticeKey===key);if(old&&old!==node)old.remove();node.dataset.noticeKey=key;}if(node.parentElement!==rail){rail.append(node);schedule();}return node;},refresh,schedule,remove(node){node?.remove();refresh();}};
    win.SAInterfaceNoticeHost=api;return api;
  }
  function closeButton(node,onClose=()=>{},label='Dismiss notification'){
    const b=node.ownerDocument.createElement('button');b.type='button';b.className='notice-dismiss';b.textContent='\u00d7';b.setAttribute('aria-label',label);
    b.addEventListener('pointerdown',e=>e.stopPropagation());b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();onClose();node.hidden=true;noticeHost().refresh();});return b;
  }
  function notice(message,type='',duration=4800){
    if(!isCombatActive())return;
    const doc=host();
    if(!noticeNode){noticeNode=doc.createElement('aside');noticeNode.className='interface-notice';noticeNode.setAttribute('role','status');noticeNode.append(doc.createElement('span'),closeButton(noticeNode));}
    noticeNode.querySelector('span').textContent=message;noticeNode.dataset.outcome=type;noticeNode.hidden=false;noticeHost().mount(noticeNode);noticeHost().schedule();
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{noticeNode.hidden=true;noticeHost().refresh();},duration);
  }
  function stored(key){try{return sessionStorage.getItem(key);}catch{return false;}}
  function push(key,title,message,{topLayer=false}={}){
    const storageKey='sa-result:'+key;if(seen.has(key)||stored(storageKey))return;seen.add(key);
    if(!isCombatActive()){try{sessionStorage.setItem(storageKey,'1');}catch{}return;}
    const doc=host();
    if(!tray?.isConnected)tray=doc.querySelector('.result-notifications');
    if(!tray){tray=doc.createElement('div');tray.className='result-notifications';tray.setAttribute('aria-label','Action results');}
    tray.hidden=false;
    const card=doc.createElement('article'),heading=doc.createElement('strong'),text=doc.createElement('p');
    card.setAttribute('role','status');heading.textContent=title;text.textContent=message;
    card.dataset.outcome=/failed|missed|cancelled/i.test(message)?'failed':/success|succeeded|complete|restored|cleared|damage confirmed/i.test(message)?'success':'pending';card.dataset.resultKey=storageKey;
    const ok=closeButton(card,()=>{try{sessionStorage.setItem(storageKey,'1');}catch{}card.remove();if(!tray.children.length)tray.hidden=true;},'Dismiss '+title);
    card.append(heading,text,ok);tray.append(card);noticeHost().mount(tray,'action-results');noticeHost().schedule();
  }
  function observe(){const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;for(const unit of state.units||[]){for(const result of unit.actionResults||[]){const owns=bridge.mode()==='gm'?result.controller==='gm'||unit.team==='npc':unit.id===bridge.myUnitId()&&result.controller!=='gm';if(owns&&result.stage!=='input')push(`${state.roomCode}:${unit.id}:${result.id}`,result.label,(Number.isFinite(result.total)?`Roll total ${Number(result.total.toFixed(2))}. `:'')+result.text);}}}
  window.addEventListener('sa-combat-state',event=>{const state=event.detail?.state||window.SACombatBridge?.state();setCombatActive(state?.hasEngagedClock&&!state.practice&&!state.catalogPreview&&!state.encounterEndedAt);observe();});
  window.addEventListener('pagehide',()=>{if(tray?.ownerDocument===document)tray.remove();noticeNode?.remove();clearTimeout(noticeTimer);try{host().defaultView.SAInterfaceNoticeHost?.refresh();}catch{}});
  window.SAInterfaceNotices={host:noticeHost,closeButton,isCombatActive,setCombatActive};window.SAResultFeedback={push,notice};
}());
