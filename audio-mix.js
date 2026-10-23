// Shared effects bus: lift quiet UI sounds without boosting protected alarm/explosion clips.
(function(root){
  if(root.SAAudioMix)return;
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
  function clip(url,volume=1){
    let cancelled=false,source=null;
    const finished=(async()=>{
      const c=context();if(!c)return;
      const key=new URL(url,root.location.href).href;
      if(!clips.has(key))clips.set(key,fetch(key).then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(b=>c.decodeAudioData(b)).catch(error=>{clips.delete(key);throw error;}));
      const buffer=await clips.get(key);if(cancelled)return;
      await c.resume();if(cancelled)return;
      source=c.createBufferSource();source.buffer=buffer;const gain=c.createGain();gain.gain.value=volume;
      source.connect(gain);gain.connect(c.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();
    })();
    finished.catch(()=>{});
    return {finished,stop(){cancelled=true;try{source?.stop();}catch{}}};
  }
  const contexts=new WeakMap();
  const profiles={effect:3,character:4,ambient:2,launch:1};
  function destination(context,profile='effect'){
    let buses=contexts.get(context);
    if(!buses){buses=new Map();contexts.set(context,buses);}
    if(buses.has(profile))return buses.get(profile);
    const gain=context.createGain(),compressor=context.createDynamicsCompressor();
    gain.gain.value=profiles[profile]||profiles.effect;
    compressor.threshold.value=-10;compressor.knee.value=12;compressor.ratio.value=8;
    compressor.attack.value=.003;compressor.release.value=.18;
    // Bounded output also protects against several effects sounding at once.
    const limiter=context.createWaveShaper();
    limiter.curve=Float32Array.from({length:4097},(_,i)=>{const x=i/2048-1;return Math.max(-.95,Math.min(.95,x));});
    gain.connect(compressor);compressor.connect(limiter);limiter.connect(context.destination);
    buses.set(profile,gain);return gain;
  }
  let effectContext;
  function success(){
    try{if(localStorage.getItem('sa-atb-alerts')==='off'||localStorage.getItem('sa-atb-gm-muted')==='on')return;
      const c=effectContext ||= context();void c.resume();
      [440,660,880,1320].forEach((hz,i)=>{const o=c.createOscillator(),g=c.createGain(),start=c.currentTime+i*.085;o.type='sine';o.frequency.setValueAtTime(hz,start);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.035,start+.015);g.gain.exponentialRampToValueAtTime(.001,start+.22);o.connect(g);g.connect(destination(c,'effect'));o.start(start);o.stop(start+.24);});
    }catch{}
  }
  function navigation(kind='click'){
    try{if(localStorage.getItem('sa-atb-alerts')==='off'||localStorage.getItem('sa-atb-gm-muted')==='on')return;
      const c=effectContext ||= context();void c.resume();const o=c.createOscillator(),g=c.createGain(),t=c.currentTime,d=kind==='travel'?.45:kind==='view'?.2:.075;
      o.type=kind==='travel'?'triangle':'sine';o.frequency.setValueAtTime(kind==='travel'?130:kind==='view'?520:820,t);o.frequency.exponentialRampToValueAtTime(kind==='travel'?360:kind==='view'?1040:640,t+d);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.024,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(destination(c,'effect'));o.start(t);o.stop(t+d+.02);
    }catch{}
  }
  root.SAAudioMix={destination,profiles,success,navigation,context,unlock,clip};
})(globalThis);
