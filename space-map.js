(function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g,c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const colors = ["#54d7f5","#f5858d","#b997ff","#64dfa1","#ffd275","#f89dd9"];
  const xy = p => ({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
  function markup(ships,saved,editable=false) {
    const points = window.SAShipDistances.positions(ships,saved), cart = points.map(xy);
    const xs=cart.length?cart.map(p=>p.x):[0], ys=cart.length?cart.map(p=>p.y):[0];
    const spanX=Math.max(...xs)-Math.min(...xs), spanY=Math.max(...ys)-Math.min(...ys);
    const width=Math.max(18,spanX*1.45+8,(spanY+8)*3.4),height=width/3.4;
    const minX=(Math.min(...xs)+Math.max(...xs)-width)/2, minY=(Math.min(...ys)+Math.max(...ys)-height)/2;
    const size=width/38;
    const patternId = `space-hex-${editable?'editor':'view'}`;
    return `<section class="space-map"><header>${!editable ? '<button type="button" data-space-enlarge aria-label="Enlarge space map" title="Enlarge space map">&#x2922;</button>' : ''}</header><svg data-space-canvas viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="Starship positions on a hex map"><defs><pattern id="${patternId}" width="${Math.sqrt(3)}" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1 L.866 -.5 V.5 L0 1 L-.866 .5 V-.5 Z M.866 .5 L1.732 1 V2 L.866 2.5 L0 2 V1 Z M0 2 L.866 2.5 V3.5 L0 4 L-.866 3.5 V2.5 Z" fill="none" stroke="#689099" stroke-width=".035"/></pattern></defs><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#070e14"/><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="url(#${patternId})"/>${points.map((p,i)=>{const c=cart[i];const overlap=points.slice(0,i).filter(o=>o.q===p.q&&o.r===p.r).length;return `<g transform="translate(${c.x} ${c.y})" style="color:${colors[i]}"><title>${escape(ships[i].title || ships[i].ship?.title)}: ${p.q}, ${p.r}</title><circle r="${size*.55}" fill="currentColor" stroke="#fff" stroke-width="${size*.09}"/><text y="${size*(overlap%2 ? 1 : -1)*(1.2+Math.ceil(overlap/2)*.85)}" text-anchor="${c.x<minX+width*.25 ? `start` : c.x>minX+width*.75 ? `end` : `middle`}" font-size="${size*1.15}" fill="currentColor" stroke="#070e14" stroke-width="${size*.18}" paint-order="stroke">${escape(ships[i].title || ships[i].ship?.title || 'Starship')}</text></g>`;}).join('')}</svg>${editable?`<div class="space-map-coordinates">${points.map((p,i)=>`<label><strong style="color:${colors[i]}">${escape(ships[i].title || ships[i].ship?.title)}</strong><input type="radio" name="space-placement-ship" value="${escape(p.id)}" ${i===0?'checked':''} aria-label="Place ${escape(ships[i].title)}"><span>Q</span><input type="number" step="1" min="-10000" max="10000" value="${p.q}" data-space-id="${escape(p.id)}" data-space-axis="q" aria-label="${escape(ships[i].title)} hex Q"><span>R</span><input type="number" step="1" min="-10000" max="10000" value="${p.r}" data-space-id="${escape(p.id)}" data-space-axis="r" aria-label="${escape(ships[i].title)} hex R"></label>`).join('')}</div>`:''}</section>`;
  }
  function bindEditor(container,ships,saved,onChange) {
    const signature = JSON.stringify([ships.map(ship=>[ship.id,ship.title]),saved]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    container.innerHTML=markup(ships,saved,true);
    let points=window.SAShipDistances.positions(ships,saved);
    const redraw=()=> { onChange(points); container.dataset.signature=JSON.stringify([ships.map(ship=>[ship.id,ship.title]),points]); const template=document.createElement('template');template.innerHTML=markup(ships,points,true);container.querySelector('svg').replaceWith(template.content.querySelector('svg'));for(const input of container.querySelectorAll('[data-space-axis]'))if(input!==document.activeElement)input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis]; };
    const edit=event=> {const input=event.target;if(!input.dataset.spaceAxis)return;const value=Number(input.value);if(!input.value.trim()||!Number.isInteger(value)||Math.abs(value)>10000){if(event.type==='change')input.value=points.find(p=>p.id===input.dataset.spaceId)[input.dataset.spaceAxis];return;}points=points.map(p=>p.id===input.dataset.spaceId?{...p,[input.dataset.spaceAxis]:value}:p);redraw();};
    container.oninput=edit;container.onchange=edit;
    container.onclick=event=> {const svg=event.target.closest('[data-space-canvas]');if(!svg)return;const id=container.querySelector('[name="space-placement-ship"]:checked')?.value;if(!id)return;const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());const q=Math.sqrt(3)/3*p.x-p.y/3,r=2*p.y/3;let x=Math.round(q),z=Math.round(r),y=Math.round(-q-r);const dx=Math.abs(x-q),dz=Math.abs(z-r),dy=Math.abs(y+q+r);if(dx>dy&&dx>dz)x=-y-z;else if(dz>dy)z=-x-y;if(Math.abs(x)>10000||Math.abs(z)>10000)return;points=points.map(p=>p.id===id?{id,q:x,r:z}:p);redraw();};
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
    dialog.addEventListener('close',()=>{dialog.remove();button.focus();});host.body.append(dialog);dialog.showModal();
  });
  window.SASpaceMap={markup,bindEditor};
}());
