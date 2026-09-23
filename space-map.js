(function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const colors = ["#54d7f5","#f5858d","#b997ff","#64dfa1","#ffd275","#f89dd9"];
  const enlarged = new Set();
  const xy = p => ({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const shipMarkerRadius = ship => Math.max(.55,[0,.55,1.05,1.6,2.2,3.2][window.SAShipMap.scaleRank(ship)]*.58);
  function vesselMarkup(ship){
    if(ship.uncertainty)return '<circle data-vessel-body r=".35" fill="currentColor" stroke="#fff" stroke-width=".04"/>';
    const maps=window.SAShipMap,rank=maps.scaleRank(ship),size=[0,.55,1.05,1.6,2.2,3.2][rank],powered=ship.navigation?.phase==='powered'||ship.mapPowered;
    return `<g data-vessel-body data-rank="${rank}" transform="rotate(${maps.shipHeading(ship)})" style="--vessel-glow:${maps.shipColor(ship)}"><g class="starship-map-art ${powered?'is-powered':''}"><path class="starship-map-exhaust" d="M${-.08*size} ${.35*size} Q${-.12*size} ${.65*size} 0 ${.88*size} Q${.12*size} ${.65*size} ${.08*size} ${.35*size}Z" fill="#70dfff"/><image href="sic-art-starship-rank-${rank}.webp" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}"/><circle class="starship-running-light" cx="${-.13*size}" cy="${.2*size}" r="${.018*size}" fill="#ff7777"/><circle class="starship-running-light light-two" cx="${.13*size}" cy="${.2*size}" r="${.018*size}" fill="#b6ffd4"/></g></g>`;
  }
  function missileMarkup(ship,p,c,size,locked){
    const phase=ship.missilePhase,ended=['destroyed','exploded','expired'].includes(phase),age=Math.max(0,(Date.now()-(ship.missileEndedAt||Date.now()))/1000);
    if(ended&&age>=2)return '';
    // Keep salvo lanes stable when individual missiles turn or are deflected.
    const spread=ship.missileSalvoSize>1,offset=spread?(ship.missileSlot+1)*size*1.2:0;
    const radius=size*(.5+Math.min(2,age)*1.4),body=ended?`<g data-missile-explosion style="animation:missile-impact-fade 2s linear forwards" opacity="${Math.max(0,1-age/2)}"><circle r="${radius}" fill="#ffcc7055" stroke="#ffda84" stroke-width="${size*.12}"/>${Array.from({length:8},(_,n)=>`<path transform="rotate(${n*45})" d="M${radius*.4} 0h${radius*.6}" stroke="#fff0b8" stroke-width="${size*.1}"/>`).join('')}</g>`:`<g data-missile-heading transform="rotate(${Number(ship.missileHeading)||0})"><path class="missile-exhaust" d="M${-size*.6} 0L${-size*1.7} ${-size*.22}L${-size*1.35} 0L${-size*1.7} ${size*.22}Z" fill="#ff963e"/><path d="M${size*.9} 0L${size*.3} ${-size*.23}H${-size*.6}V${size*.23}H${size*.3}Z" fill="#f1ead5" stroke="#241a0b" stroke-width="${size*.07}"/><path d="M${-size*.2} ${-size*.2}L${-size*.7} ${-size*.5}V${size*.5}L${-size*.2} ${size*.2}" fill="#ffb454"/></g>`;
    return `<g data-space-ship="${escape(ship.id)}" data-space-missile="${escape(ship.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(ship.title)} / Defense ${ship.defenseScore} / Speed ${ship.missileSpeed} / ${phase}</title><g transform="translate(0 ${offset})">${body}${locked&&!ended?`<circle data-lock-reticle r="${size*.95}" fill="none" stroke="#ffe277" stroke-width="${size*.08}" stroke-dasharray="${size*.7} ${size*.35}"/>`:''}${ended?'':`<text x="${spread?size*1.6:0}" y="${size*(spread?.15:1.3)}" text-anchor="middle" font-size="${size*(spread?.65:.8)}" fill="#ffce83" stroke="#070e14" stroke-width="${size*.15}" paint-order="stroke">${spread?'#'+(ship.missileSlot+1):escape(ship.title)}</text>`}</g></g>`;
  }
  function wreckMarkup(size){return `<g data-debris>${Array.from({length:18},(_,n)=>`<rect x="${Math.sin(n*13.37)*size*.8}" y="${Math.cos(n*4.91)*size*.55}" width="${size*.12}" height="${size*.12}" fill="currentColor"/>`).join('')}</g>`;}
  function contactHalo(ship,point) {
    if (!ship.uncertainty) return '';
    const radius=Number(ship.uncertainty)*Math.sqrt(3);
    return `<circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="#d6ac4914" stroke="#e9c777" stroke-width=".08" stroke-dasharray=".3 .3"><title>Unresolved contact within ${Number(ship.uncertainty)} Units</title></circle>`;
  }
  function sensorRange(svg,position,range) {
    let ring=svg.querySelector('[data-sensor-range]');
    if(!range||!position){ring?.remove();return;}
    if(!ring){ring=svg.ownerDocument.createElementNS(svg.namespaceURI,'circle');ring.dataset.sensorRange='';ring.style.pointerEvents='none';ring.setAttribute('fill','#80cde908');ring.setAttribute('stroke','#88cde970');ring.setAttribute('stroke-width','.06');svg.append(ring);}
    const p=xy(position);ring.setAttribute('cx',p.x);ring.setAttribute('cy',p.y);ring.setAttribute('r',range*Math.sqrt(3));
  }
  function conditionMarkup(ship,size,observer) {
    if(ship.destroyedAt||ship.uncertainty||!(ship.analyzedContact||observer?.id===ship.id||observer?.sensorState?.analyses?.[ship.id]))return '';
    const maxShield=Number(ship.maximumShieldHp??ship.ship?.maximumShieldHp)||0,shield=maxShield>0;
    const maximum=shield?maxShield:Number(ship.maximumHullHp??ship.ship?.maximumHullHp??ship.ship?.gridCells?.length)||0;
    const current=shield?ship.currentShieldHp:ship.currentHullHp;
    const scale=size*.035;
    return `<g data-map-condition transform="translate(0 ${-size*2}) scale(${scale})"><foreignObject x="-28" y="-9" width="56" height="20"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center">${window.SAHealthDisplay.track(shield?'shield':'hull',current,maximum)}</div></foreignObject></g>`;
  }

  function markup(ships,saved,editable=false,options={}) {
    const objects=options.spaceObjects||(!editable&&window.SACombatBridge?.state?.()?.spaceObjects)||[];
    const additions=objects.filter(o=>!o.collectedBy&&!ships.some(s=>s.id===o.id));
    ships=[...ships,...additions.map(o=>({id:o.id,title:o.name,spaceObject:o,ship:{}}))];saved=[...(saved||[]),...additions];
    const utilityShips=ships;
    ships=ships.filter(ship=>!ship.escapedAt&&ship.ship?.warpState?.phase!=='traveling');
    const points = window.SAShipDistances.positions(ships,saved), cart = points.map(xy);
    const routes = points.flatMap((p,i)=>{
      const nav=ships[i].navigation;
      if (!nav || !['powered','drift'].includes(nav.phase)) return [];
      const target=nav.phase==='powered' ? nav.target : {q:p.q+nav.direction.q*nav.speed,r:p.r+nav.direction.r*nav.speed};
      return [{id:p.id,a:xy(p),b:xy(target),color:colors[i],drift:nav.phase==='drift'}];
    });
    const bounds=[...cart,...(options.fitBounds||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))];
    for(const ship of utilityShips)for(const pod of ship.ship?.fieldState?.pods||[])if(!pod.recovered)bounds.push(xy(pod));
    ships.forEach((ship,index)=>{if(ship.spaceObject?.kind==='planet'){const c=cart[index];bounds.push({x:c.x-3,y:c.y-3},{x:c.x+3,y:c.y+3});}});
    const xs=bounds.length?bounds.map(p=>p.x):[0], ys=bounds.length?bounds.map(p=>p.y):[0];
    const spanX=Math.max(...xs)-Math.min(...xs), spanY=Math.max(...ys)-Math.min(...ys);
    const width=Math.max(18,spanX*1.45+8,(spanY+8)*3.4),height=width/3.4;
    const minX=(Math.min(...xs)+Math.max(...xs)-width)/2, minY=(Math.min(...ys)+Math.max(...ys)-height)/2;
    const size=.65,locked=new Set(ships.flatMap(s=>(s.lockState?.targets||[]).map(l=>l.targetId)));
    const patternId = `space-hex-${options.navigation?'navigation':editable?'editor':'view'}`;
    return `<section class="space-map"><header>${!editable&&window.SACombatBridge?.mode?.()==='gm'?'<button type="button" data-ship-glows aria-label="Ship glow colors" title="Ship glow colors">&#9881;</button>':''}${!editable && !options.navigation ? '<button type="button" data-space-enlarge aria-label="Enlarge space map" title="Enlarge space map">&#x2922;</button>' : ''}</header><svg data-space-canvas viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Starship positions on a hex map"><defs><pattern id="${patternId}" width="${Math.sqrt(3)}" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1 L.866 -.5 V.5 L0 1 L-.866 .5 V-.5 Z M.866 .5 L1.732 1 V2 L.866 2.5 L0 2 V1 Z M0 2 L.866 2.5 V3.5 L0 4 L-.866 3.5 V2.5 Z" fill="none" stroke="#689099" stroke-width=".035"/></pattern></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#070e14"/><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#${patternId})"/>${routes.map(route=>`<path data-navigation-route="${escape(route.id)}" d="M${route.a.x} ${route.a.y} L${route.b.x} ${route.b.y}" fill="none" stroke="${route.color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-dasharray="${route.drift?'6 5':'none'}" opacity=".7"/>`).join('')}${probeRoutes(ships)}${fieldMarkup(utilityShips,saved,size)}${points.map((p,i)=>({p,i})).sort((a,b)=>Number(!ships[a.i].spaceObject)-Number(!ships[b.i].spaceObject)).map(({p,i})=>{const c=cart[i];if(ships[i].spaceObject){const o=ships[i].spaceObject;if(o.kind==='planet')return planetMarkup(o,c);return `<g data-space-ship="${escape(p.id)}" data-space-object="${escape(p.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(o.name)} / ${o.quantity}</title>${['mineral','asteroid'].includes(o.kind)?`<image href="map-${o.kind}.webp" x="${-size*.85}" y="${-size*.85}" width="${size*1.7}" height="${size*1.7}"/>`:`<path d="M-.7 -.6H.7V.6H-.7Z" transform="scale(${size*.65})" fill="#dfa969" stroke="#fff" stroke-width=".08"/>`}<text y="${size*1.4}" text-anchor="middle" font-size="${size*.85}" fill="#e7efef" stroke="#070e14" stroke-width="${size*.12}" paint-order="stroke">${escape(o.name)}</text></g>`;}if(ships[i].isProbe)return `<g data-space-ship="${escape(p.id)}" data-space-probe="${escape(p.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(ships[i].title)} / Defense ${escape(ships[i].defenseScore)}</title>${ships[i].probeInhibitor?'<circle data-probe-inhibitor r="3.464101615" fill="#b687ee" fill-opacity=".1" stroke="#b687ee" stroke-width=".07" stroke-dasharray=".2 .15"/>':''}<image href="sic-art-probe-${Number(ships[i].probeTier)||1}.webp" x="${-size*.65}" y="${-size*.65}" width="${size*1.3}" height="${size*1.3}"/><text y="${size*1.4}" text-anchor="middle" fill="#9be5ed" font-size="${size*.85}">${escape(ships[i].title)}</text>${locked.has(p.id)?`<circle r="${size*.8}" fill="none" stroke="#ffe277" stroke-width="${size*.08}"/>`:''}</g>`;if(ships[i].isDrone)return `<g data-space-ship="${escape(p.id)}" data-space-drone="${escape(p.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(ships[i].title)} / Defense ${escape(ships[i].defenseScore)}</title><g transform="translate(${size*1.6} ${size*.8})"><image href="${escape(ships[i].droneSprite||'repair-drone-1-sprite.webp')}" x="${-size*.6}" y="${-size*.6}" width="${size*1.2}" height="${size*1.2}"/>${locked.has(p.id)?`<circle r="${size*.8}" fill="none" stroke="#ffe277" stroke-width="${size*.08}"/>`:""}</g></g>`;if(ships[i].isMissile)return missileMarkup(ships[i],p,c,size,locked.has(p.id));const overlap=points.slice(0,i).filter(o=>o.q===p.q&&o.r===p.r).length;return `${contactHalo(ships[i],c)}<g data-space-ship="${escape(p.id)}" transform="translate(${c.x} ${c.y})" class="${ships[i].destroyedAt?'ship-wreck':''}" style="color:${window.SAShipMap.shipColor(ships[i])}"><title>${escape(ships[i].title || ships[i].ship?.title)}: ${ships[i].uncertainty ? "approximate sector" : `${Number(p.q.toFixed(2))}, ${Number(p.r.toFixed(2))}`}</title><circle data-ship-hit r="${Math.max(.75,shipMarkerRadius(ships[i]))}" fill="transparent" stroke="none" pointer-events="all"/>${!ships[i].destroyedAt&&!ships[i].uncertainty&&(ships[i].currentShieldHp>0||ships[i].shieldCondition>0)?`<circle data-shield-ring r="${shipMarkerRadius(ships[i])}" fill="none" stroke="#65ef91" stroke-width=".09" style="animation:shield-map-pulse 1.6s ease-in-out infinite;pointer-events:none"/>`:''}${ships[i].destroyedAt?wreckMarkup(size):vesselMarkup(ships[i])}${conditionMarkup(ships[i],size,options.observer)}${locked.has(p.id)?`<circle data-lock-reticle r="${size*.95}" fill="none" stroke="#ffe277" stroke-width="${size*.08}" stroke-dasharray="${size*.7} ${size*.35}"/>`:''}<text y="${size*(overlap%2 ? 1 : -1)*(1.2+Math.ceil(overlap/2)*.85)}" text-anchor="${ships.filter(s=>!s.isMissile).length===2 ? (i===0 ? `end` : `start`) : c.x<minX+width*.25 ? `start` : c.x>minX+width*.75 ? `end` : `middle`}" font-size="${size*1.15}" fill="currentColor" stroke="#070e14" stroke-width="${size*.18}" paint-order="stroke">${escape(ships[i].title || ships[i].ship?.title || 'Starship')}</text></g>`;}).join('')}</svg>${editable?`<div class="space-map-coordinates">${points.map((p,i)=>`<label><strong style="color:${window.SAShipMap.shipColor(ships[i])}">${escape(ships[i].title || ships[i].ship?.title)}</strong><input type="radio" name="space-placement-ship" value="${escape(p.id)}" ${i===0?'checked':''} aria-label="Place ${escape(ships[i].title)}"><span>Q</span><input type="number" step="1" min="-10000" max="10000" value="${p.q}" data-space-id="${escape(p.id)}" data-space-axis="q" aria-label="${escape(ships[i].title)} hex Q"><span>R</span><input type="number" step="1" min="-10000" max="10000" value="${p.r}" data-space-id="${escape(p.id)}" data-space-axis="r" aria-label="${escape(ships[i].title)} hex R"></label>`).join('')}</div>`:''}</section>`;
  }
  function probeRoutes(ships){
    // Only owner/GM projections contain probeState; enemy flight destinations stay private.
    return ships.flatMap(ship=>Object.values(ship.ship?.probeState?.probes||{})).filter(p=>p.destination&&['flying','returning','recovering','approaching'].includes(p.phase)).map(p=>{
      const a=xy(p.position),b=xy(p.destination);
      return `<path data-probe-route="${escape(p.id)}" d="M${a.x} ${a.y} L${b.x} ${b.y}" fill="none" stroke="#efc977" stroke-width=".12" stroke-dasharray=".3 .2" opacity=".85" style="pointer-events:none"/>`;
    }).join('');
  }
  function fieldMarkup(ships,saved,size){
    const points=window.SAShipDistances.positions(ships,saved);let result='';
    for(const ship of ships){
      const p=points.find(p=>p.id===ship.id),a=xy(p);
      for(const system of Object.values(ship.ship?.fieldState?.systems||{}))if(system.tether){const target=points.find(p=>p.id===system.tether.targetId);if(target){const b=xy(target);result+=`<path data-tractor-tether d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#9be5c4" stroke-width="${size*.18}" stroke-dasharray="${size*.4} ${size*.2}" opacity=".75"><title>Tractor hold</title></path>`;}}
      for(const pod of ship.ship?.fieldState?.pods||[])if(!pod.recovered){const c=xy(pod),launching=Date.now()-pod.at<1800;result+=`<g data-space-pod="${escape(pod.id)}" transform="translate(${c.x} ${c.y})"><title>Escape Pod / Distress Beacon</title><g class="${launching?'escape-pod-launch':''}"><rect x="${size*.8}" y="${-size*.25}" width="${size*.7}" height="${size*.5}" rx="${size*.2}" fill="#eadcc1" stroke="#d2944f" stroke-width="${size*.09}"/><text x="${size*1.7}" y="${size*.2}" font-size="${size*.65}" fill="#ffd992">POD</text></g></g>`;}
      if(Date.now()-(ship.ship?.missileState?.flarePulse?.at||0)<1500)result+=`<g data-flare-burst transform="translate(${a.x} ${a.y})" fill="#fff0b5">${[-1,0,1].map(n=>`<circle cx="${size*1.5}" cy="${size*n*.8}" r="${size*.22}"/>`).join('')}</g>`;
    }
    return result;
  }
  function bindEditor(container,ships,saved,onChange) {
    const signature = JSON.stringify([ships.map(ship=>[ship.id,ship.title]),saved]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    const shipIds=JSON.stringify(ships.map(ship=>ship.id));
    const previousBox=container.dataset.editorShipIds===shipIds||container.dataset.manualZoom==='true'
      ? container.querySelector('[data-space-canvas]')?.getAttribute('viewBox') : null;
    container.dataset.editorShipIds=shipIds;
    container.innerHTML=markup(ships,saved,true);
    container.dataset.mapEditor='';
    const header=container.querySelector('header');header.innerHTML='<button type="button" data-prep-zoom=".7" aria-label="Zoom in preparation map">+</button><button type="button" data-prep-zoom="1.4" aria-label="Zoom out preparation map">-</button><button type="button" data-prep-fit>Fit Contacts</button><button type="button" data-prep-enlarge data-map-focus>Enlarge Map</button><small>Inner: base sensor range (auto-identify Masking 1-10). Outer: extended range for Masking 0 or less.</small>';
    function decorate(box){const svg=container.querySelector('svg');if(box)svg.setAttribute('viewBox',box);const v=svg.viewBox.baseVal;for(const rect of svg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,v[key]);
      for(const o of window.SACombatBridge?.state?.()?.spaceObjects||[]){const marker=svg.querySelector(`[data-planet="${CSS.escape(o.id)}"]`);if(marker){const image=marker.querySelector('image'),file=o.destroyedAt?'planet-debris.webp':'planet-'+o.variant+'.webp';if(image?.getAttribute('href')!==file)image?.setAttribute('href',file);const text=marker.querySelector('text'),label=o.name+(o.destroyedAt?' / Destroyed':'');if(text&&text.textContent!==label)text.textContent=label;}}
      for(const ship of ships){
        if(ship.spaceObject)continue;const group=svg.querySelector(`[data-space-ship="${CSS.escape(ship.id)}"]`),range=window.SAShipMap.sensorStats(ship).range;if(!group||!range)continue;for(const scale of [2,1]){const ring=document.createElementNS(svg.namespaceURI,'circle');ring.setAttribute('r',range*Math.sqrt(3)*scale);ring.setAttribute('fill',scale===2?'#80cde90c':'#80cde91e');ring.setAttribute('stroke',scale===2?'#88cde947':'#88cde980');ring.setAttribute('stroke-width','.06');ring.style.pointerEvents='none';group.prepend(ring);}}
    }
    const expand=container.querySelector('[data-prep-enlarge]');expand.textContent=container.classList.contains('map-focus')?'Return to Setup':'Enlarge Map';expand.setAttribute('aria-pressed',String(container.classList.contains('map-focus')));expand.onclick=event=>{event.stopPropagation();focusMap(container,expand);};
    decorate(previousBox);
    if(!previousBox)requestAnimationFrame(()=>fitRendered(container.querySelector('svg')));
    let points=window.SAShipDistances.positions(ships,saved);
    const redraw=()=> { const box=container.querySelector('svg').getAttribute('viewBox');container.dataset.signature=JSON.stringify([ships.map(ship=>[ship.id,ship.title]),points]);onChange(points); const template=document.createElement('template');template.innerHTML=markup(ships,points,true);container.querySelector('svg').replaceWith(template.content.querySelector('svg'));decorate(box);for(const input of container.querySelectorAll('[data-space-axis]'))if(input!==document.activeElement)input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis]; };
    const edit=event=> {const input=event.target;if(!input.dataset.spaceAxis)return;const value=Number(input.value);if(!input.value.trim()||!Number.isInteger(value)||Math.abs(value)>10000){if(event.type==='change')input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis];return;}points=points.map(p=>p.id===input.dataset.spaceId?{...p,[input.dataset.spaceAxis]:value}:p);redraw();};
    container.oninput=edit;container.onchange=edit;
    let dragging=null;
    const hex=event=>{const svg=container.querySelector('svg'),p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()),q=Math.sqrt(3)/3*p.x-p.y/3,r=2*p.y/3;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dz=Math.abs(z-r),dy=Math.abs(y+q+r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;return {q:Math.max(-10000,Math.min(10000,x)),r:Math.max(-10000,Math.min(10000,z))};};
    container.onpointerdown=event=>{const marker=event.target.closest('[data-space-ship]');if(!marker)return;dragging=marker.dataset.spaceShip;container.setPointerCapture(event.pointerId);event.preventDefault();};
    container.onpointermove=event=>{if(!dragging)return;const p=xy(hex(event));container.querySelector(`[data-space-ship="${CSS.escape(dragging)}"]`).setAttribute('transform',`translate(${p.x} ${p.y})`);};
    container.onpointerup=event=>{if(!dragging)return;const destination=hex(event);points=points.map(p=>p.id===dragging?{...p,...destination}:p);dragging=null;container.releasePointerCapture(event.pointerId);redraw();};
    container.onpointercancel=()=>{dragging=null;redraw();};
    container.onclick=event=>{const zoom=event.target.closest('[data-prep-zoom]'),fit=event.target.closest('[data-prep-fit]');if(!zoom&&!fit)return;container.dataset.manualZoom=String(!fit);const svg=container.querySelector('svg');if(fit){fitRendered(svg);}else{const v=svg.viewBox.baseVal,f=Number(zoom.dataset.prepZoom),width=Math.max(1,Math.min(100000,v.width*f)),height=width*v.height/v.width;svg.setAttribute('viewBox',`${v.x+(v.width-width)/2} ${v.y+(v.height-height)/2} ${width} ${height}`);}for(const rect of svg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,svg.viewBox.baseVal[key]);};
  }
  function openGlowPicker(doc=document){
    if(window.SACombatBridge?.mode()!=='gm')return;
    const dialog=doc.createElement('dialog');dialog.className='ship-glow-picker';dialog.innerHTML='<h2>Ship Glow Colors</h2>'+window.SACombatBridge.state().starships.filter(s=>!s.isDrone&&!s.isProbe&&!s.isMissile).map(s=>`<label>${escape(s.title)} <input type="color" data-glow-id="${escape(s.id)}" value="${window.SAShipMap.shipColor(s)}"></label>`).join('')+'<p role="status"></p><button>Close</button>';
    dialog.onchange=async e=>{const input=e.target.closest('[data-glow-id]');if(!input)return;try{await window.SACombatBridge.setShipColor(input.dataset.glowId,input.value);dialog.querySelector('p').textContent='Color saved.';}catch(err){dialog.querySelector('p').textContent=err.message;}};dialog.querySelector('button').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();doc.body.append(dialog);dialog.showModal();
  }
  document.addEventListener('click',event=>{if(event.target.closest('[data-ship-glows]'))openGlowPicker();});
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-space-enlarge]');
    if(button)enlarge(button.closest('.space-map'),button);
  });
  function zoom(svg,factor){
    if(!svg)return;
    const v=svg.viewBox.baseVal,width=Math.max(1,Math.min(100000,v.width*factor)),height=width*v.height/v.width;
    svg.setAttribute('viewBox',`${v.x+(v.width-width)/2} ${v.y+(v.height-height)/2} ${width} ${height}`);coverViewport(svg);
  }
  function fitRendered(svg){
    const markers=[...svg.querySelectorAll('[data-space-ship]')],points=markers.map(m=>{
      const p=m.transform.baseVal.consolidate()?.matrix;return p?{x:p.e,y:p.f,pad:m.hasAttribute('data-planet')?3:1.5}:null;
    }).filter(Boolean);if(!points.length)return;
    const ratio=(svg.clientWidth||600)/(svg.clientHeight||250),left=Math.min(...points.map(p=>p.x-p.pad)),right=Math.max(...points.map(p=>p.x+p.pad)),top=Math.min(...points.map(p=>p.y-p.pad)),bottom=Math.max(...points.map(p=>p.y+p.pad));
    const width=Math.max(12,right-left+4,(bottom-top+4)*ratio),height=width/ratio;
    svg.setAttribute('viewBox',`${(left+right-width)/2} ${(top+bottom-height)/2} ${width} ${height}`);coverViewport(svg);
  }
  function ensureMapStyles(doc){
    if(doc.querySelector('link[data-space-map-style]'))return;
    const link=doc.createElement('link');link.rel='stylesheet';link.href=new URL('space-map.css?v=20260922-usability',location.href).href;link.dataset.spaceMapStyle='';doc.head.append(link);
  }
  const focusHandlers=new WeakMap();
  function focusMap(view,button){
    ensureMapStyles(view.ownerDocument);
    const focused=view.classList.toggle('map-focus');
    button.dataset.mapFocus='';button.textContent=focused?(view.dataset.mapEditor!==undefined?'Return to Setup':'Return to Console'):'Enlarge Map';button.setAttribute('aria-pressed',String(focused));
    if(!focusHandlers.has(view)){
      const restore=event=>{if(view.classList.contains('map-focus')&&(event.type==='cancel'||event.key==='Escape')){event.preventDefault();event.stopImmediatePropagation();focusMap(view,view.querySelector('[data-map-focus]')||button);}};
      view.addEventListener('cancel',restore,true);view.addEventListener('keydown',restore,true);focusHandlers.set(view,restore);
    }
    view.dispatchEvent(new view.ownerDocument.defaultView.CustomEvent('mapfocuschange',{detail:{focused}}));
    requestAnimationFrame(()=>{for(const svg of view.querySelectorAll('[data-space-canvas]'))coverViewport(svg);button.focus();});
    return focused;
  }
  function enlarge(source,button){
    if(!source)return;
    const interactive=source.closest('dialog')?.querySelector('[data-map-focus]');if(interactive){focusMap(interactive.closest('dialog'),interactive);return;}
    // Campaign combat is embedded; put the enlarged view in the visible app viewport.
    let host=document;
    try { while(host.defaultView.frameElement)host=host.defaultView.parent.document; } catch {}
    if(!host.querySelector('link[data-space-map-style]')) {
      const style=host.createElement('link');style.rel='stylesheet';style.href=new URL('space-map.css?v=20260922-map-controls',location.href).href;style.dataset.spaceMapStyle='';host.head.append(style);
    }
    const dialog=host.createElement('dialog');
    dialog.className='space-map-dialog';dialog.setAttribute('aria-label','Space map');
    dialog.innerHTML=source.outerHTML;
    dialog.querySelector('[data-space-enlarge]')?.remove();
    const glow=dialog.querySelector('[data-ship-glows]');if(glow)glow.onclick=e=>{e.stopPropagation();openGlowPicker(host);};
    const controls=host.createElement('nav');controls.className='space-map-dialog-controls';controls.setAttribute('aria-label','Map controls');
    controls.innerHTML='<button type="button" data-map-zoom=".7" aria-label="Zoom in enlarged map">+</button><button type="button" data-map-zoom="1.4" aria-label="Zoom out enlarged map">−</button><button type="button" data-map-fit>Fit Contacts</button><button type="button" data-map-close>Close</button>';
    controls.onclick=event=>{const target=event.target.closest('button');if(!target)return;const svg=dialog.querySelector('svg');if(target.hasAttribute('data-map-close'))dialog.close();else if(target.hasAttribute('data-map-fit')){delete dialog.dataset.manualZoom;fitRendered(svg);}else{dialog.dataset.manualZoom='true';zoom(svg,Number(target.dataset.mapZoom));}};
    dialog.append(controls);enlarged.add(dialog);
    const cleanup=()=>{window.removeEventListener('pagehide',cleanup);enlarged.delete(dialog);dialog.remove();};
    dialog.addEventListener('close',()=>{cleanup();if(button?.isConnected)button.focus();},{once:true});window.addEventListener('pagehide',cleanup,{once:true});host.body.append(dialog);dialog.showModal();watchMaps(dialog);fitRendered(dialog.querySelector('svg'));
  }
  let highlightedObject=null;
  function highlightObjects(root){
    for(const marker of root.querySelectorAll('[data-space-object]')){
      const active=marker.dataset.spaceObject===highlightedObject,old=marker.querySelector('[data-report-highlight]');
      if(!active){old?.remove();continue;}if(old)continue;
      const ring=marker.ownerDocument.createElementNS('http://www.w3.org/2000/svg','circle');ring.dataset.reportHighlight='';
      ring.setAttribute('r',marker.hasAttribute('data-planet')?'3.2':'1');ring.setAttribute('fill','#ffe28222');ring.setAttribute('stroke','#ffe282');ring.setAttribute('stroke-width','3');ring.setAttribute('vector-effect','non-scaling-stroke');ring.style.pointerEvents='none';marker.append(ring);
    }
  }
  function highlightObject(id){
    highlightedObject=id;
    let root=document;try{while(root.defaultView.frameElement)root=root.defaultView.parent.document;}catch{}
    for(const doc of new Set([document,root]))highlightObjects(doc);
  }
  function bindReportHighlight(doc){
    for(const [enter,leave] of [['pointerover','pointerout'],['focusin','focusout']]){
      doc.addEventListener(enter,event=>{const ref=event.target.closest?.('[data-log-space-object]');if(ref)highlightObject(ref.dataset.logSpaceObject);});
      doc.addEventListener(leave,event=>{const ref=event.target.closest?.('[data-log-space-object]');if(ref&&!ref.contains(event.relatedTarget))highlightObject(null);});
    }
  }
  bindReportHighlight(document);
  try{let root=document;while(root.defaultView.frameElement)root=root.defaultView.parent.document;if(root!==document)bindReportHighlight(root);}catch{}
  function presentKnowledge(root,ships,observer) {
    for(const ship of ships){
      if(ship.isMissile)continue;
      const unknown=Boolean(observer&&ship.id!==observer.id&&observer.sensorState?.contacts?.[ship.id]?.level!=='detected');
      for(const marker of root.querySelectorAll(`[data-space-ship="${CSS.escape(ship.id)}"]`)){
        marker.classList.toggle('gm-unknown-marker',unknown);
        const label=marker.querySelector('text');if(label)label.textContent=(ship.title||ship.ship?.title||'Starship').split(' — ')[0]+(unknown?' (unknown)':'');
      }
    }
  }
  function refresh(ships,positions,observer) {
    let root=document;try{while(root.defaultView.frameElement)root=root.defaultView.parent.document;}catch{}
    for(const doc of new Set([document,root]))for(const svg of doc.querySelectorAll('[data-space-canvas]')){
      for(const path of svg.querySelectorAll('[data-navigation-route],[data-probe-route]'))path.remove();
      svg.insertAdjacentHTML('beforeend',probeRoutes(ships));
      for(const ship of ships){
        const marker=svg.querySelector(`[data-space-ship="${CSS.escape(ship.id)}"]`);if(!marker||ship.isMissile||ship.isDrone||ship.isProbe)continue;
        marker.style.color=window.SAShipMap.shipColor(ship);
        const body=marker.querySelector('[data-vessel-body]'),rank=window.SAShipMap.scaleRank(ship);
        if(ship.destroyedAt)body?.remove();else if(!body||ship.uncertainty||Number(body.dataset.rank)!==rank){body?.remove();marker.insertAdjacentHTML('afterbegin',vesselMarkup(ship));}else{body.setAttribute('transform',`rotate(${window.SAShipMap.shipHeading(ship)})`);body.style.setProperty('--vessel-glow',window.SAShipMap.shipColor(ship));body.querySelector('.starship-map-art')?.classList.toggle('is-powered',ship.navigation?.phase==='powered'||ship.mapPowered===true);}
        marker.querySelector('[data-map-condition]')?.remove();
        const size=.65;
        marker.insertAdjacentHTML('beforeend',conditionMarkup(ship,size,observer));
        let hit=marker.querySelector('[data-ship-hit]');
        if(!hit){hit=doc.createElementNS('http://www.w3.org/2000/svg','circle');hit.dataset.shipHit='';hit.setAttribute('fill','transparent');hit.setAttribute('stroke','none');hit.setAttribute('pointer-events','all');marker.prepend(hit);}
        hit.setAttribute('r',Math.max(.75,shipMarkerRadius(ship)));
        let ring=marker.querySelector('[data-shield-ring]');
        const shielded=!ship.destroyedAt&&!ship.uncertainty&&(ship.currentShieldHp>0||ship.shieldCondition>0);
        if(shielded&&!ring){ring=doc.createElementNS('http://www.w3.org/2000/svg','circle');ring.dataset.shieldRing='';ring.setAttribute('fill','none');ring.setAttribute('stroke','#65ef91');ring.setAttribute('stroke-width','.09');ring.style.cssText='animation:shield-map-pulse 1.6s ease-in-out infinite;pointer-events:none';marker.prepend(ring);}else if(!shielded)ring?.remove();
        if(shielded)ring.setAttribute('r',shipMarkerRadius(ship));
        const nav=ship.navigation,p=window.SAShipDistances.positions(ships,positions).find(p=>p.id===ship.id);
        if(!p||!nav||!['powered','drift'].includes(nav.phase))continue;
        const target=nav.phase==='powered'?nav.target:{q:p.q+nav.direction.q*nav.speed,r:p.r+nav.direction.r*nav.speed};if(!target)continue;
        const a=xy(p),b=xy(target),path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.dataset.navigationRoute=ship.id;path.setAttribute('d',`M${a.x} ${a.y} L${b.x} ${b.y}`);path.setAttribute('fill','none');path.setAttribute('stroke',marker.style.color||'#6ed1dd');path.setAttribute('stroke-width','2.5');path.setAttribute('vector-effect','non-scaling-stroke');path.setAttribute('opacity','.7');if(nav.phase==='drift')path.setAttribute('stroke-dasharray','6 5');svg.insertBefore(path,marker);
      }
    }
    for(const doc of new Set([document,root])){for(const svg of doc.querySelectorAll('[data-space-canvas]'))coverViewport(svg);highlightObjects(doc);}
    for(const dialog of enlarged) {
      const template=dialog.ownerDocument.createElement('template');template.innerHTML=markup(ships,positions);
      const current=dialog.querySelector('svg'),next=template.content.querySelector('svg');
      const previousBox=dialog.dataset.manualZoom?current?.getAttribute('viewBox'):null;
      const keys=svg=>[...svg.querySelectorAll('[data-space-ship]')].map(m=>m.dataset.spaceShip).join('|');
      if(current&&next&&keys(current)===keys(next)){current.setAttribute('viewBox',next.getAttribute('viewBox'));for(const marker of next.querySelectorAll('[data-space-ship]'))current.querySelector(`[data-space-ship="${CSS.escape(marker.dataset.spaceShip)}"]`)?.setAttribute('transform',marker.getAttribute('transform'));}else current?.replaceWith(next);
      const svg=dialog.querySelector('svg');for(const nextMarker of next.querySelectorAll('[data-space-object]')){const old=svg.querySelector(`[data-space-object="${CSS.escape(nextMarker.dataset.spaceObject)}"]`);if(old&&old!==nextMarker)old.replaceChildren(...[...nextMarker.childNodes].map(n=>n.cloneNode(true)));}if(previousBox)svg.setAttribute('viewBox',previousBox);else fitRendered(svg);
      presentKnowledge(dialog,ships,observer);coverViewport(svg);highlightObjects(dialog);
    }
  }
  // One viewport implementation for every map; only visible projected contacts are used.
  function ambient(svg){
    let layer=svg.querySelector('[data-star-ambience]');if(layer)return layer;
    layer=svg.ownerDocument.createElementNS(svg.namespaceURI,'g');layer.dataset.starAmbience='';layer.setAttribute('aria-hidden','true');layer.style.pointerEvents='none';
    const elapsed=performance.now()/1000;
    layer.innerHTML=Array.from({length:22},(_,i)=>`<circle cx="${(i*37+11)%100/100}" cy="${(i*53+19)%100/100}" r=".0012" fill="${i%3?'#adcce0':'#f4e8cb'}" class="map-twinkle" style="animation-delay:${-((elapsed+i*.71)%(4+i%5))}s;animation-duration:${4+i%5}s"/>`).join('')+'<path class="map-shooting-star" d="M.12 .15l.08 .04" stroke="#d8f4ff" stroke-width="1.4" vector-effect="non-scaling-stroke"/><path class="map-shooting-star second" d="M.62 .23l.07 .03" stroke="#b8dce8" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    for(const [i,star] of [...layer.querySelectorAll('.map-shooting-star')].entries())star.style.animationDelay=`${-((elapsed+(i?11:0))/(i?31:19)%1)*(i?31:19)}s`;
    const backgrounds=svg.querySelectorAll(':scope > rect');backgrounds[backgrounds.length-1]?.after(layer);return layer;
  }
  function staggerLabelBoxes(boxes,viewport,gap=2,steps=4){
    const placed=[];
    return boxes.map(box=>{
      const step=box.height+gap,minimum=viewport.y+gap-box.y,maximum=viewport.y+viewport.height-gap-box.y-box.height;
      const shifts=[0];for(let row=1;row<=steps;row++)shifts.push(row*step,-row*step);
      let chosen=0,lowest=Infinity;
      for(const shift of shifts){
        const dy=minimum<=maximum?Math.max(minimum,Math.min(maximum,shift)):0,candidate={...box,y:box.y+dy};
        const overlap=placed.reduce((sum,other)=>sum+Math.max(0,Math.min(candidate.x+candidate.width+gap,other.x+other.width+gap)-Math.max(candidate.x,other.x))*Math.max(0,Math.min(candidate.y+candidate.height+gap,other.y+other.height+gap)-Math.max(candidate.y,other.y)),0);
        if(overlap<lowest){lowest=overlap;chosen=dy;if(!overlap)break;}
      }
      placed.push({...box,y:box.y+chosen});return chosen;
    });
  }
  function coverViewport(svg) {
    if(!svg)return;
    const box=svg.viewBox.baseVal,rect=svg.getBoundingClientRect();if(!box.width||!box.height||!rect.width||!rect.height)return;
    const scale=Math.min(rect.width/box.width,rect.height/box.height),width=rect.width/scale,height=rect.height/scale;
    const x=box.x+(box.width-width)/2,y=box.y+(box.height-height)/2;
    ensureMapStyles(svg.ownerDocument);
    const stars=ambient(svg);const transform=`translate(${x} ${y}) scale(${width} ${height})`;if(stars.getAttribute('transform')!==transform)stars.setAttribute('transform',transform);
    for(const background of svg.querySelectorAll(':scope > rect'))for(const [k,v] of Object.entries({x,y,width,height}))if(background.getAttribute(k)!==String(v))background.setAttribute(k,v);
    const visibleLabels=[];
    for(const label of svg.querySelectorAll('[data-space-ship] > text')){
      const marker=label.parentElement,transform=marker.transform.baseVal.consolidate()?.matrix;if(!transform)continue;
      const inView=transform.e>=x&&transform.e<=x+width&&transform.f>=y&&transform.f<=y+height;label.style.visibility=inView?'':'hidden';if(!inView)continue;
      label.removeAttribute('transform');
      const full=label.textContent,short=full.split(' — ')[0];if(short!==full)label.textContent=short;
      label.setAttribute('font-size',Math.max(10,Math.min(14,rect.width/28))/scale);label.setAttribute('stroke-width',2/scale);
      label.setAttribute('text-anchor','middle');label.setAttribute('x','0');
      const bounds=label.getBBox(),margin=4/scale;
      if(bounds.width>width-2*margin)label.setAttribute('font-size',Number(label.getAttribute('font-size'))*(width-2*margin)/bounds.width);
      const next=label.getBBox();let dx=0;
      if(transform.e+next.x<x+margin)dx=x+margin-transform.e-next.x;
      if(transform.e+next.x+next.width+dx>x+width-margin)dx=x+width-margin-transform.e-next.x-next.width;
      label.setAttribute('x',dx);
      const measured=label.getBBox();visibleLabels.push({label,box:{x:transform.e+measured.x,y:transform.f+measured.y,width:measured.width,height:measured.height}});
    }
    const offsets=staggerLabelBoxes(visibleLabels.map(item=>item.box),{x,y,width,height},3/scale);
    visibleLabels.forEach(({label},index)=>{if(Math.abs(offsets[index])>1e-8)label.setAttribute('transform',`translate(0 ${offsets[index]})`);});
  }
  function fitContacts(svg,ships,positions){
    if(!svg)return;
    const points=window.SAShipDistances.positions(ships.filter(s=>!s.escapedAt&&s.ship?.warpState?.phase!=='traveling'),positions).map(xy);
    if(!points.length)return;
    const ratio=(svg.clientWidth||600)/(svg.clientHeight||250),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    // Fit contact markers, not the entire uncertainty halo or a distant course endpoint.
    const width=Math.max(12,Math.max(...xs)-Math.min(...xs)+8,(Math.max(...ys)-Math.min(...ys)+8)*ratio),height=width/ratio;
    svg.setAttribute('viewBox',`${cx-width/2} ${cy-height/2} ${width} ${height}`);coverViewport(svg);
  }
  const watched=new WeakMap();
  function planetMarkup(o,c){
    const variant=['ocean','desert','ice','volcanic'].includes(o.variant)?o.variant:'ocean',label=o.name+(o.destroyedAt?' / Destroyed':''),file=o.destroyedAt?'planet-debris.webp':'planet-'+variant+'.webp';
    return `<g data-space-ship="${escape(o.id)}" data-space-object="${escape(o.id)}" data-planet="${escape(o.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(label)} / 7 hexes / pass-through scenery</title><circle r="2.65" fill="#050812" fill-opacity=".12"/><image href="${file}" x="-2.95" y="-2.95" width="5.9" height="5.9" opacity=".85" pointer-events="none"/><text y="3.1" text-anchor="middle" font-size=".55" fill="#e8d6ff" stroke="#070e14" stroke-width=".08" paint-order="stroke">${escape(label)}</text></g>`;
  }
  function watchMaps(root=document){
    highlightObjects(root);
    const maps=[...(root.matches?.('[data-space-canvas]')?[root]:[]),...root.querySelectorAll('[data-space-canvas]')];
    for(const svg of maps){if(watched.has(svg))continue;
      const resize=new ResizeObserver(()=>coverViewport(svg));resize.observe(svg);
      const changes=new MutationObserver(()=>{if(!svg.isConnected){resize.disconnect();changes.disconnect();return;}coverViewport(svg);});
      watched.set(svg,()=>{resize.disconnect();changes.disconnect();watched.delete(svg);});changes.observe(svg,{attributes:true,attributeFilter:['viewBox']});coverViewport(svg);
    }
  }
  if(typeof MutationObserver!=='undefined'&&document.documentElement){const mapMounts=new MutationObserver(records=>{for(const record of records){for(const node of record.removedNodes)if(node.nodeType===1&&!node.isConnected){const maps=[...(node.matches?.('[data-space-canvas]')?[node]:[]),...node.querySelectorAll('[data-space-canvas]')];for(const svg of maps)watched.get(svg)?.();}for(const node of record.addedNodes)if(node.nodeType===1)watchMaps(node);}});mapMounts.observe(document.documentElement,{childList:true,subtree:true});watchMaps();}
  window.SASpaceMap={focusMap,enlarge,zoom,fitRendered,highlightObject,fitContacts,coverViewport,watchMaps,vesselMarkup,sensorRange,conditionMarkup,markup,bindEditor,refresh,presentKnowledge};
}());
