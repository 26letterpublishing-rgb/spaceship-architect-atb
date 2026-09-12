(function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const colors = ["#54d7f5","#f5858d","#b997ff","#64dfa1","#ffd275","#f89dd9"];
  const enlarged = new Set();
  const xy = p => ({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  function contactHalo(ship,point) {
    if (!ship.uncertainty) return '';
    const radius=Number(ship.uncertainty)*Math.sqrt(3);
    return `<circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="#d6ac4914" stroke="#e9c777" stroke-width=".08" stroke-dasharray=".3 .3"><title>Unresolved contact within ${Number(ship.uncertainty)} Units</title></circle>`;
  }
  function markup(ships,saved,editable=false,options={}) {
    const points = window.SAShipDistances.positions(ships,saved), cart = points.map(xy);
    const routes = points.flatMap((p,i)=>{
      const nav=ships[i].navigation;
      if (!nav || !['powered','drift'].includes(nav.phase)) return [];
      const target=nav.phase==='powered' ? nav.target : {q:p.q+nav.direction.q*nav.speed,r:p.r+nav.direction.r*nav.speed};
      return [{a:xy(p),b:xy(target),color:colors[i],drift:nav.phase==='drift'}];
    });
    const bounds=options.navigation ? cart : [...cart,...routes.map(route=>route.b)];
    ships.forEach((ship,index) => {
      const radius = Number(ship.uncertainty || 0) * Math.sqrt(3), center = cart[index];
      if (radius && center) bounds.push({x:center.x-radius,y:center.y-radius},{x:center.x+radius,y:center.y+radius});
    });
    const xs=bounds.length?bounds.map(p=>p.x):[0], ys=bounds.length?bounds.map(p=>p.y):[0];
    const spanX=Math.max(...xs)-Math.min(...xs), spanY=Math.max(...ys)-Math.min(...ys);
    const width=Math.max(18,spanX*1.45+8,(spanY+8)*3.4),height=width/3.4;
    const minX=(Math.min(...xs)+Math.max(...xs)-width)/2, minY=(Math.min(...ys)+Math.max(...ys)-height)/2;
    const size=width/38,locked=new Set(ships.flatMap(s=>(s.lockState?.targets||[]).map(l=>l.targetId)));
    const patternId = `space-hex-${options.navigation?'navigation':editable?'editor':'view'}`;
    return `<section class="space-map"><header>${!editable && !options.navigation ? '<button type="button" data-space-enlarge aria-label="Enlarge space map" title="Enlarge space map">&#x2922;</button>' : ''}</header><svg data-space-canvas viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Starship positions on a hex map"><defs><pattern id="${patternId}" width="${Math.sqrt(3)}" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1 L.866 -.5 V.5 L0 1 L-.866 .5 V-.5 Z M.866 .5 L1.732 1 V2 L.866 2.5 L0 2 V1 Z M0 2 L.866 2.5 V3.5 L0 4 L-.866 3.5 V2.5 Z" fill="none" stroke="#689099" stroke-width=".035"/></pattern></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#070e14"/><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#${patternId})"/>${routes.map(route=>`<path d="M${route.a.x} ${route.a.y} L${route.b.x} ${route.b.y}" fill="none" stroke="${route.color}" stroke-width="${size*.13}" stroke-dasharray="${route.drift?`${size*.35} ${size*.3}`:'none'}" opacity=".7"/>`).join('')}${points.map((p,i)=>{const c=cart[i];const overlap=points.slice(0,i).filter(o=>o.q===p.q&&o.r===p.r).length;return `${contactHalo(ships[i],c)}<g data-space-ship="${escape(p.id)}" transform="translate(${c.x} ${c.y})" style="color:${colors[i]}"><title>${escape(ships[i].title || ships[i].ship?.title)}: ${ships[i].uncertainty ? "approximate sector" : `${Number(p.q.toFixed(2))}, ${Number(p.r.toFixed(2))}`}</title><circle r="${size*.55}" fill="currentColor" stroke="#fff" stroke-width="${size*.09}"/>${locked.has(p.id)?`<circle data-lock-reticle r="${size*.95}" fill="none" stroke="#ffe277" stroke-width="${size*.08}" stroke-dasharray="${size*.7} ${size*.35}"/>`:''}<text y="${size*(overlap%2 ? 1 : -1)*(1.2+Math.ceil(overlap/2)*.85)}" text-anchor="${points.length===2 ? (i===0 ? `end` : `start`) : c.x<minX+width*.25 ? `start` : c.x>minX+width*.75 ? `end` : `middle`}" font-size="${size*1.15}" fill="currentColor" stroke="#070e14" stroke-width="${size*.18}" paint-order="stroke">${escape(ships[i].title || ships[i].ship?.title || 'Starship')}</text></g>`;}).join('')}</svg>${editable?`<div class="space-map-coordinates">${points.map((p,i)=>`<label><strong style="color:${colors[i]}">${escape(ships[i].title || ships[i].ship?.title)}</strong><input type="radio" name="space-placement-ship" value="${escape(p.id)}" ${i===0?'checked':''} aria-label="Place ${escape(ships[i].title)}"><span>Q</span><input type="number" step="1" min="-10000" max="10000" value="${p.q}" data-space-id="${escape(p.id)}" data-space-axis="q" aria-label="${escape(ships[i].title)} hex Q"><span>R</span><input type="number" step="1" min="-10000" max="10000" value="${p.r}" data-space-id="${escape(p.id)}" data-space-axis="r" aria-label="${escape(ships[i].title)} hex R"></label>`).join('')}</div>`:''}</section>`;
  }
  function bindEditor(container,ships,saved,onChange) {
    const signature = JSON.stringify([ships.map(ship=>[ship.id,ship.title]),saved]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    const previousBox=container.querySelector('[data-space-canvas]')?.getAttribute('viewBox');
    container.innerHTML=markup(ships,saved,true);
    const header=container.querySelector('header');header.innerHTML='<button type="button" data-prep-zoom=".7" aria-label="Zoom in preparation map">+</button><button type="button" data-prep-zoom="1.4" aria-label="Zoom out preparation map">-</button><button type="button" data-prep-fit>Fit Ships</button><small>Inner: base sensor range (auto-identify Masking 1-10). Outer: extended range for Masking 0 or less.</small>';
    function decorate(box){const svg=container.querySelector('svg');if(box)svg.setAttribute('viewBox',box);const v=svg.viewBox.baseVal;for(const rect of svg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,v[key]);
      for(const ship of ships){const group=svg.querySelector(`[data-space-ship="${CSS.escape(ship.id)}"]`),range=window.SAShipMap.sensorStats(ship).range;if(!group||!range)continue;for(const scale of [2,1]){const ring=document.createElementNS(svg.namespaceURI,'circle');ring.setAttribute('r',range*Math.sqrt(3)*scale);ring.setAttribute('fill',scale===2?'#80cde90c':'#80cde91e');ring.setAttribute('stroke',scale===2?'#88cde947':'#88cde980');ring.setAttribute('stroke-width','.06');ring.style.pointerEvents='none';group.prepend(ring);}}
    }
    decorate(previousBox);
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
    container.onclick=event=>{const zoom=event.target.closest('[data-prep-zoom]'),fit=event.target.closest('[data-prep-fit]');if(!zoom&&!fit)return;const svg=container.querySelector('svg');if(fit){const temp=document.createElement('template');temp.innerHTML=markup(ships,points,true);svg.setAttribute('viewBox',temp.content.querySelector('svg').getAttribute('viewBox'));}else{const v=svg.viewBox.baseVal,f=Number(zoom.dataset.prepZoom),width=Math.max(1,Math.min(100000,v.width*f)),height=width*v.height/v.width;svg.setAttribute('viewBox',`${v.x+(v.width-width)/2} ${v.y+(v.height-height)/2} ${width} ${height}`);}for(const rect of svg.querySelectorAll(':scope > rect'))for(const key of ['x','y','width','height'])rect.setAttribute(key,svg.viewBox.baseVal[key]);};
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-space-enlarge]');
    if(!button)return;
    // Campaign combat is embedded; put the enlarged view in the visible app viewport.
    let host=document;
    try { while(host.defaultView.frameElement)host=host.defaultView.parent.document; } catch {}
    if(!host.querySelector('link[data-space-map-style]')) {
      const style=host.createElement('link');style.rel='stylesheet';style.href=new URL('space-map.css?v=20260908-hull-1',location.href).href;style.dataset.spaceMapStyle='';host.head.append(style);
    }
    const dialog=host.createElement('dialog');
    dialog.className='space-map-dialog';dialog.setAttribute('aria-label','Space map');
    dialog.innerHTML=button.closest('.space-map').outerHTML;
    dialog.querySelector('[data-space-enlarge]').remove();
    const close=host.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(close);
    enlarged.add(dialog);
    const cleanup=()=>{window.removeEventListener('pagehide',cleanup);enlarged.delete(dialog);dialog.remove();};
    dialog.addEventListener('close',()=>{cleanup();if(button.isConnected)button.focus();},{once:true});window.addEventListener('pagehide',cleanup,{once:true});host.body.append(dialog);dialog.showModal();
  });
  function refresh(ships,positions) {
    for(const dialog of enlarged) {
      const template=dialog.ownerDocument.createElement('template');template.innerHTML=markup(ships,positions);
      dialog.querySelector('svg')?.replaceWith(template.content.querySelector('svg'));
    }
  }
  window.SASpaceMap={markup,bindEditor,refresh};
}());
