(function(){
  const seen=new Set();let tray=null,noticeNode=null,noticeTimer=null;
  function host(){let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;}
  function notice(message,type='',duration=4800){
    const doc=host();
    if(!noticeNode){
      noticeNode=doc.createElement('aside');noticeNode.className='interface-notice';
      noticeNode.setAttribute('popover','manual');noticeNode.setAttribute('role','status');
      const text=doc.createElement('span'),close=doc.createElement('button');
      close.type='button';close.textContent='\u00d7';close.setAttribute('aria-label','Dismiss notification');
      close.onclick=()=>noticeNode.hidePopover();noticeNode.append(text,close);doc.body.append(noticeNode);
    }
    noticeNode.querySelector('span').textContent=message;noticeNode.dataset.outcome=type;
    noticeNode.showPopover();clearTimeout(noticeTimer);
    noticeTimer=setTimeout(()=>noticeNode?.hidePopover(),duration);
  }
  function push(key,title,message){
    const storageKey='sa-result:'+key;
    if(seen.has(key)||sessionStorage.getItem(storageKey))return;
    seen.add(key);
    const doc=host();
    if(!tray?.isConnected)tray=doc.querySelector('.result-notifications');
    if(!tray){tray=doc.createElement('aside');tray.className='result-notifications';tray.setAttribute('aria-label','Action results');doc.body.append(tray);}
    const card=doc.createElement('article'),heading=doc.createElement('strong'),text=doc.createElement('p'),ok=doc.createElement('button');
    card.setAttribute('role','status');heading.textContent=title;text.textContent=message;
    card.dataset.outcome=/failed|missed|cancelled/i.test(message)?'failed':/success|succeeded|complete|restored|cleared|damage confirmed/i.test(message)?'success':'pending';
    ok.type='button';ok.textContent='OK';ok.setAttribute('aria-label','Dismiss '+title);
    card.dataset.resultKey=storageKey;
    ok.onclick=()=>{const cards=card===tray.lastElementChild?[...tray.children]:[card];for(const entry of cards){sessionStorage.setItem(entry.dataset.resultKey,'1');entry.remove();}};card.append(heading,text,ok);tray.append(card);
  }
  function observe(){
    const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;
    for(const unit of state.units||[]){
      for(const result of unit.actionResults||[]){
        const owns=bridge.mode()==='gm'?result.controller==='gm'||unit.team==='npc':unit.id===bridge.myUnitId()&&result.controller!=='gm';
        if(owns&&result.stage!=='input')push(`${state.roomCode}:${unit.id}:${result.id}`,result.label,(Number.isFinite(result.total)?`Roll total ${result.total}. `:'')+result.text);
      }
    }
  }
  window.addEventListener('sa-combat-state',observe);
  window.addEventListener('pagehide',()=>{tray?.remove();noticeNode?.remove();clearTimeout(noticeTimer);});
  window.SAResultFeedback={push,notice};
}());
