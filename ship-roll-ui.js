(function(){
  let dialog=null,notice=null,lastLog='',result='',until=0,forced='',cleanupDialog=null;
  const dismissed=new Set();
  const request=u=>u?.delayedAction?.awaitingRoll?u.delayedAction:u?.pendingShipRolls?.[0];
  const host=()=>{let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;};
  function poll(){
    const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;
    const doc=host(),gm=bridge.mode()==='gm',mine=state.units.find(u=>u.id===bridge.myUnitId()),waiting=state.units.filter(request);
    if(!notice){notice=doc.createElement('button');notice.type='button';notice.setAttribute('role','status');notice.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#260d13;color:#ff7887;border:1px solid #ff7686;padding:9px 16px;max-width:70vw;font:700 14px Arial';doc.body.append(notice);}
    const relevant=gm?waiting:waiting.filter(u=>u.id===mine?.id);
    const calls=state.starships.filter(s=>gm||s.id===mine?.location?.starshipId).flatMap(s=>(s.commandSystems?.calls||[]).filter(c=>c.status==='incoming').map(c=>s.title+': you are being Hailed by '+c.title));
    const awaiting=mine&&(state.delayRequest?.unitId===mine.id||state.activeAction?.unitId===mine.id||(state.itemResolution?.healerId===mine.id&&state.itemResolution.phase==='gmDifficulty')||(state.attackResolution?.attackerId===mine.id&&state.attackResolution.phase==='gmDamage'));
    const logs=state.log||[],index=logs.findIndex(e=>e.id===lastLog),fresh=lastLog?logs.slice(index+1):[];lastLog=logs.at(-1)?.id||lastLog;
    const updates=fresh.filter(e=>gm?/scan complete|detected|Life Scan|succeeded|failed|connected|prepared|analysis|repair|reboot|Hail/i.test(e.text):/Hail answered|Hail ended/i.test(e.text));
    if(updates.length){result=updates.map(e=>e.text).join(' | ');until=Date.now()+7000;}
    notice.textContent=relevant.map(u=>u.characterName+': '+request(u).label+' roll required').join(' | ')||calls.join(' | ')||(!gm&&awaiting?'Awaiting GM':'')||(Date.now()<until?result:'');
    notice.hidden=!notice.textContent;notice.onclick=()=>{const u=relevant[0];if(u&&(!gm||u.team==='npc'||doc.defaultView.confirm('Act for '+u.characterName+'?'))){dismissed.delete(request(u).id);forced=u.id;}};
    const parent=[...doc.querySelectorAll('dialog[open]')].at(-1)||doc.body;if(notice.parentElement!==parent)parent.append(notice);
    if(dialog){if(!waiting.some(u=>request(u).id===dialog.dataset.rollId))dialog.close();return;}
    const unit=waiting.find(u=>(gm?u.team==='npc'||u.id===forced:u.id===mine?.id)&&!dismissed.has(request(u).id));if(!unit)return;
    const pending=request(unit);if(!pending.rollSpec)return;
    const view=doc.createElement('dialog');dialog=view;view.setAttribute('aria-label','Ship action dice roll');
    view.dataset.rollId=pending.id;
    view.style.cssText='position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent';
    const frame=doc.createElement('iframe');frame.title='Skill Check';frame.style.cssText='width:100%;height:100%;border:0;background:transparent';frame.src=new URL('character.html?shipRoll=1',location.href).href;
    const error=doc.createElement('p');error.style.cssText='position:absolute;bottom:12px;left:25%;color:#ff798b;background:#081922';error.setAttribute('role','alert');
    let busy=false;
    const close=()=>{dismissed.add(pending.id);view.close();};
    const receive=async event=>{
      if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
      if(event.data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',...pending.rollSpec,rollId:pending.id,name:unit.characterName,title:pending.label},location.origin);
      if(event.data?.type==='sa-ship-skill-cancel')close();
      if(event.data?.type==='sa-ship-skill-result'&&event.data.rollId===pending.id&&!busy){
        busy=true;
        try{await bridge.action({action:'rollShipAction',id:unit.id,rollId:pending.id,score:event.data.score,diceResults:event.data.diceResults},'resolve',{throwOnError:true});close();}
        catch(e){error.textContent=e.message;const retry=doc.createElement('button');retry.textContent='Retry Submit';retry.onclick=()=>{retry.remove();busy=false;receive(event);};error.append(retry);}
      }
    };
    doc.defaultView.addEventListener('message',receive);view.addEventListener('cancel',event=>{event.preventDefault();close();});
    cleanupDialog=()=>{doc.defaultView.removeEventListener('message',receive);if(notice.parentElement===view)doc.body.append(notice);view.remove();dialog=null;forced='';cleanupDialog=null;};
    view.addEventListener('close',cleanupDialog,{once:true});view.append(frame,error);doc.body.append(view);view.showModal();
  }
  const timer=setInterval(poll,200);
  window.addEventListener('pagehide',()=>{clearInterval(timer);cleanupDialog?.();notice?.remove();});
}());
