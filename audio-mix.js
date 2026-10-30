// Shared effects bus: lift quiet UI sounds without boosting protected alarm/explosion clips.
(function(root){
  if(root.SAAudioMix)return;
  const busesToMute=new Set(),activeClips=new Set(),mediaTracks=new Map();
  const preferenceKey='sa-audio-levels-v1',defaults={master:100,game:100,interface:30};
  const storage=()=>root.SABrowserStorage?.local||root.localStorage;
  function preferences(){let saved={};try{saved=JSON.parse(storage()?.getItem(preferenceKey)||'{}')||{};}catch{}
    return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,Number.isFinite(saved[key])?Math.max(0,Math.min(100,saved[key])):value]));}
  function isMuted(){try{return storage()?.getItem('sa-atb-alerts')==='off'||storage()?.getItem('sa-atb-gm-muted')==='on';}catch{return false;}}
  function level(category='game'){const p=preferences();return isMuted()?0:p.master*p[category]/10000;}
  function notify(){root.dispatchEvent?.(new root.CustomEvent('sa-audio-change'));}
  function setPreferences(patch){const p=preferences();for(const key of Object.keys(defaults))if(Number.isFinite(patch[key]))p[key]=Math.max(0,Math.min(100,patch[key]));try{storage()?.setItem(preferenceKey,JSON.stringify(p));}catch{}refreshMute();notify();return p;}
  function setMuted(muted){try{storage()?.setItem('sa-atb-alerts',muted?'off':'on');storage()?.setItem('sa-atb-gm-muted',muted?'on':'off');}catch{}refreshMute();notify();}
  function refreshMute(localOnly=false){
    if(!localOnly){try{if(root.parent&&root.parent!==root&&root.parent.SAAudioMix){root.parent.SAAudioMix.refreshMute();}}catch{}}
    for(const bus of busesToMute)bus.node.gain.value=level(bus.category);
    for(const [media,track] of mediaTracks)if(track.fallback)media.volume=track.volume*level(track.category);
    if(isMuted()){for(const clip of [...activeClips])clip.stop();for(const media of root.document?.querySelectorAll?.('audio,video')||[])media.pause();}
    if(!localOnly)for(const frame of root.document?.querySelectorAll?.('iframe')||[]){try{frame.contentWindow?.SAAudioMix?.refreshMute(true);}catch{}}
  }
  root.addEventListener?.('storage',event=>{if([preferenceKey,'sa-atb-alerts','sa-atb-gm-muted'].includes(event.key)){refreshMute();notify();}});
  const categoryBuses=new WeakMap();
  function output(c,category='game'){let buses=categoryBuses.get(c);if(!buses){buses=new Map();categoryBuses.set(c,buses);}if(buses.has(category))return buses.get(category);
    const node=c.createGain();node.gain.value=level(category);node.connect(c.destination);buses.set(category,node);busesToMute.add({node,category});return node;}
  function trackMedia(media,volume=1,category='game'){if(mediaTracks.has(media))return;const track={volume,category};mediaTracks.set(media,track);
    try{const c=context();track.source=c.createMediaElementSource(media);track.gain=c.createGain();track.gain.gain.value=volume;media.volume=1;track.source.connect(track.gain);track.gain.connect(output(c,category));}
    catch{track.fallback=true;media.volume=volume*level(category);}}
  function releaseMedia(media){const t=mediaTracks.get(media);if(!t)return;media.pause();t.source?.disconnect();t.gain?.disconnect();mediaTracks.delete(media);}
  let sharedContext;
  function context(){
    try{if(root.parent&&root.parent!==root&&root.parent.SAAudioMix)return root.parent.SAAudioMix.context();}catch{}
    if(!sharedContext||sharedContext.state==='closed'){const Context=root.AudioContext||root.webkitAudioContext;if(!Context)return null;sharedContext=new Context();}
    if(sharedContext.state!=='running')void sharedContext.resume().catch(()=>{});
    return sharedContext;
  }
  function unlock(){try{const c=context();if(!c)return;const buffer=c.createBuffer(1,1,c.sampleRate),source=c.createBufferSource();source.buffer=buffer;source.connect(c.destination);source.start();source.onended=()=>source.disconnect();}catch{}}
  for(const event of ['pointerup','touchend','keydown'])root.document?.addEventListener(event,unlock,{capture:true,passive:true});
  root.addEventListener?.('pageshow',()=>{if(sharedContext)void sharedContext.resume().catch(()=>{});});
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='visible'&&sharedContext)void sharedContext.resume().catch(()=>{});});
  const clips=new Map();
  // Explicit opt-in for the isolated viewer, whose CSP forbids fetch. Normal
  // application callers keep the existing decoded-buffer transport below.
  const mediaClips=root.SAAudioMixOptions?.clipTransport==='media';
  function mediaClip(url,volume,category){
    let media,settle,done=false;
    const ended=new Promise(resolve=>{settle=resolve;});
    const handle={stop(){if(done)return;done=true;if(media){media.onended=null;media.onerror=null;releaseMedia(media);}activeClips.delete(handle);settle();},ended};
    activeClips.add(handle);
    const finished=(async()=>{
      if(!level(category)){handle.stop();return;}
      media=new root.Audio(new URL(url,root.location.href).href);
      media.onended=media.onerror=()=>handle.stop();
      trackMedia(media,volume,category);
      // Start in the trusted activation turn; do not await loading or fetch.
      await media.play();
      if(done||!level(category))handle.stop();
    })();
    finished.catch(()=>handle.stop());handle.finished=finished;return handle;
  }
  function clip(url,volume=1,category='game'){
    if(mediaClips)return mediaClip(url,volume,category);
    let cancelled=false,source=null,settle;
    const ended=new Promise(resolve=>{settle=resolve;});
    const handle={stop(){cancelled=true;try{source?.stop();}catch{}activeClips.delete(handle);settle();},ended};
    activeClips.add(handle);
    const finished=(async()=>{
      if(!level(category)){handle.stop();return;}
      const c=context();if(!c){handle.stop();return;}
      const key=new URL(url,root.location.href).href;
      if(!clips.has(key))clips.set(key,fetch(key).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).catch(error=>{clips.delete(key);throw error;}));
      const buffer=await clips.get(key);if(cancelled||!level(category)){handle.stop();return;}
      await c.resume();if(cancelled||!level(category)){handle.stop();return;}
      source=c.createBufferSource();source.buffer=buffer;const gain=c.createGain();gain.gain.value=volume;
      source.connect(gain);gain.connect(output(c,category));source.onended=()=>{source.disconnect();gain.disconnect();activeClips.delete(handle);settle();};source.start();
    })();
    finished.catch(()=>{activeClips.delete(handle);settle();});
    handle.finished=finished;return handle;
  }
  const contexts=new WeakMap();
  const profiles={effect:3,character:4,ambient:2,launch:1};
  function destination(context,profile='effect'){
    let buses=contexts.get(context);
    if(!buses){buses=new Map();contexts.set(context,buses);}
    if(buses.has(profile))return buses.get(profile);
    const gain=context.createGain(),compressor=context.createDynamicsCompressor();
    const volume=profiles[profile]||profiles.effect;
    gain.gain.value=volume;
    compressor.threshold.value=-10;compressor.knee.value=12;compressor.ratio.value=8;
    compressor.attack.value=.003;compressor.release.value=.18;
    // Bounded output also protects against several effects sounding at once.
    const limiter=context.createWaveShaper();
    limiter.curve=Float32Array.from({length:4097},(_,i)=>{const x=i/2048-1;return Math.max(-.95,Math.min(.95,x));});
    gain.connect(compressor);compressor.connect(limiter);limiter.connect(output(context));
    buses.set(profile,gain);return gain;
  }
  let effectContext;
  function success(){
    try{if(localStorage.getItem('sa-atb-alerts')==='off'||localStorage.getItem('sa-atb-gm-muted')==='on')return;
      const c=effectContext ||= context();void c.resume();
      [440,660,880,1320].forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain(),start=c.currentTime+i*.085;o.type='sine';o.frequency.setValueAtTime(hz,start);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.035,start+.015);g.gain.exponentialRampToValueAtTime(.001,start+.22);o.connect(g);g.connect(destination(c,'effect'));o.start(start);o.stop(start+.24);});
    }catch{}
  }
  // Shared with the real turn alert so the Game Sounds preview stays identical.
  function turnDing(){
    try{
      if(!level('game'))return;
      const c=context();if(!c)return;
      const nodes=[],handle={stop(){for(const n of nodes){try{n.osc.stop();}catch{}}activeClips.delete(handle);}};
      activeClips.add(handle);let remaining=3;
      for(const [hz,delay,duration,volume,type] of [[880,0,.22,.28,'sine'],[1320,.12,.28,.24,'sine'],[1760,.28,.2,.18,'triangle']]){
        const osc=c.createOscillator(),gain=c.createGain(),at=c.currentTime+delay;nodes.push({osc,gain});
        osc.type=type;osc.frequency.setValueAtTime(hz,at);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
        osc.connect(gain);gain.connect(destination(c,'effect'));
        osc.onended=()=>{osc.disconnect();gain.disconnect();if(!--remaining)activeClips.delete(handle);};osc.start(at);osc.stop(at+duration+.02);
      }
      return handle;
    }catch{} // A blocked audio context must never interrupt play or settings.
  }
  let volumePreview;
  function previewVolume(category){
    try{
      if(root.parent&&root.parent!==root&&root.parent.SAAudioMix)return root.parent.SAAudioMix.previewVolume(category);
      volumePreview?.stop();volumePreview=null;
      if(!['master','game','interface'].includes(category))return;
      volumePreview=category==='game'?turnDing():clip(buttonFiles[category==='master'?'robot':'chunk'],1,'interface');
      return volumePreview;
    }catch{}
  }
  let interfaceClip,lastButtonAt=-Infinity;
  const buttonFiles={chunk:'home-chunk-click.m4a',robot:'home-robot-click.m4a',whoosh:'home-whoosh-click.m4a'};
  function stopButtonSound(){
    try{if(root.parent&&root.parent!==root&&root.parent.SAAudioMix)return root.parent.SAAudioMix.stopButtonSound();}catch{}
    interfaceClip?.stop();interfaceClip=null;
  }
  function clockTone(high){
    const c=context();if(!c)return;
    const oscillator=c.createOscillator(),gain=c.createGain(),at=c.currentTime;
    oscillator.type='sine';oscillator.frequency.setValueAtTime(high?660:330,at);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.22,at+.025);gain.gain.setValueAtTime(.22,at+.43);gain.gain.linearRampToValueAtTime(0,at+.5);
    oscillator.connect(gain);gain.connect(output(c,'interface'));
    const handle={stop(){try{oscillator.stop();}catch{}activeClips.delete(handle);}};
    activeClips.add(handle);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();activeClips.delete(handle);};
    oscillator.start(at);oscillator.stop(at+.5);return handle;
  }
  function buttonSound(kind='chunk'){
    try{if(root.parent&&root.parent!==root&&root.parent.SAAudioMix)return root.parent.SAAudioMix.buttonSound(kind);}catch{}
    const now=Date.now();if(now-lastButtonAt<90||!level('interface'))return;lastButtonAt=now;
    interfaceClip?.stop();try{interfaceClip=['pause-tone','play-tone'].includes(kind)?clockTone(kind==='play-tone'):clip(buttonFiles[kind]||buttonFiles.chunk,1,'interface');}catch{}return interfaceClip;
  }
  function navigation(kind='click'){return buttonSound(kind==='click'?'chunk':'whoosh');}
  // Existing Console tick waveform. Callers retain their gating and node ownership.
  function consoleTick(audio,nodes){
    const osc=audio.createOscillator(),gain=audio.createGain(),node={osc,gain};
    nodes.add(node);osc.type='sine';
    osc.frequency.setValueAtTime(1180,audio.currentTime);
    gain.gain.setValueAtTime(0,audio.currentTime);
    gain.gain.linearRampToValueAtTime(.012,audio.currentTime+.01);
    gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.025);
    osc.connect(gain);gain.connect(destination(audio,'effect'));
    osc.onended=()=>{nodes.delete(node);try{osc.disconnect();gain.disconnect();}catch{}};
    osc.start(audio.currentTime);osc.stop(audio.currentTime+.025+.02);
  }
  // Short local scan feedback; the existing Game bus applies volume exactly once.
  function sensorPing(){
    try{
      if(!level('game')||root.navigator?.userActivation?.hasBeenActive===false)return;
      const c=context();if(!c||c.state!=='running')return;
      const osc=c.createOscillator(),gain=c.createGain(),at=c.currentTime;
      let stopped=false;
      const cleanup=()=>{osc.disconnect();gain.disconnect();activeClips.delete(handle);};
      const handle={stop(){if(stopped)return;stopped=true;gain.gain.cancelScheduledValues(c.currentTime);gain.gain.setValueAtTime(0,c.currentTime);try{osc.stop();}catch{}cleanup();}};
      osc.type='sine';osc.frequency.setValueAtTime(880,at);osc.frequency.exponentialRampToValueAtTime(660,at+.32);
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.025,at+.015);gain.gain.exponentialRampToValueAtTime(.0001,at+.42);
      osc.connect(gain);gain.connect(destination(c,'effect'));osc.onended=()=>{stopped=true;cleanup();};
      activeClips.add(handle);osc.start(at);osc.stop(at+.44);return handle;
    }catch{} // Autoplay denial or a closed context must never affect a scan.
  }
  root.SAAudioMix={destination,profiles,success,navigation,context,unlock,clip,refreshMute,preferences,setPreferences,isMuted,setMuted,level,trackMedia,releaseMedia,buttonSound,stopButtonSound,turnDing,previewVolume,consoleTick,sensorPing};
  root.SABrowserStorage?.ready?.then(()=>{refreshMute();notify();});
})(globalThis);
