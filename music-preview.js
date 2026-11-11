(() => {
 'use strict';
 const $=id=>document.getElementById(id),mix=window.SAAudioMix;
 let songs=[],player=null,generation=0,closed=false;
 const phase=()=>$('shield').checked?'shielded':$('hull').value;
 const say=text=>{$('status').textContent=text;};
 const syncMute=()=>{$('mute').setAttribute('aria-pressed',String(mix.isMuted()));$('mute').textContent=mix.isMuted()?'Unmute':'Mute';};
 $('mute').onclick=()=>mix.setMuted(!mix.isMuted());window.addEventListener('sa-audio-change',syncMute);syncMute();
 $('play').onclick=async()=>{
  const song=songs.find(s=>s.id===$('song').value);if(!song)return;
  const ticket=++generation;
  player??=SACombatMusic.create({resolveUrl:(stem,s)=>'debug-music/'+s.id+'/'+encodeURIComponent(stem.file)});
  say('Loading '+song.title+'… Stop cancels this request.');
  try{const result=await player.play(song,phase());if(closed||ticket!==generation||!result)return;player.setMix(phase());say('Playing '+song.title+' — '+phase()+' mix.');}
  catch(error){if(closed||ticket!==generation)return;say('Could not load or start music. '+(player.status().song?'The previous song is retained. ':'')+'Press Play to retry. '+error.message);}
 };
 const adjust=()=>{if(player?.status().song){player.setMix(phase());say('Playing '+songs.find(s=>s.id===player.status().song)?.title+' — '+phase()+' mix.');}};
 $('shield').onchange=adjust;$('hull').onchange=adjust;
 $('song').onchange=()=>{say('Selected '+$('song').selectedOptions[0].textContent+'. Press Play to load; any current song continues meanwhile.');};
 $('stop').onclick=()=>{generation++;player?.dispose();player=null;say('Stopped. Audio resources released.');};
 const cleanup=()=>{closed=true;generation++;player?.dispose();player=null;window.removeEventListener('sa-audio-change',syncMute);};
 window.addEventListener('pagehide',cleanup,{once:true});
 fetch('data/combat-music-mixes.json').then(r=>{if(!r.ok)throw Error('Song list unavailable');return r.json();}).then(c=>{
  if(closed)return;songs=c.songs;for(const song of songs){const option=document.createElement('option');option.value=song.id;option.textContent=song.title;$('song').append(option);}$('song').disabled=false;$('play').disabled=false;say('Ready. No music is loaded until Play.');
 }).catch(()=>say('Song list unavailable. Reload this Debug page to retry.'));
})();
