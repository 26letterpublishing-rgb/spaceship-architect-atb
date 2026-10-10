(function(){
  let dialog=null,opening=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const duration=n=>{n=Math.max(0,Math.ceil(n||0));return n>=86400?`${(n/86400).toFixed(2)} days`:n>=3600?`${(n/3600).toFixed(2)} hours`:n>=60?`${Math.floor(n/60)}m ${n%60}s`:`${n}s`;};
  async function open(unit,sicId){
    if(dialog||opening)return;opening=true;
    const b=window.SACombatBridge;let doc=document;try{while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;}catch{}
    try{for(const file of ['console-common.css','transit-console.css']){
      const href=new URL(file,location.href).href;if([...doc.styleSheets].some(s=>s.href===href))continue;
      await new Promise((resolve,reject)=>{const link=doc.createElement('link');link.rel='stylesheet';link.href=href;link.onload=resolve;link.onerror=()=>{link.remove();reject(Error('Console could not load. Please try again.'));};doc.head.append(link);});
    }}catch(error){opening=false;window.alert(error.message);return;}
    opening=false;const initial=window.SAStationAccess.access(b.state(),b.state()?.units?.find(u=>u.id===unit.id),sicId);if(!initial)return;
    const warp=initial.definition.warp,view=dialog=doc.createElement('dialog');view.className='utility-console lock-console transit-console';view.dataset.operatorId=unit.id;view.dataset.sicId=sicId;view.setAttribute('aria-label',initial.definition.name+' console');
    view.innerHTML=`<header><div><small>${esc(initial.ship.title)} / ${esc(unit.characterName)}</small><h2>${esc(initial.definition.name)}</h2></div><div data-turn></div><div data-selector></div><button data-sound type="button">${b.soundIcon()}</button><button data-close type="button">Combat View</button></header>
      <section class="lock-chart transit-scene"><img class="transit-machine" src="${warp?'warp-console-scene.webp':'field-utility-console-scene.webp'}" alt="${esc(initial.definition.name)}"><div class="warp-window" aria-hidden="true"></div><div class="destruct-key" aria-hidden="true"><span>AUTHORIZATION</span><pre>7A9F  E02C  18B4\nC701  2DF9  8A60\n91BE  F402  D73C</pre><b>&#9919;</b></div><strong data-phase></strong><output data-countdown></output><progress data-progress max="1" value="0"></progress><p data-journey></p></section>
      <section class="lock-controls utility-controls"><h3>${warp?'Route':'Security Authorization'}</h3>${warp?'<label>Distance (light-years)<input data-utility-control data-distance type="number" min="0.001" step="any" value="3.26"></label><button data-utility-control data-plan type="button">Calculate Route</button><div data-fuel-plan></div><button data-utility-control data-start type="button" disabled>Engage Warp</button><button data-utility-control data-cancel type="button">Cancel Activation</button><button data-utility-control data-exit type="button">Exit Warp</button>':'<label>Countdown (seconds)<input data-utility-control data-delay type="number" min="0" max="86400" step="1" value="60"></label><p data-approvals></p><button data-utility-control data-approve type="button">Approve Self-Destruct</button><button data-utility-control data-abort type="button">Cancel Self-Destruct</button><div data-blast hidden><strong data-dice></strong><label>Damage total<input data-utility-control data-damage type="number" min="0" step="1"></label><button data-utility-control data-resolve type="button">Confirm Damage</button></div>'}<output data-status role="status"></output><button data-utility-control data-retry hidden type="button">Retry Command</button></section>
      <section class="lock-reports"><h3>${warp?'Journey Report':'Security Log'}</h3><div data-report></div></section><div class="utility-seat"><button data-hold type="button">Hold</button><button data-leave type="button">Leave Console</button></div>`;
    view.dataset.transitShip=initial.ship.id;doc.body.append(view);view.showModal();const get=s=>view.querySelector(s);let busy=false,pending=null,planned=null,lastPhase='';
    const current=()=>{const state=b.state(),person=state?.units?.find(u=>u.id===unit.id);return{state,person,access:window.SAStationAccess.access(state,person,sicId)};};
    function redraw(){
      const {state,person,access}=current();if(!access){view.close();return;}const ship=access.ship;if(warp)window.SAWarpEffects?.update(ship,get(".warp-window"));const s=warp?ship.ship.warpState:ship.ship.destructState,phase=s?.phase||'standby';
      view.dataset.phase=phase;view.dataset.machine=warp?'warp':'destruct';
      const ready=state.practice||state.activeId===person.id&&!person.delayedAction&&!person.timedAction&&!person.consoleHold;
      get('[data-turn]').textContent=state.practice?'OUT OF COMBAT':ready?'YOUR TURN':window.SAConsoleCommon.standby(state,person);
      get('[data-phase]').textContent=({standby:'STANDBY',activating:'WARP ACTIVATION',traveling:'IN WARP',arrived:'ARRIVED',exited:'EARLY EXIT',interrupted:'INTERRUPTED',cancelled:'CANCELLED',approvals:'SECOND APPROVAL REQUIRED',countdown:'SELF-DESTRUCT ARMED',blastPending:'AWAITING DAMAGE ROLL',exploded:'SHIP DESTROYED'})[phase]||phase;
      get('[data-countdown]').textContent=['activating','countdown'].includes(phase)?duration(s.remaining):phase==='traveling'?duration(Math.max(0,s.targetLY-s.traveledLY)/3.26*s.secondsPerParsec):'';
      get('[data-progress]').value=phase==='traveling'?s.traveledLY/s.targetLY:s?.total?1-s.remaining/s.total:0;
      get('[data-journey]').textContent=warp&&s?`${Number(s.traveledLY.toFixed(4))} / ${Number(s.targetLY.toFixed(4))} light-years${phase==='traveling'?` | ${Math.ceil(Math.max(0,s.targetLY-s.traveledLY)*s.secondsPerParsec/3.26)} seconds remaining`:''}`:'';
      if(warp){
        get('[data-start]').disabled=busy||!ready||!planned||['activating','traveling'].includes(phase)||access.blocked;
        get('[data-plan]').disabled=busy;get('[data-cancel]').hidden=phase!=='activating';get('[data-exit]').hidden=phase!=='traveling';
        get('[data-cancel]').disabled=get('[data-exit]').disabled=busy;
      }else{
        get('[data-approvals]').textContent=`${s?.approvals?.length||0} / 2 crewmembers approved`;
        if(phase==='approvals')get('[data-delay]').value=s.total;
        get('[data-delay]').disabled=busy||['approvals','countdown','blastPending'].includes(phase);
        get('[data-approve]').disabled=busy||!ready||['countdown','blastPending','exploded'].includes(phase)||Boolean(s?.approvals?.some(a=>a.unitId===unit.id));
        get('[data-abort]').disabled=busy||!['approvals','countdown','blastPending'].includes(phase);
        get('[data-blast]').hidden=phase!=='blastPending';get('[data-dice]').textContent=phase==='blastPending'?`Roll ${s.diceCount}D12 damage. Add every die.`:'';
        get('[data-resolve]').disabled=busy||!(b.mode()==='gm'||s?.unitId===person.id);
      }
      const report=s?.report;get('[data-report]').textContent=report?(warp?`${report.reason||report.phase} Distance: ${Number((report.traveledLY||0).toFixed(4))} light-years. Elapsed: ${duration(report.elapsedSeconds)}. Fuel used: ${Object.entries(report.fuelUsed||{}).filter(([,v])=>v).map(([g,v])=>`${v} Grade ${g}`).join(', ')||'none'}. Unused range discarded: ${Number((report.discardedLY||0).toFixed(4))} light-years.`:report.reason||report.text||(report.total!=null?`${report.total} blast damage rolled.`:report.phase)):warp?'No completed journey.':'Requires two registered crewmembers. Any registered crewmember can cancel.';
      get('[data-hold]').textContent=person.consoleHold?'Resume':'Hold';get('[data-hold]').disabled=state.practice||busy||(!ready&&!person.consoleHold);get('[data-leave]').disabled=!state.practice&&(busy||!ready);get('[data-leave]').textContent=state.practice?'Return to Ship':'Leave Console';
      if(lastPhase!==phase&&['activating','traveling','countdown','arrived','exited'].includes(phase))b.consoleTick();lastPhase=phase;
    }
    async function send(){if(busy||!pending)return;busy=true;get('[data-retry]').hidden=true;redraw();try{const result=await b.transitAction(pending);if(result.result?.ok===false)throw Error(result.result.error);if(pending.kind==='warpPlan'){planned=result.result;get('[data-fuel-plan]').textContent=`${Object.entries(planned.counts).filter(([,n])=>n).map(([g,n])=>`${n} Grade ${g}`).join(' + ')} | ${duration(planned.travelSeconds)}`;}get('[data-status]').textContent='Confirmed.';pending=null;}catch(e){get('[data-status]').textContent=e.message;get('[data-retry]').hidden=false;}finally{busy=false;redraw();}}
    function command(kind,extra={}){pending={id:unit.id,shipId:initial.ship.id,starshipId:initial.ship.id,sicId,kind,requestId:crypto.randomUUID(),...extra};send();}
    get('[data-distance]')?.addEventListener('input',()=>{planned=null;get('[data-start]').disabled=true;});
    get('[data-plan]')?.addEventListener('click',()=>command('warpPlan',{distanceLY:Number(get('[data-distance]').value)}));
    get('[data-start]')?.addEventListener('click',()=>{
      const access=current().access,ew=access.definition.instantWarp;
      if(!doc.defaultView.confirm(ew?'Begin EW-FTL activation? Spends all current AU and two Grade S cells now. Activation takes 120 seconds.':'Begin warp activation? The ship must remain stationary. Fuel is consumed only as used.'))return;
      const extra={distanceLY:Number(get('[data-distance]').value)};
      if(!ew||!(access.item.impaired||access.item.impairmentPoints>0||access.item.status==='impaired')){command('warpStart',extra);return;}
      const roll=doc.createElement('dialog'),frame=doc.createElement('iframe'),status=doc.createElement('p'),retry=doc.createElement('button'),id=crypto.randomUUID();
      roll.className='transit-fault-roll';roll.setAttribute('aria-label','EW-FTL Drive D8');frame.title='Standard EW-FTL dice';status.textContent='Loading D8...';retry.textContent='Retry Loading Dice';retry.hidden=true;let timer;
      const load=()=>{retry.hidden=true;frame.src=new URL('character.html?shipRoll=1',location.href).href;clearTimeout(timer);timer=setTimeout(()=>retry.hidden=false,4000);};retry.onclick=load;
      const receive=e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const d=e.data;if(d?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:id,sides:[8],bonus:0,exertionAvailable:0,skill:'Engineering',attributeLabel:'Drive Integrity',cancelable:true,immediateResult:true,difficulty:Math.max(1,Number(access.item.impairmentPoints)||1)+1,difficultyLabel:'A result at or below impairment points destroys the ship.',name:unit.characterName,title:'EW-FTL integrity: D8'},location.origin);if(d?.rollId===id&&d.type==='sa-ship-skill-opened'){clearTimeout(timer);status.hidden=true;}if(d?.type==='sa-ship-skill-cancel')roll.close();if(d?.rollId===id&&d.type==='sa-ship-skill-result'){command('warpStart',{...extra,diceResults:d.diceResults});roll.close();}};
      doc.defaultView.addEventListener('message',receive);view.addEventListener('close',()=>roll.close(),{once:true});roll.onclose=()=>{clearTimeout(timer);doc.defaultView.removeEventListener('message',receive);roll.remove();};roll.append(frame,status,retry);doc.body.append(roll);roll.showModal();load();
    });
    get('[data-cancel]')?.addEventListener('click',()=>command('warpCancel'));
    get('[data-exit]')?.addEventListener('click',()=>{if(doc.defaultView.confirm('Exit warp now? Unused range in the current fuel cell will be lost.'))command('warpExit');});
    get('[data-approve]')?.addEventListener('click',()=>{if(doc.defaultView.confirm('Approve destruction of this ship? Two distinct registered crewmembers must agree.'))command('destructApprove',{countdownSeconds:Number(get('[data-delay]').value)});});
    get('[data-abort]')?.addEventListener('click',()=>command('destructCancel'));
    get('[data-resolve]')?.addEventListener('click',()=>{const s=current().access.ship.ship.destructState;command('blastRoll',{blastId:s.id,score:Number(get('[data-damage]').value)});});
    const close=()=>{window.SAShipNavigationUI.remember(current().person||unit);view.close();};
    get('[data-retry]').onclick=send;get('[data-close]').onclick=close;get('[data-sound]').onclick=()=>{b.toggleSound();window.SAConsoleCommon.updateSound(view);};
    get('[data-hold]').onclick=()=>window.SAShipNavigationUI.toggleHold(current().person).catch(e=>get('[data-status]').textContent=e.message);
    get('[data-leave]').dataset.utilityControl='';
    get('[data-leave]').onclick=()=>{const {state,person}=current();close();if(!state.practice)window.SACombatMap.openMove(person);};
    let timer;const unload=()=>view.close();
    view.addEventListener('close',()=>{if(warp)window.SAWarpEffects?.clear();clearInterval(timer);window.removeEventListener('pagehide',unload);view.remove();dialog=null;b.requestRender();},{once:true});window.addEventListener('pagehide',unload,{once:true});
    window.SAShipNavigationUI.mountSelector(get('[data-selector]'),unit,sicId,()=>view.close());
    redraw();if(view.open)timer=setInterval(redraw,250);
  }
  window.SATransitConsoleUI={open,isOpen:()=>Boolean(dialog||opening)};
}());
