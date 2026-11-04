(function(){
'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xy=p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r});
const distance=(a,b)=>(Math.abs(a.q-b.q)+Math.abs(a.r-b.r)+Math.abs(a.q+a.r-b.q-b.r))/2;
  function starLabel(name){
    const lines=[];let line='';
    for(const word of String(name).split(/\s+/)){
      if(line&&(line+' '+word).length>24){lines.push(line);line='';}
      if(word.length>24){if(line){lines.push(line);line='';}for(let i=0;i<word.length;i+=24){const chunk=word.slice(i,i+24);if(chunk.length===24)lines.push(chunk);else line=chunk;}}
      else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);
    return lines.map((value,index)=>`<tspan x="0" dy="${index?'1.15em':-(lines.length-1)*1.15+'em'}">${esc(value)}</tspan>`).join('');
  }
  function markup(map,ships,data,{selectedStar="",selectedShip="",role="player"}={}){
    const positions=ships.map(ship=>({ship,p:data.positions[ship.id]})).filter(x=>x.p?.mapId===map.id),groups=new Map();
    for(const entry of positions){const key=data.journeys[entry.ship.id]?entry.ship.id:entry.p.q.toFixed(5)+','+entry.p.r.toFixed(5);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
    const selected=map.stars.find(s=>s.id===selectedStar),from=data.positions[selectedShip];let route='';
    if(selected&&from?.mapId===map.id&&distance(from,selected)>.00001){const a=xy(from),b=xy(selected);route=`<path class="galaxy-planned-route" d="M${a.x} ${a.y}L${b.x} ${b.y}"/>`;}
    return `<svg role="group" aria-label="Galaxy map. Select a star for details. Drag empty space to pan." preserveAspectRatio="xMidYMid meet"><defs><pattern id="galaxy-hex-grid" width="1.732050808" height="3" patternUnits="userSpaceOnUse"><path d="M0 -1L.866025404 -.5V.5L0 1L-.866025404 .5V-.5Z M.866025404 .5L1.732050808 1V2L.866025404 2.5L0 2V1Z M.866025404 2.5V3.5" fill="none" stroke="#7aabbc" stroke-opacity=".22" stroke-width=".022"/></pattern></defs><rect data-grid-fill fill="url(#galaxy-hex-grid)"/><g class="galaxy-routes">${route}${positions.map(({ship})=>{const journey=data.journeys[ship.id];if(!journey)return '';const start=xy(journey.from),end=xy(journey.to);return `<path class="galaxy-active-route" d="M${start.x} ${start.y}L${end.x} ${end.y}"/>`;}).join('')}</g><path data-hover-hex class="galaxy-hover-hex" hidden d="M0 -1L.866025404 -.5V.5L0 1L-.866025404 .5V-.5Z"/>${map.stars.map((star,index)=>{const p=xy(star);return `<g class="galaxy-star${star.id===selectedStar?' is-selected':''}${star.hidden?' is-hidden':''}" data-star="${esc(star.id)}" transform="translate(${p.x} ${p.y})" tabindex="0" role="button" aria-label="${esc(star.name)}${star.hidden?', GM only':''}" aria-pressed="${star.id===selectedStar}"><title>${esc(star.name)}${role==='gm'?' — select for details; use Reposition Stars to drag':' — select for details'}</title><circle class="galaxy-star-hit" r=".68"/><circle class="galaxy-star-halo" r=".55"/><image class="galaxy-star-art" style="animation-delay:${-index*1.13}s" href="galaxy-twinkle-star-v1.png" x="-.72" y="-.72" width="1.44" height="1.44"/><circle class="galaxy-star-selection" r=".8"/><text y="-1.02" text-anchor="middle" class="galaxy-star-name">${starLabel(star.name)}</text>${star.hidden?'<text y="1.15" text-anchor="middle" class="galaxy-hidden-label">GM ONLY</text>':''}</g>`;}).join('')}${[...groups.values()].map(entries=>{const primary=entries.find(e=>e.ship.id===selectedShip)||entries[0],p=xy(primary.p),onStar=!data.journeys[primary.ship.id]&&map.stars.some(s=>distance(s,primary.p)<.2),label=entries.length===1?primary.ship.title:entries.length+' ships';return `<g data-map-ship="${esc(primary.ship.id)}" class="galaxy-vessel${entries.some(e=>e.ship.id===selectedShip)?' is-selected':''}" transform="translate(${p.x} ${p.y+(onStar?.96:0)})" tabindex="0" role="button" aria-label="${esc(entries.map(e=>e.ship.title).join(', '))}"><title>${esc(entries.map(e=>e.ship.title).join(', '))}</title><circle r=".38" fill="transparent"/><g transform="scale(.5)">${window.SASpaceMap.vesselMarkup({...primary.ship,mapPowered:Boolean(data.journeys[primary.ship.id])})}</g><text y=".65" text-anchor="middle">${esc(label)}</text></g>`;}).join('')}${data.party?.mapId===map.id?(()=>{const star=map.stars.find(s=>s.id===data.party.starId);if(!star)return '';const p=xy(star);return window.SAPlanetTerrain?.partyMarker(p.x,p.y-.7,.014);})():''}</svg>`.replaceAll('galaxy-hex-grid','galaxy-hex-grid-'+crypto.randomUUID());
  }


function picker(host,context,shipId,onConfirm,onCancel){
 const data=context?.starmaps,origin=data?.positions?.[shipId],map=data?.maps?.find(m=>m.id===origin?.mapId);
 if(!map||!origin||context.role!=='gm'&&data.navigation?.allowed?.galaxy===false)throw Error('A visible sector map and placed ship are required.');
 const doc=host.ownerDocument,ships=(context.starships||[]).filter(s=>data.positions?.[s.id]?.mapId===map.id);
 host.innerHTML='<div class="galaxy-camera-tools"></div><div class="warp-destination-map"></div><output aria-live="polite"></output><div class="warp-destination-actions"></div>';
 const surface=host.querySelector('.warp-destination-map');surface.innerHTML=markup(map,ships,{...data,journeys:data.journeys||{},party:null},{selectedShip:shipId,role:context.role});
 const svg=surface.querySelector('svg'),grid=svg.querySelector('[data-grid-fill]'),highlight=svg.querySelector('[data-hover-hex]'),out=host.querySelector('output');
 svg.setAttribute('aria-label','Choose Warp destination. Select a star or hex; drag to pan.');
 let selected=null,drag=null,closed=false,camera={...xy(origin),height:18};
 function button(label,fn,parent){const el=doc.createElement('button');el.type='button';el.dataset.utilityControl='';el.textContent=label;el.onclick=fn;parent.append(el);return el;}
 function apply(){if(closed||!svg.clientHeight)return;const h=camera.height,w=h*svg.clientWidth/svg.clientHeight,x=camera.x-w/2,y=camera.y-h/2;svg.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);for(const[k,v]of Object.entries({x,y,width:w,height:h}))grid.setAttribute(k,v);svg.style.setProperty('--galaxy-label-size',Math.max(.28,Math.min(3.5,h/svg.clientHeight*14))+'px');}
 const world=e=>{const r=svg.getBoundingClientRect(),h=camera.height,w=h*r.width/r.height;return{x:camera.x-w/2+(e.clientX-r.left)*w/r.width,y:camera.y-h/2+(e.clientY-r.top)*h/r.height};};
 const snap=p=>{const r=p.y/1.5,q=p.x/Math.sqrt(3)-r/2,z=-q-r;let a=Math.round(q),b=Math.round(r),c=Math.round(z);const da=Math.abs(a-q),db=Math.abs(b-r),dc=Math.abs(c-z);if(da>db&&da>dc)a=-b-c;else if(db>dc)b=-a-c;return{q:a,r:b};};
 const tools=host.querySelector('.galaxy-camera-tools'),actions=host.querySelector('.warp-destination-actions');
 const confirm=button('Confirm Destination',()=>{if(!selected||confirm.disabled)return;confirm.disabled=true;onConfirm({...selected,mapId:map.id,origin:{...origin}});},actions);confirm.disabled=true;
 button('Cancel',onCancel,actions);
 function choose(p){if(!Number.isInteger(p.q)||!Number.isInteger(p.r)||Math.abs(p.q)>10000||Math.abs(p.r)>10000)return;selected={q:p.q,r:p.r};const star=map.stars.find(s=>s.q===p.q&&s.r===p.r),position=xy(p);highlight.removeAttribute('hidden');highlight.setAttribute('transform',`translate(${position.x} ${position.y})`);const range=distance(origin,p)*map.lightYearsPerHex;out.textContent=`${star?.name||`Hex ${p.q}, ${p.r}`} — ${Number(range.toFixed(4))} light-years`;confirm.disabled=range<=0;}
 button('+',()=>{camera.height=Math.max(5,camera.height*.75);apply();},tools);button('−',()=>{camera.height=Math.min(60000,camera.height*4/3);apply();},tools);
 button('Find Ship',()=>{camera={...xy(origin),height:18};apply();},tools);
 button('Fit Map',()=>{const points=[xy(origin),...map.stars.map(xy)],left=Math.min(...points.map(p=>p.x))-4,right=Math.max(...points.map(p=>p.x))+4,top=Math.min(...points.map(p=>p.y))-4,bottom=Math.max(...points.map(p=>p.y))+4;camera={x:(left+right)/2,y:(top+bottom)/2,height:Math.max(8,bottom-top,(right-left)*svg.clientHeight/svg.clientWidth)};apply();},tools);
 svg.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY,camera:{...camera},moved:false};svg.setPointerCapture(e.pointerId);};
 svg.onpointermove=e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>5)drag.moved=true;if(drag.moved){camera.x=drag.camera.x-dx*drag.camera.height/svg.clientHeight;camera.y=drag.camera.y-dy*drag.camera.height/svg.clientHeight;apply();}};
 svg.onpointerup=e=>{if(!drag||e.pointerId!==drag.id)return;const click=!drag.moved;drag=null;svg.releasePointerCapture(e.pointerId);if(click)choose(snap(world(e)));};svg.onpointercancel=()=>{drag=null;};
 svg.addEventListener('wheel',e=>{e.preventDefault();const p=world(e),old=camera.height;camera.height=Math.max(5,Math.min(60000,old*(e.deltaY>0?1.12:1/1.12)));camera.x=p.x+(camera.x-p.x)*camera.height/old;camera.y=p.y+(camera.y-p.y)*camera.height/old;apply();},{passive:false});
 for(const node of svg.querySelectorAll('[data-star]'))node.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(map.stars.find(s=>s.id===node.dataset.star));}};
 out.textContent='Choose a destination hex. Selection does not move the ship.';
 const observer=new ResizeObserver(apply);observer.observe(svg);apply();
 return ()=>{closed=true;observer.disconnect();host.replaceChildren();};
}
window.SACampaignMapChart={markup,xy,distance,picker};
}());
