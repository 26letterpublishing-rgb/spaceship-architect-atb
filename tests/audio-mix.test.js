const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('mute stops active and loading clips, silences buses, and reaches embedded screens',async()=>{
 const values=new Map(),listeners={};let started=0,stopped=0,childRefresh=0,resolveFetch;
 const audio={state:'running',destination:{},resume:async()=>{},decodeAudioData:async()=>({}),createGain:()=>({gain:{},connect(to){this.output=to;},disconnect(){}}),createBufferSource:()=>({connect(to){this.output=to;},disconnect(){},start(){started++;},stop(){stopped++;this.onended?.();}}),createDynamicsCompressor:()=>({connect(to){this.output=to;},threshold:{},knee:{},ratio:{},attack:{},release:{}}),createWaveShaper:()=>({connect(to){this.output=to;}})};
 const sandbox=vm.createContext({URL,location:{href:'http://localhost/'},AudioContext:function(){return audio;},localStorage:{getItem:k=>values.get(k)},document:{addEventListener(){},querySelectorAll:s=>s==='iframe'?[{contentWindow:{SAAudioMix:{refreshMute:()=>childRefresh++}}}]:[]},addEventListener:(name,fn)=>listeners[name]=fn,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
 vm.runInContext(fs.readFileSync(require.resolve('../audio-mix.js'),'utf8'),sandbox);const mix=sandbox.SAAudioMix,bus=mix.destination(audio,'effect');
 const active=mix.clip('alarm.mp4');await active.finished;assert.equal(started,1);
 values.set('sa-atb-gm-muted','on');mix.refreshMute();assert.equal(stopped,1);assert.equal(bus.output.output.output.gain.value,0);assert.equal(childRefresh,1);
 await mix.clip('alarm.mp4').finished;assert.equal(started,1);
 values.set('sa-atb-gm-muted','off');listeners.storage({key:'sa-atb-gm-muted'});assert.equal(bus.output.output.output.gain.value,1);assert.equal(started,1,'unmute does not restart the old alarm');
 sandbox.fetch=()=>new Promise(resolve=>resolveFetch=resolve);const pending=mix.clip('slow.mp4');
 values.set('sa-atb-alerts','off');mix.refreshMute();values.set('sa-atb-alerts','on');mix.refreshMute();
 resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await pending.finished;assert.equal(started,1,'muting during loading cancels the pending sound');
 await mix.clip('alarm.mp4').finished;assert.equal(started,2,'future sounds play normally after unmute');
});
test('effects reuse their compression bus, lift quiet dice, and keep launch gain unchanged',()=>{
  const sandbox=vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../audio-mix.js'),'utf8'),sandbox);
  function context(){
    const nodes=[];
    const node=type=>{const n={type,connect(to){this.output=to;return to;}};nodes.push(n);return n;};
    return {nodes,destination:{type:'speakers'},createGain:()=>Object.assign(node('gain'),{gain:{}}),
      createDynamicsCompressor:()=>Object.assign(node('compressor'),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,{}]))),createWaveShaper:()=>node('limiter')};
  }
  const audio=context(),mix=sandbox.SAAudioMix;
  const dice=mix.destination(audio,'character');
  assert.equal(dice.gain.value,4);
  assert.equal(mix.destination(audio,'character'),dice);
  assert.equal(audio.nodes.length,4,'one persistent balancing bus plus one shared category output');
  assert.equal(dice.output.type,'compressor');assert.equal(dice.output.ratio.value,8);
  assert.ok([...dice.output.output.curve].every(x=>Math.abs(x)<=.951));
  assert.equal(dice.output.output.output.gain.value,1);assert.equal(dice.output.output.output.output,audio.destination);
  assert.equal(mix.destination(audio,'launch').gain.value,1);
  assert.notEqual(mix.destination(context(),'character'),dice,'different AudioContexts never share nodes');
});

test('Safari gesture unlock reuses the same audio context across embedded screens',()=>{
 const listeners={};let count=0,starts=0,resumes=0;
 const audio={state:'suspended',sampleRate:44100,destination:{},resume(){resumes++;this.state='running';return Promise.resolve();},createBuffer(){return {};},createBufferSource(){return {connect(){},start(){starts++;},disconnect(){}};}};
 const source=fs.readFileSync(require.resolve('../audio-mix.js'),'utf8');
 const parent=vm.createContext({webkitAudioContext:function(){count++;return audio;},document:{addEventListener(name,fn){listeners[name]=fn;}},addEventListener(){}});
 vm.runInContext(source,parent);listeners.touchend();assert.equal(count,1);assert.equal(starts,1);assert.ok(resumes);
 const child=vm.createContext({parent,document:{addEventListener(){}},addEventListener(){}});vm.runInContext(source,child);assert.equal(child.SAAudioMix.context(),audio);assert.equal(count,1);
 audio.state='interrupted';child.SAAudioMix.unlock();assert.equal(audio.state,'running');assert.equal(starts,2);
});

test('clip completion settles after natural playback, mute, and loading failure',async()=>{
 let source,fail=false;const values=new Map();
 const context={state:'running',destination:{},resume:async()=>{},decodeAudioData:async()=>({}),createGain:()=>({gain:{},connect(to){this.output=to;},disconnect(){}}),createBufferSource:()=>source={connect(to){this.output=to;},disconnect(){},start(){},stop(){this.onended?.();}}};
 const sandbox=vm.createContext({URL,location:{href:'http://localhost/'},AudioContext:function(){return context;},localStorage:{getItem:k=>values.get(k)},document:{addEventListener(){},querySelectorAll:()=>[]},addEventListener(){},fetch:async()=>{if(fail)throw Error('offline');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 vm.runInContext(fs.readFileSync(require.resolve('../audio-mix.js'),'utf8'),sandbox);
 const mix=sandbox.SAAudioMix,clip=mix.clip('confirm.m4a');let ended=false;clip.ended.then(()=>ended=true);await clip.finished;assert.equal(ended,false);source.onended();await clip.ended;assert.equal(ended,true);
 const muted=mix.clip('confirm.m4a');await muted.finished;values.set('sa-atb-alerts','off');mix.refreshMute();await muted.ended;
 values.clear();fail=true;const failed=mix.clip('missing.m4a');await assert.rejects(failed.finished);await failed.ended;
});
