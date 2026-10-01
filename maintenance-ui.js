(function(){
  let active=null;
  function open(unit,sicId,initialKind){
    if(active)return;
    const bridge=window.SACombatBridge,state=bridge.state(),ship=state.starships.find(s=>s.id===unit?.location?.starshipId);
    let item=ship&&window.SAShipMap.buildLayout(ship.ship).footprint.get(unit.location.square)?.item;
    if(!item)return;const localId=item.id,isBridge=!!window.SAShipMap.definition(item.type).bridge;if(isBridge&&sicId)item=ship.ship.sicInventory.find(i=>i.id===sicId)||item;
    let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
    const view=doc.createElement('dialog');active=view;view.setAttribute('aria-label','SIC Maintenance');
    view.style.cssText='width:min(460px,calc(100vw - 40px));padding:22px;border:1px solid #59d2d8;border-radius:6px;background:#06151d;color:#e5f5f7;font:15px/1.5 Arial,sans-serif';
    const heading=doc.createElement('h2');heading.textContent=window.SAShipMap.definition(item.type).name||item.type;
    const details=doc.createElement('p');details.textContent=`Repair takes 9 combat seconds. Roll Intellect + the SIC's associated skill against ${Math.max(10,Number(item.repairDifficulty)||10)}. Power Off and Restart can be remote. Repair and Power On require this SIC’s station. Reboot requires registered crew access.`;
    const error=doc.createElement('p');error.setAttribute('role','alert');
    view.append(heading,details);
    if(isBridge){const selector=doc.createElement('select');selector.setAttribute('aria-label','System power target');for(const entry of window.SAShipMap.installedItems(ship)){const option=doc.createElement('option');option.value=entry.id;option.textContent=window.SAShipMap.definition(entry.type).name;selector.append(option);}selector.value=item.id;selector.onchange=()=>{item=ship.ship.sicInventory.find(i=>i.id===selector.value);heading.textContent=window.SAShipMap.definition(item.type).name;view.querySelectorAll('[data-maintenance-kind]').forEach(b=>b.disabled=unavailable(b.dataset.maintenanceKind));};view.append(selector);}
    let busy=false;
    const unavailable=kind=>{
      const current=bridge.state(),person=current.units.find(u=>u.id===unit.id),live=current.starships.find(s=>s.id===ship.id)?.ship.sicInventory.find(i=>i.id===item.id);
      if(!person||!live||(!current.practice&&current.activeId!==unit.id)||person.delayedAction||person.timedAction||person.delayTimer||person.consoleHold)return true;
      if(['on','repair','counter'].includes(kind)&&(item.id!==localId||!person.location.stationed))return true;
      if(current.practice&&['repair','counter'].includes(kind))return true;
      return kind==='repair'&&!live.impaired&&live.status!=='impaired'&&!(live.impairmentPoints>0)||kind==='on'&&(window.SAStationAccess.online(live)||live.bootRemaining>0)||kind==='restart'&&live.bootRemaining>0||kind==='off'&&!window.SAStationAccess.online(live)&&!live.bootRemaining;
    };
    for(const [kind,label]of [['repair','Repair SIC'],['off','Power Off'],['on','Power On'],['restart','Restart SIC']]){
      const button=doc.createElement('button');button.type='button';button.textContent=label;button.style.cssText='display:block;width:100%;margin:8px 0;padding:10px;background:#123c48;color:#e8faff;border:1px solid #67a8b7';
      button.dataset.maintenanceKind=kind;button.hidden=!!initialKind&&initialKind!==kind;button.disabled=unavailable(kind);
      button.onclick=async()=>{
        if(busy||!bridge.confirmGmPlayerAction(unit,kind))return;
        if(kind==='off'&&!doc.defaultView.confirm('Power off this SIC? Its functions will become unavailable immediately.'))return;
        busy=true;view.querySelectorAll('button').forEach(b=>b.disabled=true);
        try{await bridge.action({action:'shipMaintenance',id:unit.id,sicId:item.id,kind,requestId:crypto.randomUUID()},'resolve',{throwOnError:true});view.close();}
        catch(e){error.textContent=e.message;busy=false;view.querySelectorAll('button').forEach(b=>b.disabled=b.dataset.maintenanceKind?unavailable(b.dataset.maintenanceKind):false);}
      };view.append(button);
    }
    const counter=doc.createElement('button');counter.type='button';counter.textContent='Counter-hack (1D6)';counter.dataset.maintenanceKind='counter';counter.hidden=!!initialKind;
    counter.onclick=async()=>{
      const person=bridge.state().units.find(u=>u.id===unit.id);
      if(busy||!bridge.confirmGmPlayerAction(person,'counter-hack'))return;
      busy=true;counter.disabled=true;
      try{await bridge.action({action:'hackingCommand',id:unit.id,kind:'counter',sicId:item.id,turnSerial:person.turnSerial,requestId:crypto.randomUUID()},'resolve',{throwOnError:true});view.close();}
      catch(e){error.textContent=e.message;busy=false;}
    };view.append(counter);
    const close=doc.createElement('button');close.type='button';close.textContent='Back';close.onclick=()=>view.close();view.append(error,close);
    close.style.cssText='padding:10px 22px;background:#173641;color:#fff;border:1px solid #71b7cc;border-radius:4px;font-weight:bold';
    const status=doc.createElement('p');status.setAttribute('role','status');view.insertBefore(status,error);
    const timer=setInterval(()=>{const live=bridge.state().starships.find(s=>s.id===ship.id)?.ship.sicInventory.find(i=>i.id===item.id);status.textContent=live?.bootRemaining>0?`Restarting: ${Math.ceil(live.bootRemaining)} combat seconds remaining`:window.SAStationAccess.online(live)?'Online':'Powered off';if(!busy)view.querySelectorAll('[data-maintenance-kind]').forEach(b=>b.disabled=unavailable(b.dataset.maintenanceKind));},200);
    const cleanup=()=>{clearInterval(timer);view.remove();active=null;window.removeEventListener('pagehide',cleanup);};
    view.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});doc.body.append(view);view.showModal();
  }
  window.SAMaintenanceUI={open};
}());
