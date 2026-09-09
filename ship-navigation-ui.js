(function() {
  let activeDialog = null;
  const xy = p => ({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(unit) {
    const bridge=window.SACombatBridge, initial=bridge.state(), allowed=window.SAShipNavigation.access(initial,unit);
    if (!allowed || initial.activeId !== unit.id || activeDialog) return;
    const pilotId=unit.id, shipId=allowed.ship.id;
    let host=document;
    try {while(host.defaultView.frameElement)host=host.defaultView.parent.document;} catch {}
    if (!host.querySelector('[data-navigation-style]')) {
      const css=host.createElement('link');css.rel='stylesheet';css.href=new URL('ship-navigation-ui.css?v=20260910-cockpit-1',location.href).href;css.dataset.navigationStyle='';host.head.append(css);
    }
    const dialog=host.createElement('dialog'); activeDialog=dialog;
    dialog.className='ship-navigation-dialog';dialog.setAttribute('aria-label','Move Starship');
    dialog.innerHTML=`<form><header><div><h2>Move Starship</h2><strong>${escape(allowed.ship.title)}</strong></div><button type="button" data-cancel>Cancel</button></header><div data-navigation-map>${window.SASpaceMap.markup(initial.starships,initial.shipPositions,false,{navigation:true})}</div><div class="navigation-fields"><label>Hex Q<input name="q" type="number" min="-10000" max="10000" step="1" required></label><label>Hex R<input name="r" type="number" min="-10000" max="10000" step="1" required></label><button type="button" data-zoom=".7" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-zoom="1.4" title="Zoom out" aria-label="Zoom out">&#8722;</button></div><fieldset><legend>AU Boosts</legend>${allowed.thrusters.map(item=>{const d=window.SAShipMap.definition(item.type);return `<label><input type="checkbox" name="boost" value="${escape(item.id)}">${escape(d.name)} <span>+${d.auBoost} speed / ${d.auCost} AU</span></label>`;}).join('')}</fieldset><output data-estimate></output><p role="alert" data-error></p><footer><button type="submit">Confirm Move</button></footer></form>`;
    host.body.append(dialog);dialog.showModal();
    const form=dialog.querySelector('form'), svg=dialog.querySelector('svg'), q=form.elements.q, r=form.elements.r;
    const submit=form.querySelector('[type="submit"]'), error=form.querySelector('[data-error]'), estimate=form.querySelector('[data-estimate]');
    const originalBox=svg.getAttribute('viewBox');
    let destination=null, locked=false, submitting=false;
    const marker=host.createElementNS('http://www.w3.org/2000/svg','g');marker.setAttribute('data-route','');svg.append(marker);
    const points=()=>window.SAShipDistances.positions(bridge.state().starships,bridge.state().shipPositions);
    function redraw() {
      const state=bridge.state(), pilot=state.units.find(u=>u.id===pilotId), access=window.SAShipNavigation.access(state,pilot);
      const available=state.activeId===pilotId && access?.ship.id===shipId && !state.delayRequest;
      let cost=0,speed=access?.speed || 0;
      for (const box of form.querySelectorAll('[name="boost"]')) {
        const item=access?.thrusters.find(t=>t.id===box.value), def=item && window.SAShipMap.definition(item.type);
        box.disabled=submitting || !item;
        if (!item) box.checked=false;
        if (box.checked) {cost+=def.auCost;speed+=def.auBoost;}
      }
      const start=points().find(p=>p.id===shipId), length=destination && start ? window.SAShipDistances.hexDistance(start,destination) : 0;
      const au=access?.ship.auState?.current || 0;
      estimate.textContent=`Speed ${speed} Units / 12 sec | AU ${cost} / ${au}${destination ? ` | ${length.toFixed(1)} Units | ${speed ? (length*12/speed).toFixed(1) : '--'} sec` : ''}`;
      submit.disabled=submitting || !available || !start || !locked || !destination || !speed || length<1e-6 || cost>au;
      form.querySelector('[data-cancel]').disabled=submitting;
      if (!available && !submitting) error.textContent='This pilot no longer has an active cockpit turn.';
      // Keep the viewport and confirm control stable. Only moving ships and the route change.
      const currentPoints=points();
      [...svg.querySelectorAll('g[data-space-ship]')].forEach(g=>{const p=currentPoints.find(p=>p.id===g.dataset.spaceShip);if(p){const c=xy(p);g.setAttribute('transform',`translate(${c.x} ${c.y})`);}});
      if (destination && start) {
        const a=xy(start),b=xy(destination), width=svg.viewBox.baseVal.width, scale=width/180;
        marker.innerHTML=`<path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="${locked?'#6affb0':'#ffe27a'}" stroke-width="${scale}" fill="none"/><circle cx="${b.x}" cy="${b.y}" r="${scale*2}" fill="#07120e" stroke="#6affb0" stroke-width="${scale}"/>`;
      } else marker.replaceChildren();
    }
    const select=(event,lock)=>{
      if (submitting || (!lock && locked)) return;
      const p=new host.defaultView.DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const rawQ=Math.sqrt(3)/3*p.x-p.y/3, rawR=2*p.y/3;
      let x=Math.round(rawQ),z=Math.round(rawR),y=Math.round(-rawQ-rawR);
      const dx=Math.abs(x-rawQ),dz=Math.abs(z-rawR),dy=Math.abs(y+rawQ+rawR);
      if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;
      if(Math.abs(x)>10000||Math.abs(z)>10000)return;
      destination={q:x,r:z};locked=lock;q.value=x;r.value=z;error.textContent='';redraw();
    };
    svg.addEventListener('pointermove',e=>select(e,false));
    svg.addEventListener('click',e=>select(e,true));
    form.addEventListener('input',event=>{
      if ([q,r].includes(event.target)) {locked=true;destination=q.value!=='' && r.value!=='' && q.validity.valid && r.validity.valid ? {q:Number(q.value),r:Number(r.value)} : null;}
      error.textContent='';redraw();
    });
    for(const zoom of form.querySelectorAll('[data-zoom]'))zoom.onclick=()=>{
      const v=svg.viewBox.baseVal,f=Number(zoom.dataset.zoom),w=Math.max(8,Math.min(80000,v.width*f)),h=w*Number(originalBox.split(' ')[3])/Number(originalBox.split(' ')[2]);
      const x=v.x+(v.width-w)/2,y=v.y+(v.height-h)/2;
      svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);
      for(const rect of svg.querySelectorAll(':scope > rect'))for(const [key,value] of Object.entries({x,y,width:w,height:h}))rect.setAttribute(key,value);
      redraw();
    };
    form.onsubmit=async event=>{
      event.preventDefault();redraw();if(submit.disabled)return;
      submitting=true;submit.textContent='Submitting...';redraw();
      try {
        await bridge.action({action:'playerCombatAction',id:pilotId,kind:'moveStarship',destination:{...destination},boostIds:[...form.querySelectorAll('[name="boost"]:checked')].map(b=>b.value)},'resolve',{throwOnError:true});
        dialog.close();
      } catch(err) {error.textContent=err.message;}
      finally {submitting=false;submit.textContent='Confirm Move';if(dialog.isConnected)redraw();}
    };
    form.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.addEventListener('cancel',event=>{if(submitting)event.preventDefault();});
    const timer=setInterval(redraw,200);
    const cleanup=()=>{clearInterval(timer);window.removeEventListener('pagehide',cleanup);dialog.remove();activeDialog=null;};
    dialog.addEventListener('close',cleanup,{once:true});window.addEventListener('pagehide',cleanup,{once:true});redraw();
  }
  window.SAShipNavigationUI={open};
}());
