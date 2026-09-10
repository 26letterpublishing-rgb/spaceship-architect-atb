(function(){
  let dialog=null,notice=null,lastNotice='',lastResult='',resultUntil=0,forced='',seen=new Set(),syncDialog=null;
  const host=()=>{let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}return doc;};
  function poll(){
    const bridge=window.SACombatBridge,state=bridge?.state();if(!state)return;
    const doc=host(),gm=bridge.mode()==='gm',mine=state.units.find(u=>u.id===bridge.myUnitId());
    if(!notice){notice=doc.createElement('div');notice.setAttribute('role','status');notice.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483646;background:#260d13;color:#ff7887;border:1px solid #ff7686;padding:9px 16px;max-width:70vw;font:700 14px Arial;pointer-events:none';doc.body.append(notice);}
    const request=u=>u.delayedAction?.awaitingRoll?u.delayedAction:u.pendingShipRolls?.[0];
    const waiting=state.units.filter(request);
    const awaitingGm=mine&&(state.delayRequest?.unitId===mine.id||state.activeAction?.unitId===mine.id||(state.itemResolution?.healerId===mine.id&&state.itemResolution.phase==='gmDifficulty')||([state.attackResolution?.attackerId,state.attackResolution?.defenderId].includes(mine.id)&&state.attackResolution?.phase==='gmDamage'));
    const text=gm?waiting.map(u=>`${u.characterName}: ${request(u).label} roll required`).join(' | '):awaitingGm?'Awaiting GM':'';
    if(gm){const logs=state.log||[],index=logs.findIndex(e=>e.id===lastNotice),fresh=lastNotice?logs.slice(index+1):[];lastNotice=logs.at(-1)?.id||lastNotice;const results=fresh.filter(e=>/scan complete|detected|Life Scan|succeeded|failed|connected|prepared|analysis|repair|reboot/i.test(e.text));if(results.length){lastResult=results.map(e=>e.text).join(' | ');resultUntil=Date.now()+7000;}}
    const noticeHost=[...doc.querySelectorAll('dialog[open]')].at(-1)||doc.body;
    if(notice.parentElement!==noticeHost)noticeHost.append(notice);
    notice.textContent=text||(Date.now()<resultUntil?lastResult:'');notice.hidden=!notice.textContent;
    notice.style.pointerEvents=gm&&waiting.length?'auto':'none';notice.title=gm&&waiting.length?'Click to roll for a waiting character':'';
    notice.onclick=()=>{if(gm&&waiting[0]&&doc.defaultView.confirm(`Act for ${waiting[0].characterName} and roll their pending action?`))forced=waiting[0].id;};
    if(dialog){syncDialog?.();return;}
    const unit=waiting.find(u=>gm?u.team==='npc'||u.id===forced:u.id===mine?.id);if(!unit)return;
    const pending=request(unit);if(seen.has(pending.id))return;
    const view=doc.createElement('dialog');dialog=view;view.setAttribute('aria-label','Ship action dice roll');
    view.style.cssText='width:min(500px,calc(100vw - 40px));padding:24px;background:#081a23;color:#e9faff;border:2px solid #68d9ed;border-radius:6px;font:16px/1.5 Arial';
    const heading=doc.createElement('h2');heading.textContent=pending.label;
    const status=doc.createElement('p');status.textContent=`${unit.characterName}: ready to roll.`;
    const dice=doc.createElement('div');dice.style.cssText='display:flex;gap:10px;flex-wrap:wrap;margin:20px 0';
    const button=doc.createElement('button');button.type='button';button.textContent='Roll Dice';button.style.cssText='padding:12px 24px;background:#f2d356;color:#101315;font-weight:bold;border:1px solid #fff1a7;border-radius:5px';
    const close=()=>{view.close();};
    view.addEventListener('cancel',e=>e.preventDefault());
    view.addEventListener('close',()=>{if(notice.parentElement===view)doc.body.append(notice);view.remove();dialog=null;syncDialog=null;forced='';});
    const showResult=result=>{
      if(button.dataset.done)return;
      for(const value of result.values||[]){const face=doc.createElement('strong');face.textContent=value;face.style.cssText='display:grid;place-items:center;width:48px;height:48px;background:#d9f7ff;color:#101820;border:2px solid #79c8dd;border-radius:7px;font:700 24px Arial';dice.append(face);if(!doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)face.animate([{transform:'rotate(-25deg) scale(.5)',opacity:0},{transform:'rotate(0) scale(1)',opacity:1}],{duration:550});}
      status.textContent=result.text+(Number.isFinite(result.total)?` Roll total: ${result.total}.`:'');button.textContent='Continue';button.dataset.done='1';button.disabled=false;
    };
    syncDialog=()=>{
      const current=bridge.state().units.find(u=>u.id===unit.id);
      if(current?.lastShipRoll?.id===pending.id)showResult(current.lastShipRoll);
      else if(!button.disabled&&request(current||{})?.id!==pending.id){status.textContent='This action is no longer waiting for a roll.';button.textContent='Continue';button.dataset.done='1';}
    };
    button.onclick=async()=>{
      if(button.dataset.done){seen.add(pending.id);close();return;}
      button.disabled=true;status.textContent='Rolling...';
      try{
        await bridge.action({action:'rollShipAction',id:unit.id,rollId:pending.id},'resolve',{throwOnError:true});
        const result=bridge.state().units.find(u=>u.id===unit.id)?.lastShipRoll;
        if(!result||result.id!==pending.id)throw Error('Waiting for the roll result. Please retry.');
        showResult(result);
      }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
    };
    view.append(heading,status,dice,button);doc.body.append(view);view.showModal();
  }
  const timer=setInterval(poll,200);
  window.addEventListener('pagehide',()=>{clearInterval(timer);dialog?.remove();notice?.remove();});
}());
