(function(){
 let state,token,host,panel,name,select,text,status,toggle,revision=0,dirty=false,key='',gmList,saving=false,librarySaving=false;
 const own=()=>state?.ownCharacterId,entry=()=>state?.crewLogs?.find(l=>l.characterId===own()&&l.session===Number(select.value));
 async function request(body){const response=await fetch('/api/campaign/crew-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:state.code,token,...body})}),data=await response.json();if(!response.ok)throw Error(data.error);if(data.campaign)state=data.campaign;return data;}
 function button(label,callback){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await callback();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};return b;}
 const storageKey=()=>`sa-crew-log:${state.code}:${own()}:${select.value}`;
 function stash(){try{localStorage.setItem(storageKey(),JSON.stringify({name:name.value,text:text.value,revision,dirty}));localStorage.setItem(`sa-crew-log-name:${state.code}:${own()}`,name.value);}catch{}}
 function load(){const log=entry();let local=null,journal='Crew Log';try{local=JSON.parse(localStorage.getItem(storageKey()));journal=localStorage.getItem(`sa-crew-log-name:${state.code}:${own()}`)||journal;}catch{}
 name.value=log?.name||journal;text.value=log?.text||'';revision=log?.revision||0;dirty=false;
 if(local?.dirty){name.value=local.name;text.value=local.text;revision=local.revision;dirty=true;status.textContent='Restored your local draft. Save when connected.';}else status.textContent='';toggle.textContent=(state.characters?.find(r=>r.id===own())?.character?.identity?.characterName?.trim().split(/\s+/)[0]||'Crew')+"’s Log";}

 async function saveEntry(kind){
  if(saving){status.textContent='Finishing the current save. Your edits are still kept locally.';return;}
  const savedKey=storageKey(),savedSession=Number(select.value),savedCharacter=own(),sent={kind,name:name.value,text:text.value,session:savedSession,revision};
  saving=true;
  try{
   await request(sent);
   const saved=state.crewLogs?.find(log=>log.characterId===savedCharacter&&log.session===savedSession);
   const current=savedKey===storageKey(),unchanged=current&&name.value===sent.name&&text.value===sent.text;
   if(unchanged){try{localStorage.removeItem(savedKey);}catch{}load();status.textContent=kind==='submit'?'Sent to GM.':'Entry saved.';}
   else if(current){revision=saved?.revision??revision;dirty=true;stash();status.textContent='Earlier version saved. Your newer edits are kept here; save again when ready.';}
   else {
    // A response for another session must not clear the session now being edited.
    try{const local=JSON.parse(localStorage.getItem(savedKey)||'null');if(local?.name===sent.name&&local?.text===sent.text)localStorage.removeItem(savedKey);else if(local?.dirty){local.revision=saved?.revision??local.revision;localStorage.setItem(savedKey,JSON.stringify(local));}}catch{}
   }
  }finally{saving=false;}
 }

 function download(){const blob=new Blob([JSON.stringify({format:'Spaceship Architect Crew Log',name:name.value,session:Number(select.value),text:text.value},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Crew Log - Session '+select.value+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function mount(){
  host=document.createElement('span');host.className='crew-log-header';toggle=button('Crew Log',()=>{panel.hidden=false;if(!panel.open)panel.showModal();});panel=document.createElement('dialog');panel.className='crew-log-window';panel.setAttribute('aria-label','Crew Log');panel.onclose=()=>{panel.hidden=true;toggle.focus();};panel.hidden=true;
  name=document.createElement('input');name.setAttribute('aria-label','Journal name');name.maxLength=60;
  select=document.createElement('select');select.setAttribute('aria-label','Session');select.onchange=()=>{key=state.code+':'+own()+':'+select.value;load();};
  text=document.createElement('textarea');text.rows=16;text.maxLength=20000;text.setAttribute('aria-label','Session journal entry');
  name.oninput=text.oninput=()=>{dirty=true;stash();};
  status=document.createElement('p');status.setAttribute('role','status');
  const save=saveEntry;
  const file=document.createElement('input');file.type='file';file.accept='.json';file.hidden=true;file.onchange=async()=>{try{const data=JSON.parse(await file.files[0].text());if(data.format!=='Spaceship Architect Crew Log'||!Number.isInteger(data.session)||data.session<0||data.session>state.sessionNumber||typeof data.text!=='string')throw Error('Choose a Crew Log file for an existing session.');const existing=state.crewLogs?.find(l=>l.characterId===own()&&l.session===data.session);if(existing&&existing.text!==data.text&&!confirm('Replace the current entry with the imported entry?\n\nCURRENT: '+existing.text.slice(0,300)+'\n\nIMPORTED: '+data.text.slice(0,300)+'\n\nOK keeps imported; Cancel keeps current.'))return;select.value=data.session;load();name.value=data.name||'Crew Log';text.value=data.text;dirty=true;stash();await save('save');}catch(e){status.textContent=e.message;}finally{file.value='';}};
  panel.append(name,select,text,button('Save Entry',()=>save('save')),button('Send to GM',()=>save('submit')),button('Save Journal Entry',download),button('Load Journal Entries',()=>file.click()),file,status);panel.prepend(button('Close Crew Log',()=>panel.close()));host.append(toggle);document.querySelector('.creator-header').append(host);document.body.append(panel);
  new MutationObserver(()=>{host.hidden=!own()||!!document.querySelector('#characterCampaignGate')?.hidden;}).observe(document.querySelector('#characterCampaignGate'),{attributes:true,attributeFilter:['hidden']});
 }
 function gm(){
  if(!gmList){gmList=document.createElement('section');gmList.className='tool-card';gmList.dataset.gmLibrary='';document.querySelector('#promptTab .tool-grid')?.append(gmList);}
  const signature=JSON.stringify([state.crewLogs,state.libraryEntries]);if(gmList.dataset.signature===signature)return;gmList.dataset.signature=signature;
  const draftTitle=gmList.querySelector('[aria-label="Data Entry title"]')?.value||'',draftText=gmList.querySelector('[aria-label="Library data"]')?.value||'';
  gmList.replaceChildren();const title=document.createElement('h3');title.textContent='Crew Logs & Library Data';gmList.append(title);
  for(const log of state.crewLogs||[]){if(!log.submittedAt)continue;const detail=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('p');summary.textContent=log.characterName+' — Session '+log.session+(log.approvedAt?' / Approved':' / Awaiting approval');body.textContent=log.text;body.style.whiteSpace='pre-wrap';detail.append(summary,body);if(!log.approvedAt)detail.append(button('Approve (+1 Reverence)',async()=>{await request({kind:'approve',id:log.id});gm();}));gmList.append(detail);}
  const label=document.createElement('input');label.placeholder='Data Entry title';label.setAttribute('aria-label','Data Entry title');label.value=draftTitle;const content=document.createElement('textarea');content.placeholder='Library data';content.setAttribute('aria-label','Library data');content.value=draftText;const message=document.createElement('p');status=message;
  const publish=button('Add to Library',async()=>{
   if(librarySaving)return;librarySaving=true;
   const sent={kind:'data',title:label.value,text:content.value};
   try{await request(sent);const currentTitle=gmList.querySelector('[aria-label="Data Entry title"]'),currentText=gmList.querySelector('[aria-label="Library data"]');if(currentTitle.value===sent.title&&currentText.value===sent.text){currentTitle.value='';currentText.value='';}status.textContent='Added to all Library consoles.';}
   finally{librarySaving=false;const current=gmList.querySelector('[data-publish-library]');if(current)current.disabled=false;}
  });publish.dataset.publishLibrary='';publish.disabled=librarySaving;
  gmList.append(label,content,publish,message);window.SAOrganizeGmTools?.();
 }
 window.SACrewLogs={update(next,keyToken){state=next;token=keyToken;if(state.role==='gm'){gm();return;}if(!own()){if(host)host.hidden=true;return;}if(!host)mount();host.hidden=!own()||!!document.querySelector('#characterCampaignGate')?.hidden;const value=select.value||String(state.sessionNumber);if(select.options.length!==state.sessionNumber+1){select.replaceChildren(...Array.from({length:state.sessionNumber+1},(_,n)=>new Option('Session '+n,n)));select.value=value;}if(key!==state.code+':'+own()+':'+select.value||!dirty){key=state.code+':'+own()+':'+select.value;load();}}};
}());
