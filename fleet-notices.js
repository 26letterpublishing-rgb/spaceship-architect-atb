(function(){
 let first=true,sequence=0,previous=new Set();const seen=new Set();
 function update(environment){
   const status=environment?.notices;if(!status)return;
   const current=new Set(),alerts=[...(status.critical||[]),...(status.lockedShips||[]).map(s=>({key:'lock:'+s.id,text:s.title+': Enemy Locked-On!',type:'danger'}))];
   for(const alert of alerts){current.add(alert.key);if(!previous.has(alert.key)&&(!first||alert.key.startsWith('lock:')))window.SAResultFeedback?.critical(alert.key+':'+(++sequence),alert.text,alert.type);}
   previous=current;
   for(const [entries,prefix]of [[status.detections,'detect:'],[status.intrusions,'intrusion:']])for(const e of entries||[]){const key=prefix+e.id;if(seen.has(key))continue;seen.add(key);if(!first&&e.at&&Date.now()-Date.parse(e.at)<30000)window.SAResultFeedback?.critical(key,e.text,prefix==='detect:'?'detection':'danger');}
   // Ordinary activity and repair results remain in their existing logs.
   first=false;window.dispatchEvent(new CustomEvent('sa-drone-update',{detail:status.drones||[]}));
 }
 window.SAFleetNotices={update};
 window.addEventListener('sa-combat-state',()=>{const notices=window.SACombatBridge?.state()?.fleetNotices;if(notices)update({notices});});
}());
