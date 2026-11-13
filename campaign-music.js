(()=>{
 'use strict';
 if(window.top!==window&&!window.frameElement?.hasAttribute('data-explore-perspective'))return;
 let state=null,select=null,songs=null,player=null,panel=null,enabled=false,generation=0,loading=null;
 const songId=()=>state?.settings?.musicSong||'contact';
 const say=text=>{if(panel)panel.querySelector('[data-music-status]').textContent=text;};
 function render(){
  if(!panel)return;
  panel.querySelector('[data-music-on]').checked=enabled;
  panel.querySelector('[data-music-on]').disabled=!songs;
  for(const button of panel.querySelectorAll('[data-music-song]')){button.setAttribute('aria-pressed',String(button.dataset.musicSong===songId()));button.disabled=!songs;}
  panel.querySelector('.campaign-song-selector').hidden=!select;
 }
 async function play(){
  if(!enabled||!songs)return;
  const song=songs.find(s=>s.id===songId());if(!song)return;
  const ticket=++generation;
  player??=SACombatMusic.create({resolveUrl:(stem,s)=>'music/'+s.id+'/'+encodeURIComponent(stem.file)});
  say('Loading '+song.title+'…');
  try{const result=await player.play(song,'one');if(ticket!==generation||!enabled||!result)return;player.setEnabled(window.SAExploreSession?.active?.()!==false);say('Playing '+song.title+'.');}
  catch(error){if(ticket!==generation)return;enabled=false;player.stop();render();say('Music could not start. Turn it on to retry.');}
 }
 function mount(){
  const host=document.querySelector('.audio-settings-card')||document.querySelector('.sound-settings-card');
  if(!host)return;
  if(!panel){panel=document.createElement('section');panel.className='campaign-music-controls';panel.dataset.uiSound='none';panel.innerHTML='<h3>Music</h3><div class="campaign-song-selector" role="group" aria-label="Shared song"><button type="button" data-music-song="contact"><span>Contact</span></button><button type="button" data-music-song="onslaught"><span>Onslaught</span></button><button type="button" data-music-song="eldritch"><span>Eldritch</span></button></div><label><input type="checkbox" data-music-on> Music on this device</label><p data-music-status role="status">Music is off.</p>';host.append(panel);
   panel.querySelector('[data-music-on]').onchange=e=>{enabled=e.target.checked;render();if(enabled)void play();else{generation++;player?.stop();say('Music is off.');}};
   for(const button of panel.querySelectorAll('[data-music-song]'))button.onclick=async()=>{if(!select)return;button.disabled=true;try{await select(button.dataset.musicSong);}catch{say('Song selection was not saved. Try again.');}finally{render();}};
  }
  render();
 }
 function update(next,options={}){
  const previous=state?.settings?.musicSong||'contact';state=next;select=next.role==='gm'?options.select||null:null;mount();
  if(!loading){loading=fetch('data/combat-music-tracks.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{songs=data.songs;mount();}).catch(()=>{loading=null;say('Song list unavailable.');});}
  if(previous!==songId()){if(enabled)void play();else say('Selected '+(songs?.find(s=>s.id===songId())?.title||songId())+'. Music is off.');}
 }
 window.addEventListener('sa-perspective-visibility',()=>player?.setEnabled(enabled&&window.SAExploreSession?.active?.()!==false));
 window.addEventListener('pagehide',()=>{generation++;player?.dispose();enabled=false;});
 window.SACampaignMusic={update};
})();
