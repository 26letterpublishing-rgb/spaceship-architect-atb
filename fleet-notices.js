(function(){
 let first=true,sequence=0,previous=new Set();const seen=new Set();let impairmentCounts=new Map(),knownShips=new Set();const offlineShips=new Set(),offlineSeen=new Set();
 function update(environment){
   const status=environment?.notices;if(!status)return;
   const current=new Set(),alerts=[...(status.critical||[]),...(status.lockedShips||[]).map(s=>({key:'lock:'+s.id,text:s.title+': Enemy Locked-On!',type:'danger'}))];
   for(const alert of alerts){current.add(alert.key);if(!previous.has(alert.key)&&(!first||alert.key.startsWith('lock:')))window.SAResultFeedback?.critical(alert.key+':'+(++sequence),alert.text,alert.type);}
   previous=current;
   if(Array.isArray(status.drones)){const authorized=new Set(status.drones.map(s=>s.id));for(const id of offlineShips)if(!authorized.has(id))offlineShips.delete(id);}
   for(const ship of status.sicOffline||[]){
     const baseline=first||!offlineShips.has(ship.shipId);
     for(const event of [...(ship.events||[])].reverse()){
       if(offlineSeen.has(event.id))continue;offlineSeen.add(event.id);
       if(!baseline)window.SAResultFeedback?.critical('sic-offline:'+event.id,event.text,'warning');
     }
     offlineShips.add(ship.shipId);
   }
   for(const [entries,prefix]of [[status.detections,'detect:'],[status.intrusions,'intrusion:'],[status.lockLosses,'lock-loss:']])for(const e of entries||[]){const key=prefix+e.id;if(seen.has(key))continue;seen.add(key);if(!first&&e.at&&Date.now()-Date.parse(e.at)<30000)window.SAResultFeedback?.critical(key,e.text,prefix==='detect:'?'detection':prefix==='lock-loss:'?'warning':'danger');}
   const nextCounts=new Map(),nextShips=Array.isArray(status.drones)?new Set(status.drones.map(s=>s.id)):knownShips;
   for(const system of status.damagedSystems||[]){
     const key=JSON.stringify([system.shipId,system.sicId]),count=Math.min(4,Math.max(0,Number(system.impairmentPoints)||0));
     nextCounts.set(key,count);
     const before=impairmentCounts.get(key)||0;
     if(!first&&knownShips.has(system.shipId)&&count>before)window.SAResultFeedback?.critical('sic-impairment:'+key+':'+(++sequence),system.shipTitle+': '+system.name+' gained '+(count-before)+' impairment'+(count-before===1?'':'s')+' ('+count+' total).','warning');
   }
   impairmentCounts=nextCounts;knownShips=nextShips;
   // Ordinary activity and repair results remain in their existing logs.
   first=false;window.dispatchEvent(new CustomEvent('sa-drone-update',{detail:status.drones||[]}));
 }
 window.SAFleetNotices={update};
 window.addEventListener('sa-combat-state',()=>{const notices=window.SACombatBridge?.state()?.fleetNotices;if(notices)update({notices});});
}());
