(function(){
  let panel,model,submit,dialog,collapsed=false;const phases=new Map();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function host(){
    if(!panel||panel.hidden)return;
    const target=[...document.querySelectorAll('dialog[open]')].at(-1)||document.body;
    // Forms and map dialogs need their entire viewport, including their footer.
    // Keep the live status available in consoles, then restore it after dialogs close.
    const unrelatedDialog=target!==document.body&&!target.dataset.operatorId;
    const ownTransitConsole=panel.querySelectorAll('article').length===1&&target.dataset.transitShip===panel.querySelector('article')?.dataset.transitShip;
    if(unrelatedDialog||ownTransitConsole){if(panel.matches(':popover-open'))panel.hidePopover();return;}
    if(panel.parentElement!==target)target.append(panel);
    if(!panel.matches(':popover-open'))panel.showPopover();
  }
  new MutationObserver(events=>{if(events.some(e=>e.target instanceof HTMLDialogElement||[...e.addedNodes,...e.removedNodes].some(n=>n instanceof HTMLDialogElement)))host();}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  function actors(ship){return [...(model.characters||[]).filter(c=>ship.crewCharacterIds?.includes(c.id)).map(c=>({characterId:c.id,name:c.character?.identity?.characterName||c.id})),...(model.npcRoster||[]).filter(u=>ship.crewNpcUnitIds?.includes(u.id)).map(u=>({id:u.id,name:u.characterName}))];}
  function update(next,callback){
    if(!next)return;model=next;submit=callback;
    if(!panel){const css=document.createElement('link');css.rel='stylesheet';css.href='transit-console.css';document.head.append(css);panel=document.createElement('aside');panel.className='transit-status';panel.setAttribute('popover','manual');panel.setAttribute('aria-label','Warp and Self-Destruct status');document.body.append(panel);panel.onclick=click;}
    // Galaxy journeys own their countdown and cancellation controls on the map.
    const ships=(model.starships||[]).filter(s=>model.role==='gm'||s.crewCharacterIds?.includes(model.ownCharacterId)).filter(s=>!s.ship.warpState?.campaignClock||['approvals','countdown','blastPending'].includes(s.ship.destructState?.phase));
    for(const ship of ships){
      const warp=ship.ship.warpState,previous=phases.get(ship.id);
      if(previous==='traveling'&&['arrived','exited','interrupted'].includes(warp?.phase)){
        const report=warp.report||{},view=document.createElement('dialog');view.className='transit-damage';view.setAttribute('aria-label','Warp Exit Report');view.innerHTML=`<h2>${esc(ship.title)}: Warp Exit Report</h2><p>${esc(report.reason||warp.phase)}</p><p>Distance traveled: ${Number((report.traveledLY||0).toFixed(4))} light-years</p><p>Fuel used: ${Object.entries(report.fuelUsed||{}).filter(([,n])=>n).map(([g,n])=>`${n} Grade ${esc(g)}`).join(', ')||'none'}</p><p>Unused active-cell range discarded: ${Number((report.discardedLY||0).toFixed(4))} light-years</p><button type="button">OK</button>`;view.querySelector('button').onclick=()=>view.close();view.onclose=()=>view.remove();document.body.append(view);view.showModal();
      }
      phases.set(ship.id,warp?.phase);
    }
    const active=ships.filter(s=>['activating','traveling'].includes(s.ship.warpState?.phase)||['approvals','countdown','blastPending'].includes(s.ship.destructState?.phase));
    panel.hidden=!active.length;if(panel.hidden){if(panel.matches(':popover-open'))panel.hidePopover();return;}

    const markup='<button type="button" data-collapse-warp aria-label="Hide or show warp status">'+(collapsed?'&lt;':'&gt;')+'</button>'+active.map(s=>{const w=s.ship.warpState,d=s.ship.destructState,destruct=['approvals','countdown','blastPending'].includes(d?.phase),choices=actors(s);
      return `<article data-transit-ship="${esc(s.id)}"><strong>${esc(s.title)}</strong><output data-transit-phase></output>${model.role==='gm'?`<select aria-label="Acting crewmember">${choices.map((a,i)=>`<option value="${i}">${esc(a.name)}</option>`).join('')}</select>`:''}${destruct?'<button type="button" data-kind="destructCancel">Cancel Self-Destruct</button>':w?.phase==='activating'?'<button type="button" data-kind="warpCancel">Cancel Warp Activation</button>':'<button type="button" data-kind="warpExit">Exit Warp</button>'}${d?.phase==='blastPending'&&(model.role==='gm'||d.approvals?.at(-1)?.crewId===`character:${model.ownCharacterId}`)?`<button type="button" data-kind="blastRoll">Roll ${d.diceCount}D12 Damage</button>`:''}<span role="status" data-transit-error></span></article>`;}).join('');
    if(panel.dataset.markup!==markup){panel.innerHTML=markup;panel.dataset.markup=markup;}
    for(const ship of active){const d=ship.ship.destructState,w=ship.ship.warpState,destruct=['approvals','countdown','blastPending'].includes(d?.phase);panel.querySelector(`[data-transit-ship="${CSS.escape(ship.id)}"] output`).textContent=destruct?(d.phase==='blastPending'?'ATB paused: roll blast damage':d.phase==='approvals'?`${d.approvals.length} / 2 Self-Destruct approvals`:`Self-Destruct: ${Math.ceil(d.remaining)} seconds`):w.phase==='traveling'?`In Warp: ${Number((w.traveledLY||0).toFixed(3))} / ${Number(w.targetLY.toFixed(3))} LY · ${Math.ceil(Math.max(0,w.targetLY-(w.traveledLY||0))*w.secondsPerParsec/3.26)} seconds remaining`:`Warp activation: ${Math.ceil(w.remaining)} seconds`;}
    const critical=active.some(s=>['approvals','countdown','blastPending'].includes(s.ship.destructState?.phase));panel.querySelector('[data-collapse-warp]').hidden=critical;panel.classList.toggle('collapsed',collapsed&&!critical);host();
  }
  async function click(event){
    if(event.target.closest('[data-collapse-warp]')){collapsed=!collapsed;panel.classList.toggle('collapsed',collapsed);event.target.textContent=collapsed?'<':'>';return;}
    const button=event.target.closest('[data-kind]');if(!button)return;const article=button.closest('article'),ship=model.starships.find(s=>s.id===article.dataset.transitShip),actor=model.role==='gm'?actors(ship)[Number(article.querySelector('select')?.value)||0]:{characterId:model.ownCharacterId};
    if(!actor&&button.dataset.kind!=='blastRoll'){article.querySelector('[data-transit-error]').textContent='No registered crew are available.';return;}
    const body={starshipId:ship.id,sicId:button.dataset.kind.startsWith('warp')?ship.ship.warpState?.sicId:ship.ship.destructState?.sicId,...actor,kind:button.dataset.kind,requestId:crypto.randomUUID()};
    if(body.kind==='blastRoll'){openDamage(ship,body);return;}
    if(body.kind==='warpExit'&&!confirm('Exit warp now? Unused range in the current fuel cell will be discarded.'))return;
    button.disabled=true;try{const result=await submit(body);if(result?.campaign)update(result.campaign,submit);}catch(error){article.querySelector('[data-transit-error]').textContent=error.message;}finally{button.disabled=false;}
  }
  function openDamage(ship,body){
    if(dialog)return;const d=ship.ship.destructState,view=dialog=document.createElement('dialog');view.className='transit-damage';view.setAttribute('aria-label','Self-Destruct Damage');
    view.innerHTML=`<h2>${esc(ship.title)}: Self-Destruct</h2><strong>Roll ${d.diceCount}D12 damage</strong><form><label>Damage total<input aria-label="Damage total" type="number" min="${d.diceCount}" max="${d.diceCount*12}" step="1" required></label><button type="submit">Confirm Damage</button><button type="button" data-close>Close</button><output role="status"></output></form>`;
    const form=view.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{const result=await submit({...body,blastId:d.id,score:Number(form.querySelector('input').value)});view.close();if(result.campaign)update(result.campaign,submit);}catch(error){form.querySelector('output').textContent=error.message;}finally{button.disabled=false;}};
    view.querySelector('[data-close]').onclick=()=>view.close();view.onclose=()=>{view.remove();dialog=null;};document.body.append(view);view.showModal();
  }
  window.SATransitStatus={update};
}());
