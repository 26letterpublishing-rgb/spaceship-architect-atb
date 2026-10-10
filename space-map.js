(function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const colors = ["#54d7f5","#f5858d","#b997ff","#64dfa1","#ffd275","#f89dd9"];
  const enlarged = new Set();
  const wreckVisible=ship=>Boolean(ship.destroyedAt)&&Date.now()-Date.parse(ship.destroyedAt)>=2400;
  const xy = p => ({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  const motion=new Map();let motionFrame=0;
  function moveMarker(marker,point){
    const x=point.x,y=point.y,old=motion.get(marker);
    if(old&&old.x===x&&old.y===y)return;
    const state=window.SACombatBridge?.state?.(),paused=state&&(!state.running||state.hardPaused||state.rollPaused||state.pausedForTurn||state.holdPaused);
    const now=performance.now(),matrix=marker.transform?.baseVal.consolidate()?.matrix;
    if(!old&&matrix&&Math.abs(matrix.e-x)<1e-7&&Math.abs(matrix.f-y)<1e-7)return;
    marker.style.transition='none';
    if(!matrix||paused||document.hidden||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){marker.setAttribute('transform',`translate(${x} ${y})`);motion.delete(marker);return;}
    motion.set(marker,{x,y,fromX:matrix.e,fromY:matrix.f,start:now,duration:Math.max(100,Math.min(350,old?now-old.start:200))});
    if(!motionFrame)motionFrame=requestAnimationFrame(animateMarkers);
  }
  function animateMarkers(now){
    motionFrame=0;const state=window.SACombatBridge?.state?.(),paused=state&&(!state.running||state.hardPaused||state.rollPaused||state.pausedForTurn||state.holdPaused);
    for(const [marker,m]of motion){if(!marker.isConnected){motion.delete(marker);continue;}const t=paused||document.hidden?1:Math.min(1,(now-m.start)/m.duration);marker.setAttribute('transform',`translate(${m.fromX+(m.x-m.fromX)*t} ${m.fromY+(m.y-m.fromY)*t})`);if(t===1)motion.delete(marker);}
    if(motion.size)motionFrame=requestAnimationFrame(animateMarkers);
  }
  // Geometry and artwork change independently of position. Keep the same SVG and
  // marker nodes between updates so input, focus and animation remain intact.
  function update(container,ships,positions,options={}){
    const ghosts=(window.SACombatBridge?.state?.()?.gmContactMarkers||[]).filter(g=>!ships.some(s=>s.id===g.id));
    if(ghosts.length){ships=[...ships,...ghosts];positions=[...(positions||[]),...ghosts.map(g=>({...g.position,id:g.id}))];}
    const objects=options.spaceObjects||window.SACombatBridge?.state?.()?.spaceObjects||[];
    const signature=JSON.stringify([ships.map(s=>[s.id,s.title,s.destroyedAt,s.ship?.salvagedAt,wreckVisible(s),s.escapedAt,s.uncertainty,s.contactLevel,s.ship?.warpState?.phase,s.isCloaked||window.SAShipMap.cloaked(s),window.SAShipMap.scaleRank(s),s.missilePhase,s.missileEndedAt,s.probeTier,s.probeInhibitor,s.droneSprite,(s.lockState?.targets||[]).map(l=>l.targetId)]),objects.map(o=>[o.id,o.name,o.kind,o.quantity,o.intensity,o.destroyedAt,o.collectedBy])]);
    let svg=container.querySelector('[data-space-canvas]');
    if(!svg||container._spaceStructure!==signature){
      const template=container.ownerDocument.createElement('template');template.innerHTML=markup(ships,positions,false,options);const next=template.content.querySelector('svg');
      if(svg){const old=new Map([...svg.querySelectorAll('[data-space-ship]')].map(m=>[m.dataset.spaceShip,m]));for(const fresh of next.querySelectorAll('[data-space-ship]')){const saved=old.get(fresh.dataset.spaceShip);if(!saved)continue;saved.replaceChildren(...fresh.childNodes);for(const a of fresh.attributes)if(a.name!=='transform')saved.setAttribute(a.name,a.value);fresh.replaceWith(saved);}svg.replaceChildren(...next.childNodes);}
      else{container.innerHTML=template.innerHTML;svg=container.querySelector('[data-space-canvas]');}
      container._spaceStructure=signature;
    }
    const points=new Map(window.SAShipDistances.positions(ships,positions).map(p=>[p.id,p]));for(const o of objects)points.set(o.id,o);
    for(const marker of svg.querySelectorAll('[data-space-ship],[data-contact-halo]')){const point=points.get(marker.dataset.spaceShip||marker.dataset.contactHalo);if(point)moveMarker(marker,xy(point));}
    const fields=svg.querySelector('[data-map-fields]'),fieldArt=fieldMarkup(ships,positions,.65);if(fields&&fields._markup!==fieldArt){fields.innerHTML=fieldArt;fields._markup=fieldArt;}
    watchMaps(container);return svg;
  }
  const shipMarkerRadius = ship => Math.max(.55,[0,.55,1.05,1.6,2.2,3.2][window.SAShipMap.scaleRank(ship)]*.58);
  function blackHoleMarkup(o,c,unseen){
    const radius=Math.max(0,o.intensity-1)*Math.sqrt(3),animate=!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const reach=Math.max(0,Math.ceil(Number(o.intensity)||0)-1);let tint='';
    // One compound path shades each affected hex exactly once, without thousands of DOM nodes.
    for(let q=-reach;q<=reach;q++)for(let r=Math.max(-reach,-q-reach);r<=Math.min(reach,-q+reach);r++){const p=xy({q,r});tint+=`M${p.x} ${p.y-1}l.866025404 .5v1l-.866025404 .5l-.866025404 -.5v-1Z`;}
    return `<g data-space-ship="${escape(o.id)}" data-space-object="${escape(o.id)}" ${unseen?'data-fit-ignore="true"':''} transform="translate(${c.x} ${c.y})"><title>${escape(o.name)}</title><path data-gravity-hexes d="${tint}" fill="#a455ff" fill-opacity=".1" pointer-events="none"/><g pointer-events="none" opacity=".35">${[.45,.7,1].map((n,i)=>`<circle r="${radius*n}" fill="none" stroke="#713caa" stroke-width=".08">${animate?`<animate attributeName="opacity" values=".15;.65;.15" dur="${3+i}s" repeatCount="indefinite"/>`:""}</circle>`).join('')}</g><image href="map-black-hole.webp" x="-1.5" y="-1.5" width="3" height="3"/><text y="1.8" text-anchor="middle" font-size=".5" fill="#c4a2ea">${escape(o.name)}</text></g>`;
  }
  function vesselMarkup(ship){
    if(ship.uncertainty||ship.contactLevel==='last-known'||ship.gmContactMarker)return '<circle data-vessel-body data-appearance="unknown" r=".35" fill="currentColor" stroke="#fff" stroke-width=".04"/>';
    const maps=window.SAShipMap,rank=maps.scaleRank(ship),size=[0,.55,1.05,1.6,2.2,3.2][rank],powered=ship.navigation?.phase==='powered'||ship.mapPowered;
    if(maps.cloaked(ship)||ship.isCloaked){const id='cloak-'+String(ship.id).replace(/[^a-z0-9]/gi,'');return `<g data-vessel-body data-rank="${rank}" data-appearance="cloaked" transform="rotate(${maps.shipHeading(ship)})" opacity=".35"><defs><filter id="${id}"><feMorphology in="SourceAlpha" operator="dilate" radius=".025" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge"/><feFlood flood-color="#79baff"/><feComposite in2="edge" operator="in"/></filter></defs><image href="sic-art-starship-rank-${rank}.webp" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}" filter="url(#${id})"/></g>`;}
    return `<g data-vessel-body data-rank="${rank}" data-appearance="normal" transform="rotate(${maps.shipHeading(ship)})" style="--vessel-glow:${maps.shipColor(ship)}"><g class="starship-map-art ${powered?'is-powered':''}"><path class="starship-map-exhaust" d="M${-.08*size} ${.35*size} Q${-.12*size} ${.65*size} 0 ${.88*size} Q${.12*size} ${.65*size} ${.08*size} ${.35*size}Z" fill="#70dfff"/><image href="sic-art-starship-rank-${rank}.webp" x="${-size/2}" y="${-size/2}" width="${size}" height="${size}"/><circle class="starship-running-light" cx="${-.13*size}" cy="${.2*size}" r="${.018*size}" fill="#ff7777"/><circle class="starship-running-light light-two" cx="${.13*size}" cy="${.2*size}" r="${.018*size}" fill="#b6ffd4"/></g></g>`;
  }
  function missileMarkup(ship,p,c,size,locked){
    if(ship.isMine&&['mine','web','impact'].includes(ship.missilePhase)){const web=ship.missilePhase==='web';return `<g data-space-ship="${escape(p.id)}" data-space-mine="${escape(p.id)}" transform="translate(${c.x} ${c.y})">${web?'<circle r="2.6" fill="#9a66df22" stroke="#b198df" stroke-width=".06" stroke-dasharray=".2 .1"/>':''}<image href="sic-art-${escape(ship.mineArt||'space-mine-1')}.webp" x="${-size*.45}" y="${-size*.45}" width="${size*.9}" height="${size*.9}"/><text y="${size}" text-anchor="middle" font-size="${size*.7}" fill="#ffce83">${escape(ship.title)}</text><title>${escape(ship.title)} / Threshold ${ship.mineThreshold??'N/A'}</title></g>`;}

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
    return `<circle data-contact-halo="${escape(ship.id)}" transform="translate(${point.x} ${point.y})" r="${radius}" fill="#d6ac4914" stroke="#e9c777" stroke-width=".08" stroke-dasharray=".3 .3"><title>Unresolved contact within ${Number(ship.uncertainty)} Units</title></circle>`;
  }
  function sensorRange(svg,position,range) {
    let ring=svg.querySelector('[data-sensor-range]');
    if(!range||!position){ring?.remove();return;}
    if(!ring){ring=svg.ownerDocument.createElementNS(svg.namespaceURI,'circle');ring.dataset.sensorRange='';ring.style.pointerEvents='none';ring.setAttribute('fill','#80cde908');ring.setAttribute('stroke','#88cde970');ring.setAttribute('stroke-width','.06');svg.append(ring);}
    const p=xy(position);ring.setAttribute('cx',p.x);ring.setAttribute('cy',p.y);ring.setAttribute('r',range*Math.sqrt(3));
  }
  function conditionMarkup(ship,size,observer) {
    ship=window.SAHealthDisplay?.presentation(ship)||ship;
    if(ship.destroyedAt||ship.uncertainty||!(ship.analyzedContact||observer?.id===ship.id||observer?.sensorState?.analyses?.[ship.id]))return '';
    const health=window.SAHealthDisplay,layers=health.shieldLayers(ship),columns=Math.min(3,Math.max(1,layers.length)),rows=Math.max(1,Math.ceil(layers.length/3));
    const width=columns*51+(columns-1)*12+4,height=rows*20+(rows-1)*5;
    const maximum=Number(ship.maximumHullHp??ship.ship?.maximumHullHp??ship.ship?.gridCells?.length)||0;
    const condition=layers.some(layer=>layer.hp>0||layer.current>0)?health.shieldTracks(layers):health.track('hull',ship.currentHullHp,maximum);
    const scale=size*.035;
    return `<g data-map-condition transform="translate(0 ${-size*2}) scale(${scale})"><foreignObject x="${-width/2}" y="${10-height}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;justify-content:center">${condition}</div></foreignObject></g>`;
  }

  function cleanserScarMarkup(scars=[]){
    const valid=scars.filter(s=>Number.isFinite(s.q)&&Number.isFinite(s.r));
    return `<g data-cleanser-scars pointer-events="none" data-scar-signature="${escape(JSON.stringify(valid))}">${valid.map(s=>{const c=xy(s);return `<g data-cleanser-scar="${escape(s.id||s.eventId)}" transform="translate(${c.x} ${c.y})"><title>Cleanser aftermath / ${escape(s.targetName||'Firing site')}</title><circle r="3.1" fill="#160d23" opacity=".2"/><circle r="2.7" fill="#070410" opacity=".35"/><circle r="2.3" fill="#010206" opacity=".65"/><circle r="1.8" fill="#010205" opacity=".85"/><ellipse rx="2.4" ry="1.55" fill="none" stroke="#745283" stroke-width=".04" opacity=".32" transform="rotate(-24)"/></g>`;}).join('')}</g>`;
  }
  function syncCleanserScars(svg){
    if(svg.getAttribute?.('data-show-cleanser-scars')!=='true')return;
    const scars=(window.SACombatBridge?.state?.()?.cleanserScars||[]).filter(s=>Number.isFinite(s.q)&&Number.isFinite(s.r)),old=svg.querySelector('[data-cleanser-scars]');
    if(old?.getAttribute('data-scar-signature')===JSON.stringify(scars))return;
    old?.remove();
    const backgrounds=svg.querySelectorAll(':scope > rect'),anchor=svg.querySelector('[data-star-ambience]')||backgrounds[backgrounds.length-1];
    anchor?.insertAdjacentHTML('afterend',cleanserScarMarkup(scars));
  }
  function markup(ships,saved,editable=false,options={}) {
    const ghosts=editable?[]:(window.SACombatBridge?.state?.()?.gmContactMarkers||[]).filter(g=>!ships.some(s=>s.id===g.id));
    if(ghosts.length){ships=[...ships,...ghosts];saved=[...(saved||[]),...ghosts.map(g=>({...g.position,id:g.id}))];}
    const objects=options.spaceObjects||(!editable&&window.SACombatBridge?.state?.()?.spaceObjects)||[];
    const fitObservers=ships.filter(s=>!s.spaceObject&&!s.contactOnly&&!s.analyzedContact&&!s.isMissile&&!s.isProbe&&!s.isDrone);
    const unseenObjects=new Set(!editable?objects.filter(o=>!fitObservers.some(s=>{const position=(saved||[]).find(p=>p.id===s.id);return position&&window.SAShipDistances.hexDistance(position,o)<=window.SAShipMap.sensorStats(s).range+1e-8;})).map(o=>o.id):[]);
    const additions=objects.filter(o=>!o.collectedBy&&!ships.some(s=>s.id===o.id));
    ships=[...ships,...additions.map(o=>({id:o.id,title:o.name,spaceObject:o,ship:{}}))];saved=[...(saved||[]),...additions];
    const utilityShips=ships;
    ships=ships.filter(ship=>!ship.escapedAt&&!ship.ship?.salvagedAt&&ship.ship?.warpState?.phase!=='traveling');
    const points = window.SAShipDistances.positions(ships,saved), cart = points.map(xy);
    const routes = points.flatMap((p,i)=>{
      const nav=ships[i].navigation;
      if (!nav || !['powered','drift'].includes(nav.phase)) return [];
      const target=nav.phase==='powered' ? nav.target : {q:p.q+nav.direction.q*nav.speed,r:p.r+nav.direction.r*nav.speed};
      return [{id:p.id,a:xy(p),b:xy(target),color:colors[i],drift:nav.phase==='drift'}];
    });
    const bounds=[...cart.filter((_,i)=>!unseenObjects.has(ships[i].id)),...(options.fitBounds||[]).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))];
    for(const ship of utilityShips)for(const pod of ship.ship?.fieldState?.pods||[])if(!pod.recovered)bounds.push(xy(pod));
    ships.forEach((ship,index)=>{if(['planet','sun'].includes(ship.spaceObject?.kind)&&!unseenObjects.has(ship.id)){const c=cart[index];bounds.push({x:c.x-3,y:c.y-3},{x:c.x+3,y:c.y+3});}});
    const xs=bounds.length?bounds.map(p=>p.x):[0], ys=bounds.length?bounds.map(p=>p.y):[0];
    const spanX=Math.max(...xs)-Math.min(...xs), spanY=Math.max(...ys)-Math.min(...ys);
    const width=Math.max(18,spanX*1.45+8,(spanY+8)*3.4),height=width/3.4;
    const minX=(Math.min(...xs)+Math.max(...xs)-width)/2, minY=(Math.min(...ys)+Math.max(...ys)-height)/2;
    const size=.65,locked=new Set(ships.flatMap(s=>(s.lockState?.targets||[]).map(l=>l.targetId)));
    const patternId = `space-hex-${options.navigation?'navigation':editable?'editor':'view'}`;
    return `<section class="space-map"><header>${!editable&&window.SACombatBridge?.mode?.()==='gm'?'<button type="button" data-ship-glows aria-label="Ship glow colors" title="Ship glow colors">&#9881;</button>':''}${!editable && !options.navigation ? '<button type="button" data-space-enlarge aria-label="Enlarge space map" title="Enlarge space map">&#x2922;</button>' : ''}</header><svg data-space-canvas data-space-editable="${editable}" data-show-cleanser-scars="${!editable}" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Starship positions on a hex map"><defs><pattern id="${patternId}" width="${Math.sqrt(3)}" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1 L.866 -.5 V.5 L0 1 L-.866 .5 V-.5 Z M.866 .5 L1.732 1 V2 L.866 2.5 L0 2 V1 Z M0 2 L.866 2.5 V3.5 L0 4 L-.866 3.5 V2.5 Z" fill="none" stroke="#689099" stroke-width=".035"/></pattern></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#070e14"/><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#${patternId})"/>${editable?'':cleanserScarMarkup(options.cleanserScars||window.SACombatBridge?.state?.()?.cleanserScars||[])}${routes.map(route=>`<path data-navigation-route="${escape(route.id)}" d="M${route.a.x} ${route.a.y} L${route.b.x} ${route.b.y}" fill="none" stroke="${route.color}" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-dasharray="${route.drift?'6 5':'none'}" opacity=".7"/>`).join('')}${probeRoutes(ships)}<g data-map-fields>${fieldMarkup(utilityShips,saved,size)}</g>${points.map((p,i)=>({p,i})).sort((a,b)=>Number(!ships[a.i].spaceObject)-Number(!ships[b.i].spaceObject)).map(({p,i})=>{const c=cart[i];if(ships[i].gmContactMarker||ships[i].contactLevel==='last-known')return `<g data-space-ship="${escape(p.id)}" transform="translate(${c.x} ${c.y})" opacity="${ships[i].gmContactMarker?.75:1}" style="color:${ships[i].mapColor||'#ff575f'}"><title>${escape(ships[i].title)}${ships[i].observerTitle?' — seen by '+escape(ships[i].observerTitle):''}</title>${vesselMarkup(ships[i])}<text y="-.7" text-anchor="middle" font-size=".6" fill="currentColor">${escape(ships[i].title)}</text></g>`;if(ships[i].ship?.salvagedAt)return '';if(ships[i].spaceObject){const o=ships[i].spaceObject;if(o.kind==='projection')return projectionMarkup(o,c);if(o.kind==='sun')return `<g ${unseenObjects.has(o.id)?'data-fit-ignore="true"':''} data-space-ship="${escape(o.id)}" data-space-object="${escape(o.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(o.name)} / Sun</title><image class="map-sun" href="map-sun.webp" x="-2.5" y="-2.5" width="5" height="5"/><text y="-2.6" text-anchor="middle" fill="#ffeec1" font-size=".5">${escape(o.name)}</text></g>`;if(o.gunOrb)return `<g data-space-ship="${escape(o.id)}" transform="translate(${c.x} ${c.y})"><circle r=".45" fill="#c68bff" stroke="#e3caff" stroke-width=".1" style="filter:drop-shadow(0 0 .25px #af50ff)"/><text y="-.7" font-size=".35" fill="#e3caff" text-anchor="middle">${escape(o.name)}</text></g>`;if(o.kind==='black-hole')return blackHoleMarkup(o,c,unseenObjects.has(o.id));if(o.kind==='planet')return planetMarkup(o,c,unseenObjects.has(o.id));return `<g data-space-ship="${escape(p.id)}" data-space-object="${escape(p.id)}" ${unseenObjects.has(p.id)?'data-fit-ignore="true"':''} transform="translate(${c.x} ${c.y})"><title>${escape(o.name)} / ${o.quantity}</title>${['mineral','asteroid'].includes(o.kind)?`<image href="${o.kind==='asteroid'?'asteroid-mining.webp':'map-mineral.webp'}" x="${-size*.85*(o.kind==='asteroid'?1+Math.floor(Math.min(50,o.quantity)/5)*.1:1)}" y="${-size*.85*(o.kind==='asteroid'?1+Math.floor(Math.min(50,o.quantity)/5)*.1:1)}" width="${size*1.7*(o.kind==='asteroid'?1+Math.floor(Math.min(50,o.quantity)/5)*.1:1)}" height="${size*1.7*(o.kind==='asteroid'?1+Math.floor(Math.min(50,o.quantity)/5)*.1:1)}"/>`:`<path d="M-.7 -.6H.7V.6H-.7Z" transform="scale(${size*.65})" fill="#dfa969" stroke="#fff" stroke-width=".08"/>`}<text y="${size*1.4}" text-anchor="middle" font-size="${size*.85}" fill="#e7efef" stroke="#070e14" stroke-width="${size*.12}" paint-order="stroke">${escape(o.name)}</text></g>`;}if(ships[i].isProbe)return `<g data-space-ship="${escape(p.id)}" data-space-probe="${escape(p.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(ships[i].title)} / Defense ${escape(ships[i].defenseScore)}</title>${ships[i].probeInhibitor?'<circle data-probe-inhibitor r="3.464101615" fill="#b687ee" fill-opacity=".1" stroke="#b687ee" stroke-width=".07" stroke-dasharray=".2 .15"/>':''}<image href="sic-art-probe-${Number(ships[i].probeTier)||1}.webp" x="${-size*.65}" y="${-size*.65}" width="${size*1.3}" height="${size*1.3}"/><text y="${size*1.4}" text-anchor="middle" fill="#9be5ed" font-size="${size*.85}">${escape(ships[i].title)}</text>${locked.has(p.id)?`<circle r="${size*.8}" fill="none" stroke="#ffe277" stroke-width="${size*.08}"/>`:''}</g>`;if(ships[i].isDrone)return `<g data-space-ship="${escape(p.id)}" data-space-drone="${escape(p.id)}" transform="translate(${c.x} ${c.y})"><title>${escape(ships[i].title)} / Defense ${escape(ships[i].defenseScore)}</title><g transform="translate(${ships[i].isFloatingBody||ships[i].isSalvageDrone?0:size*1.6} ${ships[i].isFloatingBody||ships[i].isSalvageDrone?0:size*.8})"><image href="${escape(ships[i].droneSprite||'repair-drone-1-sprite.webp')}" x="${-size*.6}" y="${-size*.6}" width="${size*1.2}" height="${size*1.2}"/>${locked.has(p.id)?`<circle r="${size*.8}" fill="none" stroke="#ffe277" stroke-width="${size*.08}"/>`:""}</g></g>`;if(ships[i].isMissile)return missileMarkup(ships[i],p,c,size,locked.has(p.id));const overlap=points.slice(0,i).filter(o=>o.q===p.q&&o.r===p.r).length;return `${contactHalo(ships[i],c)}<g data-space-ship="${escape(p.id)}" transform="translate(${c.x} ${c.y})" class="${wreckVisible(ships[i])?'ship-wreck':''}" style="color:${window.SAShipMap.shipColor(ships[i])}"><title>${escape(ships[i].title || ships[i].ship?.title)}: ${ships[i].uncertainty ? "approximate sector" : `${Number(p.q.toFixed(2))}, ${Number(p.r.toFixed(2))}`}</title><circle data-ship-hit r="${Math.max(.75,shipMarkerRadius(ships[i]))}" fill="transparent" stroke="none" pointer-events="all"/>${!wreckVisible(ships[i])&&!ships[i].uncertainty&&(ships[i].currentShieldHp>0||ships[i].shieldCondition>0)?`<circle data-shield-ring r="${shipMarkerRadius(ships[i])}" fill="none" stroke="#65ef91" stroke-width=".09" style="animation:shield-map-pulse 1.6s ease-in-out infinite;pointer-events:none"/>`:''}${wreckVisible(ships[i])?wreckMarkup(size):vesselMarkup(ships[i])}${conditionMarkup(ships[i],size,options.observer)}${locked.has(p.id)?`<circle data-lock-reticle r="${size*.95}" fill="none" stroke="#ffe277" stroke-width="${size*.08}" stroke-dasharray="${size*.7} ${size*.35}"/>`:''}<text y="${size*(overlap%2 ? 1 : -1)*(1.2+Math.ceil(overlap/2)*.85)}" text-anchor="${ships.filter(s=>!s.isMissile).length===2 ? (i===0 ? `end` : `start`) : c.x<minX+width*.25 ? `start` : c.x>minX+width*.75 ? `end` : `middle`}" font-size="${size*1.15}" fill="currentColor" stroke="#070e14" stroke-width="${size*.18}" paint-order="stroke">${escape((ships[i].title || ships[i].ship?.title || 'Starship').split(' — ')[0]+(wreckVisible(ships[i])?' [DESTROYED]':''))}</text></g>`;}).join('')}</svg>${editable?`<div class="space-map-coordinates">${points.map((p,i)=>`<label><strong style="color:${window.SAShipMap.shipColor(ships[i])}">${escape(ships[i].title || ships[i].ship?.title)}</strong><input type="radio" name="space-placement-ship" value="${escape(p.id)}" ${i===0?'checked':''} aria-label="Place ${escape(ships[i].title)}"><span>Q</span><input type="number" step="1" min="-10000" max="10000" value="${p.q}" data-space-id="${escape(p.id)}" data-space-axis="q" aria-label="${escape(ships[i].title)} hex Q"><span>R</span><input type="number" step="1" min="-10000" max="10000" value="${p.r}" data-space-id="${escape(p.id)}" data-space-axis="r" aria-label="${escape(ships[i].title)} hex R"></label>`).join('')}</div>`:''}</section>`;
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
  function beginObjectPlacement(container,placement){
    container._objectPlacement?.onCancel?.();
    container._objectPlacement=placement;container._syncObjectPlacement?.();
    container.tabIndex=-1;container.focus?.({preventScroll:true});
  }
  function installObjectPlacement(container){
    if(container._objectPlacementEvents)return;container._objectPlacementEvents=true;
    let drag=null;
    const stop=event=>{event.preventDefault();event.stopImmediatePropagation();};
    const point=event=>{
      const svg=container.querySelector('svg'),p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());
      const q=Math.sqrt(3)/3*p.x-p.y/3,r=2*p.y/3;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);
      if(Math.abs(x-q)>Math.abs(y+q+r)&&Math.abs(x-q)>Math.abs(z-r))x=-y-z;else if(Math.abs(z-r)>Math.abs(y+q+r))z=-x-y;
      return{q:Math.max(-10000,Math.min(10000,x)),r:Math.max(-10000,Math.min(10000,z))};
    };
    const cancel=()=>{const pending=container._objectPlacement;container._objectPlacement=null;container._syncObjectPlacement?.();drag=null;pending?.onCancel?.();};
    container.addEventListener('pointerdown',event=>{
      if(!container._objectPlacement||event.button!==0||!event.target.closest('svg'))return;
      stop(event);const svg=container.querySelector('svg'),v=svg.viewBox.baseVal;drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false,box:{x:v.x,y:v.y,width:v.width,height:v.height}};container.setPointerCapture?.(event.pointerId);
    },true);
    container.addEventListener('pointermove',event=>{
      if(!container._objectPlacement)return;
      const svg=container.querySelector('svg');if(!svg||(!drag&&!event.target.closest('svg')))return;
      stop(event);
      if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;const rect=svg.getBoundingClientRect(),b=drag.box;svg.setAttribute('viewBox',`${b.x-dx*b.width/rect.width} ${b.y-dy*b.height/rect.height} ${b.width} ${b.height}`);coverViewport(svg);container.dataset.manualZoom='true';return;}
      let preview=svg.querySelector('[data-object-placement-preview]');if(!preview){preview=document.createElementNS(svg.namespaceURI,'path');preview.dataset.objectPlacementPreview='';preview.setAttribute('d','M0 -1L.866 -.5V.5L0 1L-.866 .5V-.5Z');svg.append(preview);}
      const p=xy(point(event));preview.setAttribute('transform',`translate(${p.x} ${p.y})`);
    },true);
    container.addEventListener('pointerup',event=>{
      if(!container._objectPlacement||!drag||drag.id!==event.pointerId)return;
      stop(event);const moved=drag.moved;drag=null;container.releasePointerCapture?.(event.pointerId);if(moved)return;
      const pending=container._objectPlacement;container._objectPlacement=null;container._syncObjectPlacement?.();
      try{pending.onPlace(point(event));}catch(error){container._objectPlacement=pending;container._syncObjectPlacement?.();const out=container.parentElement.querySelector('[data-object-editor] output');if(out)out.textContent=error.message;}
    },true);
    container.addEventListener('pointercancel',()=>{drag=null;},true);
    container.addEventListener('keydown',event=>{if(event.key==='Escape'&&container._objectPlacement){stop(event);cancel();}},true);
    container._cancelObjectPlacement=cancel;
  }
  function bindEditor(container,ships,saved,onChange,{fixedIds=[]}={}) {
    const signature = JSON.stringify([ships.map(ship=>[ship.id,ship.title,window.SAShipMap.sensorStats(ship).range]),saved]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    const shipIds=JSON.stringify(ships.map(ship=>ship.id));
    const previousBox=container.dataset.editorShipIds===shipIds||container.dataset.manualZoom==='true'
      ? container.querySelector('[data-space-canvas]')?.getAttribute('viewBox') : null;
    container.dataset.editorShipIds=shipIds;
    container.innerHTML=markup(ships,saved,true);
    container.dataset.mapEditor='';
    const actualShips=ships.filter(ship=>!ship.spaceObject);
    const header=container.querySelector('header');header.innerHTML='<button type="button" data-prep-zoom=".7" aria-label="Zoom in preparation map">+</button><button type="button" data-prep-zoom="1.4" aria-label="Zoom out preparation map">−</button><button type="button" data-prep-fit>Fit Map</button><button type="button" data-prep-enlarge data-map-focus>Enlarge Map</button><small data-prep-help></small><div class="space-placement-instruction" data-prep-placement hidden><strong></strong><span>Click a hex to place. Drag empty space to pan.</span><button type="button" data-prep-cancel-placement>Cancel Placement</button></div>';
    header.querySelector('[data-prep-help]').textContent=actualShips.length?'Drag ships or objects to reposition. Rings show base and extended sensor range.':'Drag objects to reposition. Use Place on Map below to add another object.';
    const coordinates=container.querySelector('.space-map-coordinates');
    if(coordinates){const details=document.createElement('details');details.className='space-map-position-details';details.innerHTML='<summary>Advanced: exact hex positions</summary>';coordinates.before(details);details.append(coordinates);for(const radio of coordinates.querySelectorAll('[type="radio"]'))radio.remove();for(const input of coordinates.querySelectorAll('[data-space-id]'))if(fixedIds.includes(input.dataset.spaceId)){input.disabled=true;input.title='The central star stays at the center.';}}
    installObjectPlacement(container);
    container._syncObjectPlacement=()=>{const pending=container._objectPlacement,banner=container.querySelector('[data-prep-placement]');container.classList.toggle('is-placing-object',Boolean(pending));if(banner){banner.hidden=!pending;banner.querySelector('strong').textContent=pending?'Place '+pending.name:'';}if(!pending)container.querySelector('[data-object-placement-preview]')?.remove();};
    header.querySelector('[data-prep-cancel-placement]').onclick=event=>{event.stopPropagation();container._cancelObjectPlacement();};container._syncObjectPlacement();
    function decorate(box){const svg=container.querySelector('svg');if(box)svg.setAttribute('viewBox',box);const v=svg.viewBox.baseVal;for(const rect of svg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,v[key]);
      for(const ship of ships){
        if(ship.spaceObject)continue;const group=svg.querySelector(`[data-space-ship="${CSS.escape(ship.id)}"]`),range=window.SAShipMap.sensorStats(ship).range;if(!group||!range)continue;for(const scale of [2,1]){const ring=document.createElementNS(svg.namespaceURI,'circle');ring.setAttribute('r',range*Math.sqrt(3)*scale);ring.setAttribute('fill',scale===2?'#80cde90c':'#80cde91e');ring.setAttribute('stroke',scale===2?'#88cde947':'#88cde980');ring.setAttribute('stroke-width','.06');ring.style.pointerEvents='none';group.prepend(ring);}}
    }
    const expand=container.querySelector('[data-prep-enlarge]');expand.textContent=container.classList.contains('map-focus')?'Return to Setup':'Enlarge Map';expand.setAttribute('aria-pressed',String(container.classList.contains('map-focus')));expand.onclick=event=>{event.stopPropagation();focusMap(container,expand);};
    decorate(previousBox);
    if(!previousBox)requestAnimationFrame(()=>fitRendered(container.querySelector('svg')));
    let points=window.SAShipDistances.positions(ships,saved);
    const redraw=()=> { const box=container.querySelector('svg').getAttribute('viewBox');container.dataset.signature=JSON.stringify([ships.map(ship=>[ship.id,ship.title,window.SAShipMap.sensorStats(ship).range]),points]);onChange(points); const template=document.createElement('template');template.innerHTML=markup(ships,points,true);container.querySelector('svg').replaceWith(template.content.querySelector('svg'));decorate(box);for(const input of container.querySelectorAll('[data-space-axis]'))if(input!==document.activeElement)input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis]; };
    const edit=event=> {const input=event.target;if(!input.dataset.spaceAxis||fixedIds.includes(input.dataset.spaceId))return;const value=Number(input.value);if(!input.value.trim()||!Number.isInteger(value)||Math.abs(value)>10000){if(event.type==='change')input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis];return;}points=points.map(p=>p.id===input.dataset.spaceId?{...p,[input.dataset.spaceAxis]:value}:p);redraw();};
    container.oninput=edit;container.onchange=edit;
    let dragging=null;
    const hex=event=>{const svg=container.querySelector('svg'),p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse()),q=Math.sqrt(3)/3*p.x-p.y/3,r=2*p.y/3;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dz=Math.abs(z-r),dy=Math.abs(y+q+r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;return {q:Math.max(-10000,Math.min(10000,x)),r:Math.max(-10000,Math.min(10000,z))};};
    container.onpointerdown=event=>{const marker=event.target.closest('[data-space-ship]');if(!marker||fixedIds.includes(marker.dataset.spaceShip))return;dragging=marker.dataset.spaceShip;container.setPointerCapture(event.pointerId);event.preventDefault();};
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
    const v=svg.viewBox.baseVal,width=Math.max(4*Math.sqrt(3),Math.min(100000,v.width*factor)),height=width*v.height/v.width;
    svg.setAttribute('viewBox',`${v.x+(v.width-width)/2} ${v.y+(v.height-height)/2} ${width} ${height}`);svg.dataset.userViewBox=svg.getAttribute('viewBox');coverViewport(svg);
  }
  function fitRendered(svg){
    delete svg.dataset.userViewBox;
    const markers=[...svg.querySelectorAll('[data-space-ship]:not([data-fit-ignore])')],points=markers.map(m=>{
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
    try { while(host.defaultView.frameElement&&!host.defaultView.frameElement.hasAttribute('data-explore-perspective'))host=host.defaultView.parent.document; } catch {}
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
    let root=document;try{while(root.defaultView.frameElement&&!root.defaultView.frameElement.hasAttribute('data-explore-perspective'))root=root.defaultView.parent.document;}catch{}
    for(const doc of new Set([document,root]))highlightObjects(doc);
  }
  function bindReportHighlight(doc){
    for(const [enter,leave] of [['pointerover','pointerout'],['focusin','focusout']]){
      doc.addEventListener(enter,event=>{const ref=event.target.closest?.('[data-log-space-object]');if(ref)highlightObject(ref.dataset.logSpaceObject);});
      doc.addEventListener(leave,event=>{const ref=event.target.closest?.('[data-log-space-object]');if(ref&&!ref.contains(event.relatedTarget))highlightObject(null);});
    }
  }
  bindReportHighlight(document);
  try{let root=document;while(root.defaultView.frameElement&&!root.defaultView.frameElement.hasAttribute('data-explore-perspective'))root=root.defaultView.parent.document;if(root!==document)bindReportHighlight(root);}catch{}
  function presentKnowledge(root,ships,observer) {
    for(const ship of ships){
      if(ship.isMissile)continue;
      const unknown=Boolean(observer&&ship.id!==observer.id&&observer.sensorState?.contacts?.[ship.id]?.level!=='detected');
      for(const marker of root.querySelectorAll(`[data-space-ship="${CSS.escape(ship.id)}"]`)){
        marker.classList.toggle('gm-unknown-marker',unknown);
        const label=marker.querySelector(':scope > text'),value=(ship.title||ship.ship?.title||'Starship').split(' — ')[0]+(wreckVisible(ship)?' [DESTROYED]':unknown?' (unknown)':'');if(label&&label.dataset.mapLabel!==value){label.dataset.mapLabel=value;label.textContent=value;}
      }
    }
  }
  function refresh(ships,positions,observer) {
    let root=document;try{while(root.defaultView.frameElement&&!root.defaultView.frameElement.hasAttribute('data-explore-perspective'))root=root.defaultView.parent.document;}catch{}
    for(const doc of new Set([document,root]))for(const svg of doc.querySelectorAll('[data-space-canvas]')){
      if(svg.dataset.spaceEditable==='true')continue;
      syncCleanserScars(svg);
      for(const path of svg.querySelectorAll('[data-navigation-route],[data-probe-route]'))path.remove();
      svg.insertAdjacentHTML('beforeend',probeRoutes(ships));
      for(const ship of ships){
        const marker=svg.querySelector(`[data-space-ship="${CSS.escape(ship.id)}"]`);if(!marker||ship.isMissile||ship.isDrone||ship.isProbe)continue;
        marker.style.color=window.SAShipMap.shipColor(ship);
        const body=marker.querySelector('[data-vessel-body]'),rank=window.SAShipMap.scaleRank(ship),appearance=ship.uncertainty||ship.contactLevel==='last-known'||ship.gmContactMarker?'unknown':window.SAShipMap.cloaked(ship)||ship.isCloaked?'cloaked':'normal';
        if(ship.ship?.salvagedAt){marker.remove();continue;}if(wreckVisible(ship)){body?.remove();if(!marker.querySelector('[data-debris]'))marker.insertAdjacentHTML('afterbegin',wreckMarkup(.65));marker.classList.add('ship-wreck');}else if(!body||body.dataset.appearance!==appearance||appearance!=='unknown'&&Number(body.dataset.rank)!==rank){body?.remove();marker.insertAdjacentHTML('afterbegin',vesselMarkup(ship));}else{body.setAttribute('transform',`rotate(${window.SAShipMap.shipHeading(ship)})`);body.style.setProperty('--vessel-glow',window.SAShipMap.shipColor(ship));body.querySelector('.starship-map-art')?.classList.toggle('is-powered',ship.navigation?.phase==='powered'||ship.mapPowered===true);}
        const size=.65,condition=conditionMarkup(ship,size,observer);
        if(marker._conditionMarkup!==condition||condition&&!marker.querySelector('[data-map-condition]')){marker.querySelector('[data-map-condition]')?.remove();marker.insertAdjacentHTML('beforeend',condition);marker._conditionMarkup=condition;}
        let hit=marker.querySelector('[data-ship-hit]');
        if(!hit){hit=doc.createElementNS('http://www.w3.org/2000/svg','circle');hit.dataset.shipHit='';hit.setAttribute('fill','transparent');hit.setAttribute('stroke','none');hit.setAttribute('pointer-events','all');marker.prepend(hit);}
        hit.setAttribute('r',Math.max(.75,shipMarkerRadius(ship)));
        let ring=marker.querySelector('[data-shield-ring]');
        const shielded=!ship.destroyedAt&&!ship.uncertainty&&!ship.gmContactMarker&&ship.contactLevel!=='last-known'&&(ship.currentShieldHp>0||ship.shieldCondition>0);
        if(shielded&&!ring){ring=doc.createElementNS('http://www.w3.org/2000/svg','circle');ring.dataset.shieldRing='';ring.setAttribute('fill','none');ring.setAttribute('stroke','#65ef91');ring.setAttribute('stroke-width','.09');ring.style.cssText='animation:shield-map-pulse 1.6s ease-in-out infinite;pointer-events:none';marker.prepend(ring);}else if(!shielded)ring?.remove();
        if(shielded)ring.setAttribute('r',shipMarkerRadius(ship));
        const nav=ship.navigation,p=window.SAShipDistances.positions(ships,positions).find(p=>p.id===ship.id);
        if(!p||!nav||!['powered','drift'].includes(nav.phase))continue;
        const target=nav.phase==='powered'?nav.target:{q:p.q+nav.direction.q*nav.speed,r:p.r+nav.direction.r*nav.speed};if(!target)continue;
        const a=xy(p),b=xy(target),path=doc.createElementNS('http://www.w3.org/2000/svg','path');path.dataset.navigationRoute=ship.id;path.setAttribute('d',`M${a.x} ${a.y} L${b.x} ${b.y}`);path.setAttribute('fill','none');path.setAttribute('stroke',marker.style.color||'#6ed1dd');path.setAttribute('stroke-width','2.5');path.setAttribute('vector-effect','non-scaling-stroke');path.setAttribute('opacity','.7');if(nav.phase==='drift')path.setAttribute('stroke-dasharray','6 5');svg.insertBefore(path,marker);
      }
    }
    for(const doc of new Set([document,root])){for(const svg of doc.querySelectorAll('[data-space-canvas]'))if(svg.dataset.spaceEditable!=='true')coverViewport(svg);highlightObjects(doc);}
    for(const dialog of enlarged) {
      const svg=update(dialog,ships,positions);
      presentKnowledge(dialog,ships,observer);coverViewport(svg);highlightObjects(dialog);
    }
  }
  // One viewport implementation for every map; only visible projected contacts are used.
  function ambient(svg){
    let layer=svg.querySelector('[data-star-ambience]');if(layer)return layer;
    layer=svg.ownerDocument.createElementNS(svg.namespaceURI,'g');layer.dataset.starAmbience='';layer.setAttribute('aria-hidden','true');layer.style.pointerEvents='none';
    const elapsed=performance.now()/1000;
    layer.innerHTML=Array.from({length:22},(_,i)=>`<circle cx="${(i*37+11)%100/100}" cy="${(i*53+19)%100/100}" r=".0012" fill="${i%3?'#adcce0':'#f4e8cb'}" class="map-twinkle" style="animation-delay:${-((elapsed+i*.71)%(4+i%5))}s;animation-duration:${4+i%5}s"/>`).join('')+'<path class="map-shooting-star" d="M.12 .15l.08 .04" stroke="#d8f4ff" stroke-width="1.4" vector-effect="non-scaling-stroke"/><path class="map-shooting-star second" d="M.62 .23l.07 .03" stroke="#b8dce8" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    for(const [i,star] of [...layer.querySelectorAll('.map-shooting-star')].entries()){const randomize=()=>{const angle=Math.random()*Math.PI*2,x=.1+Math.random()*.8,y=.1+Math.random()*.8,dx=Math.cos(angle),dy=Math.sin(angle);star.setAttribute('d',`M${x} ${y}l${dx*.09} ${dy*.09}`);star.style.setProperty('--shoot-x',dx*.224+'px');star.style.setProperty('--shoot-y',dy*.224+'px');};randomize();star.addEventListener('animationiteration',randomize);star.style.animationDelay=`${-((elapsed+(i?11:0))/(i?31:19)%1)*(i?31:19)}s`;}
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
  const labelMeasurements=new Map();
  function coverViewport(svg) {
    if(!svg)return;
    const box=svg.viewBox.baseVal,rect=svg.getBoundingClientRect();if(!box.width||!box.height||!rect.width||!rect.height)return;
    const scale=Math.min(rect.width/box.width,rect.height/box.height),width=rect.width/scale,height=rect.height/scale;
    const x=box.x+(box.width-width)/2,y=box.y+(box.height-height)/2;
    ensureMapStyles(svg.ownerDocument);
    const stars=ambient(svg);const transform=`translate(${x} ${y}) scale(${width} ${height})`;if(stars.getAttribute('transform')!==transform)stars.setAttribute('transform',transform);
    syncCleanserScars(svg);
    for(const background of svg.querySelectorAll(':scope > rect'))for(const [k,v] of Object.entries({x,y,width,height}))if(background.getAttribute(k)!==String(v))background.setAttribute(k,v);
    const visibleLabels=[];
    for(const label of svg.querySelectorAll('[data-space-ship] > text')){
      const marker=label.parentElement,transform=marker.transform.baseVal.consolidate()?.matrix;if(!transform)continue;
      const inView=transform.e>=x&&transform.e<=x+width&&transform.f>=y&&transform.f<=y+height;label.style.visibility=inView?'':'hidden';if(!inView)continue;
      label.removeAttribute('transform');
      const full=label.textContent,short=full.split(' — ')[0];if(short!==full)label.textContent=short;
      const fontSize=Math.max(10,Math.min(14,rect.width/28))/scale,margin=4/scale;
      const measureKey=JSON.stringify([label.textContent,label.getAttribute('y'),fontSize,width,scale]);
      let measured=labelMeasurements.get(measureKey);
      label.setAttribute('stroke-width',2/scale);
      label.setAttribute('text-anchor','middle');label.setAttribute('x','0');
      if(!measured){
        label.setAttribute('font-size',fontSize);
        const bounds=label.getBBox();
        const finalFont=bounds.width>width-2*margin?fontSize*(width-2*margin)/bounds.width:fontSize;
        label.setAttribute('font-size',finalFont);
        const next=label.getBBox();measured={x:next.x,y:next.y,width:next.width,height:next.height,fontSize:finalFont};
        if(labelMeasurements.size>256)labelMeasurements.clear();labelMeasurements.set(measureKey,measured);
      }else label.setAttribute('font-size',measured.fontSize);
      let dx=0;
      if(transform.e+measured.x<x+margin)dx=x+margin-transform.e-measured.x;
      if(transform.e+measured.x+measured.width+dx>x+width-margin)dx=x+width-margin-transform.e-measured.x-measured.width;
      label.setAttribute('x',dx);
      visibleLabels.push({label,box:{x:transform.e+measured.x+dx,y:transform.f+measured.y,width:measured.width,height:measured.height}});
    }
    const offsets=staggerLabelBoxes(visibleLabels.map(item=>item.box),{x,y,width,height},3/scale);
    visibleLabels.forEach(({label},index)=>{if(Math.abs(offsets[index])>1e-8)label.setAttribute('transform',`translate(0 ${offsets[index]})`);});
  }
  function fitContacts(svg,ships,positions){
    delete svg.dataset.userViewBox;
    if(!svg)return;
    const points=window.SAShipDistances.positions(ships.filter(s=>!s.escapedAt&&!s.ship?.salvagedAt&&s.ship?.warpState?.phase!=='traveling'),positions).map(xy);
    if(!points.length)return;
    const ratio=(svg.clientWidth||600)/(svg.clientHeight||250),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    // Fit contact markers, not the entire uncertainty halo or a distant course endpoint.
    const width=Math.max(12,Math.max(...xs)-Math.min(...xs)+8,(Math.max(...ys)-Math.min(...ys)+8)*ratio),height=width/ratio;
    svg.setAttribute('viewBox',`${cx-width/2} ${cy-height/2} ${width} ${height}`);coverViewport(svg);
  }
  const watched=new WeakMap();
  function projectionMarkup(o,c){
    const appearance=o.appearance||'',large=/Huge|Planet|Monster/.test(appearance),diameter=large?5.2:1.5;
    const art=appearance==='Galactic Monster'?'illusion-monster.webp':appearance==='Planet'?'planet-'+(['ocean','ice','desert','volcanic'].includes(o.variant)?o.variant:'ocean')+'.webp':appearance.startsWith('Asteroid')?'asteroid-mining.webp':'sic-art-starship-rank-'+(large?5:2)+'.webp';
    return `<g data-space-ship="${escape(o.id)}" data-space-object="${escape(o.id)}" transform="translate(${c.x} ${c.y})"><g class="${o.revealed?'revealed-illusion':''}" opacity="${o.revealed?.5:1}"><image href="${art}" x="${-diameter/2}" y="${-diameter/2}" width="${diameter}" height="${diameter}"/></g><text y="${diameter/2+.4}" text-anchor="middle" font-size=".5" fill="#e5c6ff" stroke="#070e14" stroke-width=".07" paint-order="stroke">${escape(o.name)}</text></g>`;
  }
  function planetMarkup(o,c,unseen=false){
    const variant=['ocean','desert','ice','volcanic'].includes(o.variant)?o.variant:'ocean',label=o.name+(o.destroyedAt?' / Destroyed':''),file=o.destroyedAt?'planet-debris.webp':'planet-'+variant+'.webp';
    return `<g data-space-ship="${escape(o.id)}" data-space-object="${escape(o.id)}" data-planet="${escape(o.id)}" ${unseen?'data-fit-ignore="true"':''} transform="translate(${c.x} ${c.y})"><title>${escape(label)} / 7 hexes / pass-through scenery</title><circle r="2.65" fill="#050812" fill-opacity=".12"/><image href="${file}" x="-2.95" y="-2.95" width="5.9" height="5.9" opacity=".85" pointer-events="none"/><text y="3.1" text-anchor="middle" font-size=".55" fill="#e8d6ff" stroke="#070e14" stroke-width=".08" paint-order="stroke">${escape(label)}</text></g>`;
  }
  function bindPan(svg){
    let drag=null,suppressClick=false;
    svg.addEventListener('pointerdown',event=>{if(event.button!==0||(svg.dataset.spaceEditable==='true'&&event.target.closest('[data-space-ship]')))return;const box=svg.viewBox.baseVal;drag={id:event.pointerId,x:event.clientX,y:event.clientY,box:{x:box.x,y:box.y,width:box.width,height:box.height},moved:false};});
    svg.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<5)return;drag.moved=true;svg.setPointerCapture?.(drag.id);event.preventDefault();event.stopImmediatePropagation();const rect=svg.getBoundingClientRect(),b=drag.box;const value=`${b.x-dx*b.width/rect.width} ${b.y-dy*b.height/rect.height} ${b.width} ${b.height}`;svg.setAttribute('viewBox',value);svg.dataset.userViewBox=value;svg.dataset.manualCamera='true';const view=svg.closest('dialog');if(view)view.dataset.manualZoom='true';},true);
    const end=event=>{if(!drag||event.pointerId!==drag.id)return;suppressClick=drag.moved;if(suppressClick){event.preventDefault();event.stopImmediatePropagation();}drag=null;};
    svg.addEventListener('pointerup',end,true);svg.addEventListener('pointercancel',()=>{drag=null;});svg.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
  }
  function watchMaps(root=document){
    highlightObjects(root);
    const maps=[...(root.matches?.('[data-space-canvas]')?[root]:[]),...root.querySelectorAll('[data-space-canvas]')];
    for(const svg of maps){if(watched.has(svg))continue;bindPan(svg);
      const resize=new ResizeObserver(()=>coverViewport(svg));resize.observe(svg);
      const changes=new MutationObserver(()=>{if(!svg.isConnected){resize.disconnect();changes.disconnect();return;}coverViewport(svg);});
      watched.set(svg,()=>{resize.disconnect();changes.disconnect();watched.delete(svg);});changes.observe(svg,{attributes:true,attributeFilter:['viewBox']});coverViewport(svg);
    }
  }
  if(typeof MutationObserver!=='undefined'&&document.documentElement){const mapMounts=new MutationObserver(records=>{for(const record of records){for(const node of record.removedNodes)if(node.nodeType===1&&!node.isConnected){const maps=[...(node.matches?.('[data-space-canvas]')?[node]:[]),...node.querySelectorAll('[data-space-canvas]')];for(const svg of maps)watched.get(svg)?.();}for(const node of record.addedNodes)if(node.nodeType===1)watchMaps(node);}});mapMounts.observe(document.documentElement,{childList:true,subtree:true});watchMaps();}
  window.SASpaceMap={update,moveMarker,cleanserScarMarkup,focusMap,enlarge,zoom,fitRendered,highlightObject,fitContacts,coverViewport,watchMaps,vesselMarkup,sensorRange,conditionMarkup,markup,bindEditor,beginObjectPlacement,refresh,presentKnowledge};
}());
