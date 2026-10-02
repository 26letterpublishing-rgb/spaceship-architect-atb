(function(){
 let banner,toast,damage,activity,lastDamage='',first=true;const seen=new Set();
 function announce(text,detected=false){
  if(!activity)return;activity.textContent=text;activity.classList.toggle('detection-alert',detected);
  if(!activity.matches(':popover-open'))activity.showPopover();
  clearTimeout(activity.hideTimer);activity.hideTimer=setTimeout(()=>{if(activity.matches(':popover-open'))activity.hidePopover();},8000);
  if(detected){const bridge=window.SACombatBridge||[...document.querySelectorAll('iframe')].map(f=>{try{return f.contentWindow.SACombatBridge;}catch{return null;}}).find(Boolean);if(bridge?.soundEnabled()){bridge.resumeAudio?.();bridge.alertSound?.();}}
 }
 function place(){
  if(!banner)return;
  let doc=document;try{while(doc.defaultView.frameElement)doc=doc.defaultView.parent.document;}catch{}
  if(!doc.querySelector('link[data-fleet-notices-style]')){const link=doc.createElement('link');link.href=new URL('fleet-notices.css',location.href);link.rel='stylesheet';link.dataset.fleetNoticesStyle='';doc.head.append(link);}
  const host=[...doc.querySelectorAll('dialog[open]')].at(-1)||doc.body;
  if(banner.parentElement!==host){const visible=banner.matches(':popover-open');if(visible)banner.hidePopover();host.append(banner);if(visible)banner.showPopover();}
  if(damage&&damage.parentElement!==host){const visible=damage.matches(':popover-open');if(visible)damage.hidePopover();host.append(damage);if(visible)damage.showPopover();}
  if(activity&&activity.parentElement!==host){const visible=activity.matches(':popover-open');if(visible)activity.hidePopover();host.append(activity);if(visible)activity.showPopover();}
  if(toast.parentElement!==host){const visible=toast.matches(':popover-open');if(visible)toast.hidePopover();host.append(toast);if(visible)toast.showPopover();}
 }
 let queued=false;
 new MutationObserver(records=>{if(queued||!records.some(r=>r.target instanceof HTMLDialogElement||[...r.addedNodes,...r.removedNodes].some(n=>n instanceof HTMLDialogElement)))return;queued=true;requestAnimationFrame(()=>{queued=false;place();});}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});
 function update(environment){
  const status=environment?.notices||{lockedShips:[],repairs:[]};
  if(!banner){
   const link=document.createElement('link');link.rel='stylesheet';link.href='fleet-notices.css';document.head.append(link);
   banner=document.createElement('div');banner.className='enemy-lock-banner';banner.setAttribute('role','alert');banner.setAttribute('popover','manual');banner.textContent='Enemy Locked On';document.body.append(banner);
   toast=document.createElement('div');toast.className='drone-repair-notice';toast.setAttribute('role','status');toast.setAttribute('popover','manual');document.body.append(toast);
   damage=document.createElement('div');damage.className='damaged-systems-warning';damage.setAttribute('role','status');damage.setAttribute('popover','manual');document.body.append(damage);
   activity=document.createElement('div');activity.className='combat-activity-banner';activity.setAttribute('role','status');activity.setAttribute('popover','manual');document.body.append(activity);
  }
  place();
  const locked=Boolean(status.lockedShips?.length);document.body.classList.toggle('has-enemy-lock',locked);
  const damaged=status.damagedSystems||[],signature=JSON.stringify(damaged);document.body.classList.toggle('has-damaged-systems',damaged.length>0);
  if(signature!==lastDamage){lastDamage=signature;damage.replaceChildren();const lamp=document.createElement('span');lamp.className='damaged-system-light';lamp.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent='Damaged systems: '+damaged.map(i=>`${i.shipTitle} — ${i.name}${i.status==='destroyed'?' (destroyed)':''}`).join('; ');damage.append(lamp,label);damage.title=label.textContent;}
  if(damaged.length&&!damage.matches(':popover-open'))damage.showPopover();
  if(!damaged.length&&damage.matches(':popover-open'))damage.hidePopover();
  banner.title=(status.lockedShips||[]).map(s=>s.title).join(', ');
  if(locked&&!banner.matches(':popover-open'))banner.showPopover();
  if(!locked&&banner.matches(':popover-open'))banner.hidePopover();
  const fresh=(entries,prefix)=>(entries||[]).filter(e=>{const key=prefix+e.id;if(seen.has(key))return false;seen.add(key);return !first&&e.at&&Date.now()-Date.parse(e.at)<15000;});
  const events=fresh(status.activity,'activity:'),detections=fresh(status.detections,'detect:');
  if(events.length)announce(events.at(-1).text);
  if(detections.length)announce(detections.at(-1).text,true);
  const intrusions=fresh(status.intrusions,'intrusion:');
  if(intrusions.length)announce(intrusions.at(-1).text,true);
  for(const report of [...(status.repairs||[])].reverse()){
   if(seen.has(report.id))continue;seen.add(report.id);
   if(first||Date.now()-Date.parse(report.at)>10000)continue;
   toast.replaceChildren();const die=document.createElement('b');die.className='repair-d4';die.dataset.sides=report.die||4;die.textContent=report.roll;die.setAttribute('aria-label','D'+(report.die||4)+' rolled '+report.roll);
   const text=document.createElement('span');text.textContent=`${report.title}: +${report.healed} Hull`;toast.append(die,text);
   if(!toast.matches(':popover-open'))toast.showPopover();
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)die.animate([{transform:'rotate(-120deg) scale(.7)'},{transform:'rotate(20deg) scale(1.1)'},{transform:'rotate(0) scale(1)'}],{duration:750});
   clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>{if(toast.matches(':popover-open'))toast.hidePopover();},3500);
  }
  first=false;
  window.dispatchEvent(new CustomEvent('sa-drone-update',{detail:status.drones||[]}));
 }
 window.SAFleetNotices={update};
 if(document.getElementById('unitList')){const timer=setInterval(()=>{const notices=window.SACombatBridge?.state()?.fleetNotices;if(notices)update({notices});},250);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});}
}());
