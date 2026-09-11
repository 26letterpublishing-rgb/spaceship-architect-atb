(function() {
  const actions = {area:'Scan Area',hex:'Scan Hex',analysis:'Systems Analysis',evade:'Evasive Maneuvers',ram:'Ram',skim:'Skim'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function conditionalControls(host){
    const element=host.createElement('details');element.className='conditional-order-controls';
    element.innerHTML='<summary>Delay an Action</summary><label><input type="checkbox" data-conditional> Arm next order (2 AU)</label><label>Triggering Ship<select data-trigger-target></select></label><label>Trigger<select data-trigger-kind><option value="movement">Any movement</option><option value="distance">Distance traveled</option><option value="range">Within range</option><option value="hex">Enter hex</option></select></label><label>Distance<input data-trigger-distance type="number" value="1" min="1"></label><div class="command-coordinate"><label>Hex Q<input data-trigger-q type="number" step="1" value="0"></label><label>Hex R<input data-trigger-r type="number" step="1" value="0"></label></div><button type="button" data-pick-trigger>Choose trigger hex</button><small>Requires Systems Analysis. One armed order per ship; expires after 12 combat seconds.</small>';
    return element;
  }
  function conditionalPayload(root){
    const get=s=>root.querySelector(s);
    return get('[data-conditional]')?.checked?{kind:get('[data-trigger-kind]').value,targetId:get('[data-trigger-target]').value,distance:Number(get('[data-trigger-distance]').value),hex:{q:Number(get('[data-trigger-q]').value),r:Number(get('[data-trigger-r]').value)}}:null;
  }
  function refreshConditional(root,contacts){
    const select=root.querySelector('[data-trigger-target]');if(!select)return;
    const options=contacts.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
    if(select.dataset.options!==options){const old=select.value;select.innerHTML=options;if(contacts.some(c=>c.id===old))select.value=old;select.dataset.options=options;}
  }
  function mount(dialog, unitId) {
    const chart = dialog.querySelector('.pilot-chart');
    const title = chart.querySelector('.pilot-chart-title');
    const toggle = dialog.ownerDocument.createElement('button');toggle.type='button';toggle.textContent='Command';toggle.dataset.commandPage='';
    title.append(toggle);
    const panel = dialog.ownerDocument.createElement('div');panel.className='pilot-command-operations';panel.hidden=true;
    panel.innerHTML=`<div class="command-controls"><label>Detected Ship<select data-command-target></select></label><div class="command-coordinate"><label>Disclosed Q<input type="number" step="1" data-disclosed-q></label><label>Disclosed R<input type="number" step="1" data-disclosed-r></label></div><div class="command-action-row"><button type="button" data-command="hail">Hail Ship</button></div><label>Prepare For<select data-prepared-action>${Object.entries(actions).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><div class="command-action-row"><button type="button" data-command="team">Team Execution</button></div><div class="command-action-row"><button type="button" data-command="calculation">Preemptive Calculation</button></div></div><div class="command-controls"><h3>Maneuvers</h3><div class="command-action-row"><button type="button" data-command="evade">Evasive Maneuvers</button></div><div class="command-action-row"><button type="button" data-command="ram">Ram</button></div><div class="command-action-row"><button type="button" data-command="skim">Skim</button></div><div data-command-calls></div><p data-command-error role="alert"></p><div data-command-preparations></div></div>`;
    chart.append(panel);
    const lockControls=dialog.ownerDocument.createElement('div');lockControls.innerHTML='<label>Incoming Lock<select data-break-target aria-label="Incoming targeting ship"></select></label><div class="command-action-row"><button type="button" data-command="break">Break Lock-On</button></div>';panel.querySelectorAll('.command-controls')[1].append(lockControls);
    const stepButton=dialog.ownerDocument.createElement('button');stepButton.type='button';stepButton.textContent='Evade Step';stepButton.hidden=true;
    panel.querySelectorAll('.command-controls')[1].append(stepButton);
    stepButton.onclick=()=>{
      const text=dialog.ownerDocument.defaultView.prompt('One-Unit evasion destination (Hex Q, Hex R):');
      if(!text)return;const values=text.split(',').map(n=>Number(n.trim()));
      if(values.length!==2||!values.every(Number.isInteger)){panel.querySelector('[data-command-error]').textContent='Enter whole-number Q, R coordinates.';return;}
      void send({kind:'evadeStep',destination:{q:values[0],r:values[1]}});
    };
    const conditional=conditionalControls(dialog.ownerDocument);
    chart.append(conditional);
    panel.querySelectorAll('[data-command]').forEach(b=>window.SAActionHelp.attach(b,b.dataset.command));
    let busy=false,lastTargets='',lastCalls='';
    const bridge=window.SACombatBridge;
    const initial=bridge.state(),person=initial.units.find(u=>u.id===unitId),position=initial.shipPositions.find(p=>p.id===person.location?.starshipId);
    panel.querySelector('[data-disclosed-q]').value=Math.round(position?.q||0);panel.querySelector('[data-disclosed-r]').value=Math.round(position?.r||0);
    toggle.onclick=()=>{panel.hidden=!panel.hidden;chart.classList.toggle('command-page',!panel.hidden);toggle.textContent=panel.hidden?'Command':'Navigation';title.querySelector('h3').textContent=panel.hidden?'Navigation':'Command';};
    async function send(body) {
      if(busy)return;
      const person=bridge.state().units.find(u=>u.id===unitId);
      if(!bridge.confirmGmPlayerAction(person,body.kind))return;
      if(['ram','skim'].includes(body.kind)&&!window.confirm('Confirm collision order? Both ships can take damage, including your own.'))return;
      busy=true;redraw();panel.querySelector('[data-command-error]').textContent='';
      try {
        if(!body.callId&&!['evadeStep','break'].includes(body.kind))body.trigger=conditionalPayload(dialog);
        await bridge.action({action:body.kind==='break'?'lockCommand':'shipCommand',id:unitId,requestId:crypto.randomUUID(),...body},'resolve',{throwOnError:true});if(dialog.classList.contains('combat-order-dialog'))dialog.close();
      }
      catch(error){panel.querySelector('[data-command-error]').textContent=error.message;}
      finally{busy=false;redraw();}
    }
    panel.addEventListener('click',event=>{
      const button=event.target.closest('[data-command]');
      if(button&&!button.disabled)void send({kind:button.dataset.command,targetId:panel.querySelector(button.dataset.command==='break'?'[data-break-target]':'[data-command-target]').value,preparedAction:panel.querySelector('[data-prepared-action]').value,disclosedPosition:{q:Number(panel.querySelector('[data-disclosed-q]').value),r:Number(panel.querySelector('[data-disclosed-r]').value)}});
      const call=event.target.closest('[data-call-action]');if(call&&!call.disabled)void send({kind:call.dataset.callAction,callId:call.dataset.callId});
    });
    function redraw() {
      const state=bridge.state(),person=state.units.find(u=>u.id===unitId),ship=state.starships.find(s=>s.id===person?.location?.starshipId);
      if(!ship)return;
      stepButton.hidden=ship.commandSystems?.evadeStep?.unitId!==unitId;stepButton.disabled=busy;
      const contacts=Object.values(ship.sensorState?.contacts||{}).filter(c=>c.level==='detected');
      refreshConditional(dialog,contacts);
      const options=contacts.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if(options!==lastTargets){
        for(const select of panel.querySelectorAll('[data-command-target],[data-trigger-target]')){const old=select.value;select.innerHTML=options;if(contacts.some(c=>c.id===old))select.value=old;}lastTargets=options;
      }
      const ready=state.activeId===unitId&&!person.delayedAction&&!person.timedAction&&!person.delayTimer&&!person.consoleHold&&!person.shieldRestabilizing;
      const propulsion=window.SAShipNavigation.access(state,person);
      const incoming=ship.incomingLocks||[],enemy=panel.querySelector('[data-break-target]'),old=enemy.value,enemyHtml=incoming.map(l=>`<option value="${esc(l.shipId)}">${esc(l.title)}</option>`).join('')||'<option value="">No incoming locks</option>';if(enemy.innerHTML!==enemyHtml){enemy.innerHTML=enemyHtml;if(incoming.some(l=>l.shipId===old))enemy.value=old;}
      const mathematics=person.mathematicsSkill??(person.team==='npc'?person.mentalSkill:0);
      panel.querySelectorAll('[data-command]').forEach(button=>{
        const kind=button.dataset.command;
        const reason=busy?'Sending order.':!ready?'Wait for your turn and finish the current action.':['ram','skim','evade'].includes(kind)&&!propulsion?'Operational engines and thrusters required.':['ram','skim','hail'].includes(kind)&&!contacts.length?'No detected ships.':kind==='calculation'&&!(mathematics>=1)?'Requires Mathematics 1 or higher.':'';
        button.disabled=Boolean(reason);button.title=reason||window.SAActionHelp.descriptions[kind]?.[1]||'';
        if(kind==='break'){const why=!incoming.length?'No incoming locks.':!propulsion?'Working thrusters required.':window.SAShipSensors.masking(state,ship)<=0?'Masking is zero or below: escape enemy sensor range instead.':'';button.disabled ||= Boolean(why);if(why)button.title=why;}
      });
      const calls=(ship.commandSystems?.calls||[]).filter(c=>c.status!=='closed').map(c=>`<div class="command-call"><strong>${esc(c.title)}</strong><span>${esc(c.status)}</span>${c.disclosedPosition?`<small>Disclosed ${c.disclosedPosition.q}, ${c.disclosedPosition.r}</small>`:''}${(c.status==='incoming'?['accept','decline']:['endCall']).map(action=>`<button type="button" data-call-id="${esc(c.id)}" data-call-action="${action}">${({accept:'Accept',decline:'Decline',endCall:'End Call'})[action]}</button>`).join('')}</div>`).join('');
      if(calls!==lastCalls){panel.querySelector('[data-command-calls]').innerHTML=calls;lastCalls=calls;}
      panel.querySelectorAll('[data-call-action]').forEach(b=>b.disabled=busy);
      panel.querySelector('[data-command-preparations]').textContent=(ship.commandSystems?.armed?`Conditional order armed / ${Math.ceil(ship.commandSystems.armed.remaining)} sec | `:'')+(ship.commandSystems?.preparations||[]).map(p=>`${p.kind==='team'?'Team':'Calculation'}: ${actions[p.action]} / ${Math.ceil(p.remaining)} sec`).join(' | ');
      toggle.classList.toggle('incoming-hail',(ship.commandSystems?.calls||[]).some(c=>c.status==='incoming'));
      if((ship.commandSystems?.calls||[]).some(c=>c.status==='incoming'))toggle.textContent=panel.hidden?'Incoming Hail':'Navigation';
    }
    const groups=[...panel.querySelectorAll('.command-controls')],left=[...groups[0].children];
    const tabs=dialog.ownerDocument.createElement('div');tabs.className='command-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Command operations');
    const pages=dialog.ownerDocument.createElement('div');pages.className='command-pages';
    const sections=['Hail','Preparation','Maneuvers'].map((name,index)=>{
      const page=dialog.ownerDocument.createElement('div');page.className='command-section';page.dataset.section=name;page.setAttribute('role','tabpanel');page.hidden=index!==0;
      const tab=dialog.ownerDocument.createElement('button');tab.type='button';tab.textContent=name;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(index===0));
      tab.onclick=()=>{for(const p of pages.children)p.hidden=p!==page;for(const b of tabs.children)b.setAttribute('aria-selected',String(b===tab));};
      tabs.append(tab);pages.append(page);return page;
    });
    sections[0].append(...left.slice(0,3),panel.querySelector('[data-command-calls]'));
    sections[1].append(...left.slice(3),panel.querySelector('[data-command-preparations]'));
    const error=panel.querySelector('[data-command-error]');
    sections[2].append(...groups[1].children);error.remove();
    groups.forEach(group=>group.remove());panel.append(tabs,pages,error);
    redraw();return redraw;
  }
  window.SAShipCommandUI={mount,conditionalControls,conditionalPayload,refreshConditional};
}());
