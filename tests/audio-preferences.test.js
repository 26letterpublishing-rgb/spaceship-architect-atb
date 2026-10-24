const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../audio-mix.js'),'utf8');
function setup(values=new Map(),options={}){
 const sources=[],gains=[],events=[],tones=[],requests=[];let now=1000;
 const node=()=>({connect(to){this.output=to;},disconnect(){this.disconnected=true;}});
 const context={state:'running',currentTime:10,destination:{},resume:async()=>{},decodeAudioData:async()=>({}),
  createGain(){const n=Object.assign(node(),{gain:{setValueAtTime(value){this.value=value;},linearRampToValueAtTime(value){this.value=value;},exponentialRampToValueAtTime(value){this.value=value;}}});gains.push(n);return n;},
  createOscillator(){const n=Object.assign(node(),{frequency:{setValueAtTime(value){this.value=value;}},start(at){this.startAt=at;},stop(at){this.stopAt=at;if(at===undefined)this.onended?.();}});tones.push(n);return n;},
  createBufferSource(){const n=Object.assign(node(),{start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}});sources.push(n);return n;},
  createMediaElementSource:()=>node(),createDynamicsCompressor:()=>Object.assign(node(),Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,{}]))),createWaveShaper:node};
 const sandbox=vm.createContext({URL,Date:{now:()=>now},location:{href:'http://local/'},AudioContext:function(){return context;},
  localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},CustomEvent:function(type){this.type=type;},dispatchEvent:e=>events.push(e.type),
  document:{addEventListener(){},querySelectorAll:()=>[]},addEventListener(){},fetch:async url=>{requests.push(url);if(options.fail)throw Error('blocked');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 vm.runInContext(source,sandbox);return {mix:sandbox.SAAudioMix,context,gains,sources,tones,events,requests,advance:()=>now+=100,values};
}
test('defaults, category multiplication, mute balance and reload are browser-local',()=>{
 const s=setup(),m=s.mix;assert.equal(JSON.stringify(m.preferences()),'{"master":100,"game":100,"interface":30}');
 m.setPreferences({master:50,game:40,interface:30});assert.equal(m.level('game'),.2);assert.equal(m.level('interface'),.15);
 m.setMuted(true);assert.equal(m.level('game'),0);assert.equal(m.level('interface'),0);m.setMuted(false);assert.equal(m.level('game'),.2);
 assert.equal(setup(s.values).mix.level('interface'),.15);assert.equal(setup().mix.level('game'),1,'another browser retains its own preferences');
 m.setPreferences({game:0});assert.equal(m.level('game'),0);assert.equal(m.level('interface'),.15);
 m.setPreferences({game:100,interface:0});assert.equal(m.level('game'),.5);assert.equal(m.level('interface'),0);
 m.setPreferences({master:0,interface:30});assert.equal(m.level('game'),0);assert.equal(m.level('interface'),0);
});
test('active effects, clips and cinematic media use exactly one category output',async()=>{
 const s=setup(),m=s.mix;m.setPreferences({master:50,game:40});
 const bus=m.destination(s.context,'effect'),category=bus.output.output.output;assert.equal(bus.gain.value,3);assert.equal(category.gain.value,.2);
 await m.clip('game.wav',.85).finished;assert.equal(s.sources[0].output.gain.value,.85);assert.equal(s.sources[0].output.output,category);
 const media={pause(){this.paused=true;}};m.trackMedia(media,.85);assert.equal(media.volume,1);assert.equal(s.gains.at(-1).gain.value,.85);assert.equal(s.gains.at(-1).output,category);
 m.setPreferences({game:0});assert.equal(category.gain.value,0);m.setPreferences({game:80});assert.equal(category.gain.value,.4);
 m.releaseMedia(media);assert.equal(media.paused,true);
});
test('rapid interface clicks cancel previous audio without queuing; failures settle safely',async()=>{
 const s=setup(),m=s.mix;const first=m.buttonSound('robot');await first.finished;assert.equal(s.sources.length,1);
 assert.equal(m.buttonSound('chunk'),undefined);assert.equal(s.sources.length,1);s.advance();await m.buttonSound('whoosh').finished;
 assert.equal(s.sources[0].stopped,true);assert.equal(s.sources.length,2);assert.equal(s.sources[1].output.output.gain.value,.3);
 m.setMuted(true);assert.equal(s.sources[1].stopped,true);s.advance();assert.equal(m.buttonSound(),undefined);
 const failed=setup(new Map(),{fail:true}).mix.buttonSound();await assert.rejects(failed.finished);await failed.ended;
});
test('HTML media fallback respects live category and master changes',()=>{
 const s=setup();s.context.createMediaElementSource=()=>{throw Error('unsupported');};const media={pause(){}};
 s.mix.trackMedia(media,.5);s.mix.setPreferences({master:50,game:20});assert.equal(media.volume,.05);
 s.mix.setMuted(true);assert.equal(media.volume,0);s.mix.setMuted(false);assert.equal(media.volume,.05);
});

test('clock tones are single half-second notes with higher Play, interface volume, and mute',()=>{
 const s=setup();s.mix.setPreferences({master:50,interface:30});
 s.mix.buttonSound('pause-tone');assert.equal(s.tones.length,1);assert.equal(s.sources.length,0);
 const low=s.tones[0];assert.equal(low.frequency.value,330);assert.equal(low.stopAt-low.startAt,.5);assert.equal(low.output.output.gain.value,.15);
 s.advance();s.mix.buttonSound('play-tone');assert.equal(low.disconnected,true);assert.equal(s.tones.length,2);
 const high=s.tones[1];assert.equal(high.frequency.value,660);assert.equal(high.stopAt-high.startAt,.5);
 s.mix.setMuted(true);assert.equal(high.disconnected,true);s.advance();s.mix.buttonSound('play-tone');assert.equal(s.tones.length,2);
 s.mix.setMuted(false);s.mix.setPreferences({interface:0});s.advance();s.mix.buttonSound('pause-tone');assert.equal(s.tones.length,2);
});

test('volume previews use the requested clips/chime at the saved effective volume and replace prior previews',async()=>{
 const s=setup(),m=s.mix;m.setPreferences({master:50,game:40,interface:20});
 await m.previewVolume('interface').finished;assert.match(s.requests[0],/home-chunk-click.m4a$/);assert.equal(s.sources[0].output.output.gain.value,.1);
 await m.previewVolume('master').finished;assert.match(s.requests[1],/home-robot-click.m4a$/);assert.equal(s.sources[0].stopped,true);assert.equal(s.sources[1].output.output.gain.value,.1);
 m.previewVolume('game');assert.equal(s.sources[1].stopped,true);assert.deepEqual(s.tones.map(n=>n.frequency.value),[880,1320,1760]);assert.equal(s.tones[0].output.output.output.output.output.gain.value,.2);
 m.previewVolume('game');assert.ok(s.tones.slice(0,3).every(n=>n.disconnected));assert.equal(s.tones.length,6);
 m.setMuted(true);assert.ok(s.tones.every(n=>n.disconnected));m.previewVolume('game');await m.previewVolume('master').finished;assert.equal(s.tones.length,6);assert.equal(s.sources.length,2);
 m.setMuted(false);m.setPreferences({game:0,interface:0});m.previewVolume('game');await m.previewVolume('interface').finished;assert.equal(s.tones.length,6);assert.equal(s.sources.length,2);
 m.setPreferences({game:100,interface:30,master:0});m.previewVolume('game');await m.previewVolume('master').finished;assert.equal(s.tones.length,6);assert.equal(s.sources.length,2);
});
