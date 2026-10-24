(function(){
 const types=['Underworld Contact','Smuggler','Security Contact','Government Insider','Corporate Insider','Military Contact','Merchant','Dockworker','Bartender / Innkeeper','Journalist','Scientist / Researcher','Medical Contact','Explorer / Scout','Community Contact','Other'];
 function collectContacts(previous=[]){return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='informant-dialog';
  const heading=document.createElement('h2');heading.textContent='Create your five Informant contacts';
  const intro=document.createElement('p');intro.textContent='Give each contact a name and type. Your GM will receive a permanent inbox message to incorporate them into the Story Console.';
  const form=document.createElement('form');
  const rows=Array.from({length:5},(_,i)=>{const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Contact '+(i+1);const name=document.createElement('input');name.required=true;name.maxLength=100;name.placeholder='Contact name';name.setAttribute('aria-label','Contact '+(i+1)+' name');name.value=previous[i]?.name||'';const select=document.createElement('select');select.setAttribute('aria-label','Contact '+(i+1)+' type');for(const type of types)select.add(new Option(type,type));const other=document.createElement('input');other.maxLength=100;other.placeholder='Other contact type';other.setAttribute('aria-label','Contact '+(i+1)+' other type');select.value=types.includes(previous[i]?.type)?previous[i].type:previous[i]?.type?'Other':types[0];other.value=select.value==='Other'?previous[i]?.type||'':'';const change=()=>{other.hidden=select.value!=='Other';other.required=!other.hidden;};select.onchange=change;change();row.append(legend,name,select,other);form.append(row);return {name,select,other};});
  const status=document.createElement('p');status.setAttribute('role','status');const submit=document.createElement('button');submit.type='submit';submit.textContent='Save Contacts and Finish';form.append(status,submit);form.onsubmit=e=>{e.preventDefault();const result=rows.map(r=>({name:r.name.value.trim(),type:(r.select.value==='Other'?r.other.value:r.select.value).trim()}));if(result.some(x=>!x.name||!x.type)){status.textContent='Enter all five names and types.';return;}dialog.close();dialog.remove();resolve(result);};
  // This is a required creation choice. Closing suspends the form rather than completing it.
  dialog.addEventListener('cancel',e=>{e.preventDefault();for(let i=0;i<rows.length;i++)previous[i]={name:rows[i].name.value.trim(),type:rows[i].select.value==='Other'?rows[i].other.value.trim():rows[i].select.value};dialog.close();dialog.remove();resolve(null);});dialog.append(heading,intro,form);document.body.append(dialog);dialog.showModal();
 });}
 const seenCombat=new Set();
 function update(state){
  const announcement=state.combatAnnouncement;
  if(announcement&&!seenCombat.has(announcement.id)){seenCombat.add(announcement.id);if(Date.now()-announcement.at<15000){window.SAResultFeedback?.critical(announcement.id,'All hands on deck','combat-start');try{if(localStorage.getItem('sa-atb-alerts')!=='off'&&localStorage.getItem('sa-atb-gm-muted')!=='on'){window.SAAudioMix.clip('alarm-noise.mp4',.72);}}catch{}}}

  const host=document.querySelector('#settingsTab .settings-grid')||document.getElementById('playerSettingsPanel');if(!host)return;
  let section=document.getElementById('inMemoriam');if(!section){section=document.createElement('section');section.id='inMemoriam';section.className='settings-card';host.insertBefore(section,host.querySelector('.settings-card:has(#kickCharacter)')||host.querySelector('.danger-settings'));}
  const signature=JSON.stringify(state.memorials||[]);if(section.dataset.signature===signature)return;section.dataset.signature=signature;section.replaceChildren();const title=document.createElement('h2');title.textContent='In Memoriam';section.append(title);
  if(!state.memorials?.length){const p=document.createElement('p');p.textContent='No confirmed character deaths.';section.append(p);}
  for(const entry of state.memorials||[]){const card=document.createElement('article');card.className='memorial-card';const icon=document.createElement('span');icon.innerHTML=window.SATokenArt?.figure(entry.raceId,entry.presentation?.iconVariant)||'';const text=document.createElement('p');text.textContent=entry.name+' - '+entry.playerName+' | '+entry.race+' | '+entry.className+' | Session '+entry.session+' | Campaign day '+(Math.floor(entry.elapsedMinutes/1440)+1);card.append(icon,text);section.append(card);}
 }
 window.SACharacterLifecycle={collectContacts,update};
}());
