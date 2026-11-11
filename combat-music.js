// Playback foundation only. Combat selection and intensity rules are deliberately external.
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SACombatMusic=api;
})(globalThis,()=>{
  function validate(song,phase){
    const preset=song?.mixes?.[phase],names=song?.stems?.map(s=>s.name);
    if(!names?.length||new Set(names).size!==names.length||!preset||!Number.isFinite(preset.master)||preset.master<0||preset.master>100||!(preset.solo===null||names.includes(preset.solo)))throw Error('Invalid music mix');
    for(const name of names){const s=preset.stems?.[name];if(!s||typeof s.on!=='boolean'||!Number.isFinite(s.level)||s.level<0||s.level>100)throw Error('Invalid music stem level');}
    return preset;
  }
  function create({mix=globalThis.SAAudioMix,fetchAudio=globalThis.fetch,resolveUrl=s=>s.file,fadeSeconds=1.5}={}){
    const fade=Math.max(0,Math.min(10,Number(fadeSeconds)||0)),groups=new Set(),envelopes=new WeakMap();
    let active=null,request=0,controller=null,disposed=false,enabled=true,pendingCompile=null;
    function ramp(node,to,seconds=fade,at){
      const c=mix.context(),now=at??c.currentTime,p=node.gain,e=envelopes.get(node);
      const value=e?e.from+(e.to-e.from)*Math.max(0,Math.min(1,(now-e.at)/(e.seconds||1e-9))):p.value;
      p.cancelScheduledValues(now);p.setValueAtTime(value,now);p.linearRampToValueAtTime(to,now+seconds);
      envelopes.set(node,{from:value,to,at:now,seconds});
    }
    function release(group){
      if(!groups.delete(group))return;clearTimeout(group.timer);
      for(const voice of group.voices){try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();voice.source.buffer=null;}
      group.gain.disconnect();group.voices=[];
    }
    function retire(group,seconds=fade){if(!group)return;ramp(group.gain,0,seconds);clearTimeout(group.timer);if(!seconds)release(group);else group.timer=setTimeout(()=>release(group),seconds*1000+100);}
    function apply(group,phase){
      validate(group.song,phase);group.phase=phase;
      for(const voice of group.voices)ramp(voice.gain,voice.name===phase?1:0);
    }
    async function play(song,phase){
      if(disposed)throw Error('Music player disposed');validate(song,phase);
      const id=++request;controller?.abort();controller=new AbortController();const signal=controller.signal;
      const c=mix.context();if(!c)throw Error('Web Audio unavailable');
      // Resume immediately in the initiating gesture, before asynchronous asset loading.
      await c.resume();if(c.state!=='running')throw Error('Audio is blocked; activate Play to retry');
      if(disposed||id!==request)return null;
      if(active?.song===song){apply(active,phase);return status();}
      // Serialize superseded loads and let any outgoing fade finish before allocating
      // another song. At most the selected song plus one incoming/outgoing song exists.
      if(pendingCompile)try{await pendingCompile;}catch{}
      while(groups.size>1&&!disposed&&id===request)await new Promise(resolve=>setTimeout(resolve,50));
      if(disposed||id!==request)return null;
      const task=compile(song,c,fetchAudio,resolveUrl,signal,()=>disposed||id!==request);pendingCompile=task;
      let compiled;try{compiled=await task;}finally{if(pendingCompile===task)pendingCompile=null;}
      if(!compiled||disposed||id!==request)return null;
      const {buffers,duration}=compiled;
      const group={song,phase,duration,start:c.currentTime+.08,gain:c.createGain(),voices:[]};
      group.gain.gain.value=0;group.gain.connect(mix.musicOutput(c));groups.add(group);
      try{
        for(const entry of buffers){const source=c.createBufferSource(),gain=c.createGain();source.buffer=entry.buffer;source.loop=true;source.loopStart=0;source.loopEnd=duration;gain.gain.value=0;source.connect(gain);gain.connect(group.gain);group.voices.push({name:entry.name,source,gain});}
        apply(group,phase);for(const voice of group.voices)voice.source.start(group.start,0);
        ramp(group.gain,enabled?1:0,fade,group.start);
      }catch(error){release(group);throw error;}
      const previous=active;active=group;retire(previous);return status();
    }
    function setMix(phase){if(!active)throw Error('No music loaded');apply(active,phase);}
    function setEnabled(value){enabled=Boolean(value);for(const group of groups)ramp(group.gain,group===active&&enabled?1:0);}
    function stop(){request++;controller?.abort();controller=null;const old=active;active=null;for(const group of groups)retire(group);return Boolean(old);}
    function dispose(){if(disposed)return;disposed=true;request++;controller?.abort();for(const group of [...groups])release(group);active=null;globalThis.removeEventListener?.('pagehide',dispose);}
    function status(){return {song:active?.song.id||null,phase:active?.phase||null,enabled,voices:active?.voices.length||0,duration:active?.duration||0,disposed};}
    globalThis.addEventListener?.('pagehide',dispose);
    return {play,setMix,setEnabled,stop,dispose,status};
  }
  // Compile fixed authored mixes without keeping all raw stems alive. No normalization,
  // limiting, resampling, or re-encoding: authored master and per-stem gains are baked once.
  async function compile(song,c,fetchAudio,resolveUrl,signal,cancelled=()=>false){
    const phases=Object.keys(song.mixes||{});if(!phases.length||phases.length>4)throw Error('Expected at most four authored mixes');
    const presets=phases.map(phase=>validate(song,phase));let buffers=null,duration=Infinity,rate,channels;
    let yieldAt=performance.now();
    for(const stem of song.stems){
      if(cancelled()||signal.aborted)return null;
      const response=await fetchAudio(resolveUrl(stem,song),{signal});if(!response.ok)throw Error('Music stem unavailable');
      const buffer=await c.decodeAudioData(await response.arrayBuffer());
      if(cancelled()||signal.aborted)return null;
      if(!(buffer.duration>0))throw Error('Empty music stem');
      if(!buffers){rate=buffer.sampleRate;channels=buffer.numberOfChannels;buffers=phases.map(name=>({name,buffer:c.createBuffer(channels,buffer.length,rate)}));}
      if(buffer.sampleRate!==rate||buffer.numberOfChannels!==channels)throw Error('Music stems must share sample rate and channel count');
      duration=Math.min(duration,buffer.duration);
      const weights=presets.map(p=>{const s=p.stems[stem.name];return s.on&&(!p.solo||p.solo===stem.name)?p.master*s.level/10000:0;});
      for(let channel=0;channel<channels;channel++){
        const input=buffer.getChannelData(channel),outputs=buffers.map(b=>b.buffer.getChannelData(channel)),length=Math.min(input.length,outputs[0].length);
        for(let offset=0;offset<length;offset+=32768){
          if(cancelled()||signal.aborted)return null;
          const end=Math.min(length,offset+32768);
          for(let phase=0;phase<phases.length;phase++){const weight=weights[phase];if(!weight)continue;const output=outputs[phase];for(let i=offset;i<end;i++)output[i]+=input[i]*weight;}
          if(performance.now()-yieldAt>=6){await new Promise(resolve=>setTimeout(resolve,0));yieldAt=performance.now();}
        }
      }
    }
    return {buffers,duration};
  }
  return {create,validate,compile};
});
