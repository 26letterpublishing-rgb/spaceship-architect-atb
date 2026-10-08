// Shared effects bus: lift quiet UI sounds without boosting protected alarm/explosion clips.
(function(root){
  const contexts=new WeakMap();
  const profiles={effect:2,character:2.4,ambient:1.5,launch:1};
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
  root.SAAudioMix={destination,profiles};
})(globalThis);
