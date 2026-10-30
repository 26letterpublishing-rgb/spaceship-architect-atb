const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function mediaFixture(){
 const media=[],values=new Map();let now=0,fetches=0,reject=false;
 const audio={state:'running',destination:{},resume:async()=>{},createMediaElementSource:m=>({connect(n){m.sourceOutput=n;},disconnect(){}}),createGain:()=>({gain:{},connect(n){this.output=n;},disconnect(){}})};
 const root={URL,Date:{now:()=>now},location:{href:'http://localhost/viewer'},SAAudioMixOptions:{clipTransport:'media'},AudioContext:function(){return audio;},Audio:function(url){this.src=url;this.paused=true;this.play=()=>{this.paused=false;return reject?Promise.reject(Error('blocked')):Promise.resolve();};this.pause=()=>{this.paused=true;};media.push(this);},SABrowserStorage:{local:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}},localStorage:{getItem(){throw Error('personal storage');}},fetch(){fetches++;throw Error('CSP forbids fetch');},document:{addEventListener(){},querySelectorAll:()=>[]},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../audio-mix.js'),'utf8'),root);
 return {mix:root.SAAudioMix,media,root,advance:()=>now+=100,fail:()=>reject=true,fetches:()=>fetches};
}
test('opt-in media clips use one master/category bus and settle on end, mute, replacement and rejection',async()=>{
 const f=mediaFixture(),m=f.mix;m.setPreferences({master:50,interface:40});
 const first=m.buttonSound('chunk');await first.finished;assert.match(f.media[0].src,/home-chunk-click\.m4a$/);assert.equal(f.media[0].volume,1);assert.equal(f.media[0].sourceOutput.gain.value,1);assert.equal(f.media[0].sourceOutput.output.gain.value,.2);assert.equal(f.media[0].paused,false);
 assert.equal(m.buttonSound('robot'),undefined,'rapid duplicate suppressed');f.advance();const second=m.buttonSound('robot');await second.finished;await first.ended;assert.equal(f.media[0].paused,true);assert.match(f.media[1].src,/home-robot-click\.m4a$/);
 f.media[1].onended();await second.ended;assert.equal(f.media[1].paused,true);
 f.advance();const third=m.buttonSound('whoosh');await third.finished;m.setMuted(true);await third.ended;assert.equal(f.media[2].paused,true);f.advance();assert.equal(m.buttonSound(),undefined);
 m.setMuted(false);m.setPreferences({interface:0});assert.equal(m.buttonSound(),undefined);m.setPreferences({interface:40});f.advance();const restored=m.buttonSound();await restored.finished;m.stopButtonSound();await restored.ended;assert.equal(f.media[3].paused,true);
 f.fail();f.advance();const failed=m.buttonSound();await assert.rejects(failed.finished,/blocked/);await failed.ended;assert.equal(f.media[4].paused,true);assert.equal(f.fetches(),0);
});
test('media fallback volume is multiplied once and child close stops the parent-owned button clip',async()=>{
 const f=mediaFixture();delete f.root.AudioContext;f.mix.setPreferences({master:50,interface:40});const h=f.mix.clip('test.m4a',.5,'interface');await h.finished;assert.equal(f.media[0].volume,.1);f.mix.setPreferences({master:100});assert.equal(f.media[0].volume,.2);h.stop();await h.ended;
 const parent=f.mix;f.advance();const b=parent.buttonSound();await b.finished;const child={parent:{SAAudioMix:parent},document:{addEventListener(){}},addEventListener(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../audio-mix.js'),'utf8'),child);child.SAAudioMix.stopButtonSound();await b.ended;assert.equal(f.media.at(-1).paused,true);
});
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

test('sensor ping gates gesture/Game/master/mute and cleans up its effects-bus voice',()=>{
 const f=mediaFixture(),nodes=[],param=()=>({setValueAtTime(v,t){this.value=v;},linearRampToValueAtTime(v,t){this.peak=v;},exponentialRampToValueAtTime(v,t){this.end=v;},cancelScheduledValues(){}});
 const c=f.mix.context();c.currentTime=2;c.createOscillator=()=>{const n={frequency:param(),connect(to){this.output=to;},disconnect(){this.disconnected=true;},start(){this.started=true;},stop(){this.stopped=true;}};nodes.push(n);return n;};c.createGain=()=>({gain:param(),connect(to){this.output=to;},disconnect(){}});c.createDynamicsCompressor=()=>({threshold:{},knee:{},ratio:{},attack:{},release:{},connect(to){this.output=to;}});c.createWaveShaper=()=>({connect(to){this.output=to;}});
 f.root.navigator={userActivation:{hasBeenActive:false}};assert.equal(f.mix.sensorPing(),undefined);assert.equal(nodes.length,0);
 f.root.navigator.userActivation.hasBeenActive=true;f.mix.setPreferences({master:50,game:40});const h=f.mix.sensorPing();assert.ok(h);assert.equal(nodes[0].type,'sine');assert.equal(nodes[0].frequency.value,880);assert.equal(nodes[0].frequency.end,660);assert.equal(nodes[0].output.gain.peak,.025);assert.equal(nodes[0].output.output.output.output.output.gain.value,.2,'master × Game once');h.stop();assert.ok(nodes[0].stopped&&nodes[0].disconnected);h.stop();
 for(const patch of [{master:0},{master:100,game:0}]){f.mix.setPreferences(patch);assert.equal(f.mix.sensorPing(),undefined);}f.mix.setPreferences({game:100});const active=f.mix.sensorPing();f.mix.setMuted(true);assert.ok(nodes.at(-1).stopped);assert.equal(f.mix.sensorPing(),undefined);f.mix.setMuted(false);c.state='suspended';assert.equal(f.mix.sensorPing(),undefined);assert.equal(nodes.length,2);
});
