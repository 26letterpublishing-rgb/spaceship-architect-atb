(function(){
  function unavailable(state,unit,access,label,selector){
    const ship=access?.ship;if(!ship)return 'Console unavailable.';
    const contacts=Object.values(ship.sensorState?.contacts||{}).filter(c=>c.level==='detected');
    if(['Move Ship','Evasive Maneuvers','Ram','Skim','Break Lock-On'].includes(label)&&!window.SAShipNavigation.access(state,unit))return 'Operational engines and thrusters required.';
    if(['Hail Ship','Ram','Skim','Systems Analysis','Lock-On','Lock Component'].includes(label)&&!contacts.length)return 'Detect a ship first.';
    if(label.startsWith('Fire ')&&!contacts.length)return 'Detect a target first.';
    if(label==='Preemptive Calculation'&&!((unit.mathematicsSkill??unit.mentalSkill)>=1))return 'Requires Mathematics 1 or higher.';
    if(label==='Break Lock-On')return !ship.incomingLocks?.length?'No incoming locks.':window.SAShipSensors.masking(state,ship)<=0?'Masking is zero or below: escape enemy sensor range instead.':'';
    if(selector==='[data-order="restabilize"]'&&ship.currentShieldHp>0)return 'Shields must be at zero to restabilize.';
    if(['Restore Shield HP','Reinforce Field'].includes(label)&&ship.currentShieldHp<=0)return 'Restabilize the downed shield first.';
    return '';
  }
  async function evade(unit){
    const b=window.SACombatBridge;if(!b.confirmGmPlayerAction(unit,'shipCommand'))return;
    try{await b.action({action:'shipCommand',id:unit.id,kind:'evade',requestId:crypto.randomUUID()},'resolve',{throwOnError:true});}
    catch(error){window.alert(error.message);}
  }
  function prepare(view,unit,selector,tab){
    // Reuse the console's live controls and validation without its decorative layout.
    window.SAConsoleCommon.mount(view,unit);
    const button=view.querySelector(selector),title=button?.textContent||'Ship Action';
    view.classList.add('combat-order-dialog');view.setAttribute('aria-label',title);
    const keep=new Set(),retain=node=>{if(!node)return;keep.add(node);node.querySelectorAll('*').forEach(n=>keep.add(n));for(let p=node.parentElement;p&&p!==view;p=p.parentElement)keep.add(p);};
    retain(button?.closest('.sensor-action-row,.command-action-row,.lock-action-row,.shield-order')||button);
    for(const s of ['header>div:first-child','[data-close]','[data-error]','[data-command-error]'])retain(view.querySelector(s));
    const action=button?.dataset.order||button?.dataset.command;
    if(view.classList.contains('weapon-console'))for(const s of ['[data-target]','[data-sacrifice]','[data-au]','[data-formula]','[data-warning]'])retain(view.querySelector(s)?.closest('label')||view.querySelector(s));
    if(view.classList.contains('sensor-console')){
      for(const s of ['[data-dice]','[data-destination]'])retain(view.querySelector(s));
      if(['hex','life'].includes(action))retain(view.querySelector('[data-map]'));
      if(action==='analysis')retain(view.querySelector('[data-target]')?.closest('label'));
      if(action==='share')retain(view.querySelector('.sensor-share-recipients'));
    }
    if(view.classList.contains('lock-console')){
      for(const s of selector==='[data-break]'?['[data-enemy]','[data-break-note]']:['[data-target]','[data-difficulty]',...(selector==='[data-sic]'?['[data-component]','[data-sic-note]']:[])])retain(view.querySelector(s)?.closest('label')||view.querySelector(s));
    }
    if(view.classList.contains('shield-console-dialog'))for(const s of ['[data-au]','[data-condition]','[data-field-state]',...(action==='restabilize'?['[data-rest-rule]']:['[data-amount]','[data-protection]'])])retain(view.querySelector(s)?.closest('label')||view.querySelector(s));
    if(tab){
      if(['ram','skim'].includes(action)){const target=view.querySelector('[data-command-target]')?.closest('label');if(target)button.closest('.command-section').prepend(target);}
      const fields=tab==='Hail'?['[data-command-target]','.command-coordinate']:tab==='Preparation'?['[data-prepared-action]']:action==='break'?['[data-break-target]']:['[data-command-target]'];
      for(const s of fields)retain(view.querySelector(s)?.closest('label')||view.querySelector(s));
    }
    for(const node of view.querySelectorAll('*'))if(!keep.has(node))node.dataset.orderHidden='';
    view.querySelector('header h2').textContent=title;
    view.querySelector('[data-close]').textContent='Cancel';
    button?.focus();
    if(['hex','life'].includes(action))button?.click();
  }
  window.SACombatOrderUI={prepare,evade,unavailable};
}());
