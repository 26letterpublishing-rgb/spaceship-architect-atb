(function(){
 let banner,toast,damage,activity,lastDamage='',first=true;const seen=new Set();
 function dismiss(node,fn=()=>{}){node.append(window.SAInterfaceNotices.closeButton(node,fn,'Dismiss alert'));}
 function visible(node,show){if(node.hidden===!show)return;node.hidden=!show;window.SAInterfaceNotices.host().schedule();}
 function announce(text,detected=false){
  if(!activity)return;activity.textContent=text;dismiss(activity);activity.classList.toggle('detection-alert',detected);
  visible(activity,true);
  clearTimeout(activity.hideTimer);activity.hideTimer=setTimeout(()=>visible(activity,false),8000);
  if(detected){const bridge=window.SACombatBridge||[...document.querySelectorAll('iframe')].map(f=>{try{return f.contentWindow.SACombatBridge;}catch{return null;}}).find(Boolean);if(bridge?.soundEnabled()){bridge.resumeAudio?.();bridge.alertSound?.();}}
 }
 function place(){
  if(!banner||!window.SAInterfaceNotices)return;
  const host=window.SAInterfaceNotices.host();
  for(const [node,key] of [[banner,'enemy-lock'],[damage,'damaged-systems'],[activity,'combat-activity'],[toast,'drone-repair']])host.mount(node,key);
  const doc=banner.ownerDocument;if(!doc.querySelector('link[data-fleet-notices-style]')){const link=doc.createElement('link');link.href=new URL('fleet-notices.css',location.href);link.rel='stylesheet';link.dataset.fleetNoticesStyle='';doc.head.append(link);}
 }
 function update(environment){
  if(!window.SAInterfaceNotices)return;
  const dismissal=window.SAInterfaceNotices.host().fleetDismissals??={damage:'',lock:''};
  const status=environment?.notices||{lockedShips:[],repairs:[]};
  if(!banner){
   const link=document.createElement('link');link.rel='stylesheet';link.href='fleet-notices.css';link.dataset.fleetNoticesStyle='';document.head.append(link);
   banner=document.createElement('div');banner.className='enemy-lock-banner';banner.setAttribute('role','alert');banner.hidden=true;banner.textContent='Enemy Locked On';dismiss(banner,()=>dismissal.lock=banner.title);document.body.append(banner);
   toast=document.createElement('div');toast.className='drone-repair-notice';toast.setAttribute('role','status');toast.hidden=true;document.body.append(toast);
   damage=document.createElement('div');damage.className='damaged-systems-warning';damage.setAttribute('role','status');damage.hidden=true;document.body.append(damage);
   activity=document.createElement('div');activity.className='combat-activity-banner';activity.setAttribute('role','status');activity.hidden=true;document.body.append(activity);
  }
  place();
  const locked=Boolean(status.lockedShips?.length);document.body.classList.toggle('has-enemy-lock',locked);
  const damaged=status.damagedSystems||[],signature=JSON.stringify(damaged);document.body.classList.toggle('has-damaged-systems',damaged.length>0);
  if(signature!==lastDamage){lastDamage=signature;damage.replaceChildren();const lamp=document.createElement('span');lamp.className='damaged-system-light';lamp.setAttribute('aria-hidden','true');const label=document.createElement('span');label.textContent='Damaged systems: '+damaged.map(i=>`${i.shipTitle} — ${i.name}${i.status==='destroyed'?' (destroyed)':''}`).join('; ');damage.append(lamp,label);dismiss(damage,()=>dismissal.damage=signature);damage.title=label.textContent;}
  visible(damage,damaged.length>0&&dismissal.damage!==signature);
  if(!damaged.length)dismissal.damage='';
  banner.title=(status.lockedShips||[]).map(s=>s.title).join(', ');
  visible(banner,locked&&dismissal.lock!==banner.title);
  if(!locked)dismissal.lock='';
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
   dismiss(toast);visible(toast,true);
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)die.animate([{transform:'rotate(-120deg) scale(.7)'},{transform:'rotate(20deg) scale(1.1)'},{transform:'rotate(0) scale(1)'}],{duration:750});
   clearTimeout(toast.hideTimer);toast.hideTimer=setTimeout(()=>visible(toast,false),3500);
  }
  first=false;
  window.dispatchEvent(new CustomEvent('sa-drone-update',{detail:status.drones||[]}));
 }
 window.addEventListener('pagehide',()=>{for(const node of [banner,toast,damage,activity]){clearTimeout(node?.hideTimer);node?.remove();}window.SAInterfaceNotices?.host().refresh();});
 window.SAFleetNotices={update};
 if(document.getElementById('unitList')){const timer=setInterval(()=>{const notices=window.SACombatBridge?.state()?.fleetNotices;if(notices)update({notices});},250);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});}
}());
