const test=require('node:test'),assert=require('node:assert/strict'),music=require('../combat-music'),catalog=require('../data/combat-music-mixes.json');
function fixture(){
 const voices=[],gains=[],bus={},requests=[];let fail=false,blocked=false;
 const param=()=>({value:0,events:[],cancelScheduledValues(t){this.events.push(['cancel',t]);},setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);},linearRampToValueAtTime(v,t){this.events.push(['ramp',v,t]);}});
 const buffer=(channels,length,rate)=>{const data=Array.from({length:channels},()=>new Float32Array(length));return {numberOfChannels:channels,length,sampleRate:rate,duration:length/rate,getChannelData:i=>data[i]};};
 const c={createBuffer:buffer,state:'running',currentTime:10,resume:async()=>{c.state=blocked?'suspended':'running';},decodeAudioData:async()=>{const b=buffer(2,120,1);b.getChannelData(0).fill(.1);b.getChannelData(1).fill(.2);return b;},createGain(){const n={gain:param(),connect(to){this.to=to;},disconnect(){this.disconnected=true;}};gains.push(n);return n;},createBufferSource(){const n={connect(to){this.to=to;},disconnect(){this.disconnected=true;},start(t,offset){this.at=t;this.offset=offset;},stop(){this.stopped=true;}};voices.push(n);return n;}};
 const player=music.create({mix:{context:()=>c,musicOutput:()=>bus},fetchAudio:async url=>{requests.push(url);if(fail)throw Error('offline');return{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 return {player,c,voices,gains,bus,requests,fail:()=>fail=true,block:()=>blocked=true};
}
test('all twelve mixes retain validated explicit levels, including different Eldritch masters',()=>{
 assert.deepEqual(catalog.songs.map(s=>s.title),['Contact','Onslaught','Eldritch']);
 for(const song of catalog.songs)for(const phase of ['shielded','three','two','one'])assert.equal(music.validate(song,phase),song.mixes[phase]);
 assert.equal(catalog.songs[2].mixes.shielded.master,100);assert.equal(catalog.songs[2].mixes.one.master,25);
 assert.equal(catalog.songs[0].mixes.shielded.stems.Drums.level,18);
});
test('four compiled mixes start on one audio-clock boundary and changes preserve phase',async t=>{
 const f=fixture();t.after(()=>f.player.dispose());const song=catalog.songs[0];await f.player.play(song,'shielded');
 assert.equal(f.voices.length,4);assert.ok(f.voices.every(v=>v.at===10.08&&v.offset===0&&v.loopEnd===120&&v.loop));assert.equal(f.gains[0].to,f.bus);
 const shielded=f.voices[0];assert.equal(shielded.to.gain.events.at(-1)[1],1);const weight=Object.values(song.mixes.shielded.stems).filter(s=>s.on).reduce((sum,s)=>sum+s.level*.25/100,0);assert.ok(Math.abs(shielded.buffer.getChannelData(0)[0]-.1*weight)<1e-6);
 f.c.currentTime=11;f.player.setMix('one');assert.equal(f.voices.length,4);assert.equal(shielded.to.gain.events.at(-1)[1],0);assert.equal(f.voices[3].to.gain.events.at(-1)[1],1);assert.equal(f.player.status().phase,'one');
 f.player.setEnabled(false);assert.equal(f.gains[0].gain.events.at(-1)[1],0);f.player.setEnabled(true);assert.equal(f.gains[0].gain.events.at(-1)[1],1);
});
test('song crossfade overlaps aligned new stems and ramps the old group out',async t=>{
 const f=fixture();t.after(()=>f.player.dispose());await f.player.play(catalog.songs[0],'three');f.c.currentTime=20;await f.player.play(catalog.songs[1],'two');
 assert.equal(f.voices.length,8);assert.ok(f.voices.slice(4).every(v=>v.at===20.08));assert.equal(f.gains[0].gain.events.at(-1)[1],0);assert.equal(f.player.status().song,'onslaught');
 f.player.dispose();assert.ok(f.voices.every(v=>v.stopped&&v.disconnected&&v.buffer===null));assert.equal(f.player.status().voices,0);
});
test('failed switch retains current song; invalid mix and blocked autoplay cannot start voices',async t=>{
 const f=fixture();t.after(()=>f.player.dispose());await f.player.play(catalog.songs[0],'shielded');f.fail();await assert.rejects(f.player.play(catalog.songs[1],'one'),/offline/);assert.equal(f.player.status().song,'contact');assert.equal(f.voices.length,4);
 assert.throws(()=>f.player.setMix('invented'),/Invalid/);assert.equal(f.player.status().phase,'shielded');
 const b=fixture();t.after(()=>b.player.dispose());b.block();await assert.rejects(b.player.play(catalog.songs[0],'one'),/blocked/);assert.equal(b.voices.length,0);
});
test('dispose during pending start prevents late starts',async()=>{
 const f=fixture();const pending=f.player.play(catalog.songs[0],'one');f.player.dispose();assert.equal(await pending,null);assert.equal(f.voices.length,0);await assert.rejects(f.player.play(catalog.songs[0],'one'),/disposed/);
});

test('compiled samples equal authored weighted sums without normalization, with aligned shortest loop',async()=>{
 const rows=[[.2,-.4,.6,-.8,1,-1,.3,.1],[.1,.2,-.3,.4,-.5,.6]],original=structuredClone(rows);
 const make=data=>({sampleRate:4,numberOfChannels:2,length:data.length,duration:data.length/4,getChannelData:channel=>Float32Array.from(data,n=>channel?-n:n)});
 let index=0;const c={decodeAudioData:async()=>make(rows[index++]),createBuffer(channels,length,rate){const data=Array.from({length:channels},()=>new Float32Array(length));return {sampleRate:rate,numberOfChannels:channels,length,duration:length/rate,getChannelData:i=>data[i]};}};
 const mixes=Object.fromEntries(['shielded','three','two','one'].map((name,i)=>[name,{master:25*(i+1),solo:i===1?'b':null,stems:{a:{on:i!==0,level:50},b:{on:true,level:70}}}]));
 const result=await music.compile({stems:[{name:'a'},{name:'b'}],mixes},c,async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),s=>s.name,new AbortController().signal);
 assert.equal(result.duration,1.5);assert.equal(result.buffers.length,4);
 for(const entry of result.buffers){const p=mixes[entry.name];for(let channel=0;channel<2;channel++)for(let i=0;i<6;i++){
  const expected=(channel?-1:1)*(rows[0][i]*(p.stems.a.on&&!p.solo?.includes('b')?p.master*.5/100:0)+rows[1][i]*p.master*.7/100);
  assert.ok(Math.abs(entry.buffer.getChannelData(channel)[i]-expected)<1e-7,entry.name+' sample '+i);
 }}
 assert.deepEqual(rows,original);
});

test('cancelled decode produces no compiled result and malformed channel alignment rejects',async()=>{
 let finish,started;const ready=new Promise(r=>started=r),controller=new AbortController();
 const pending=music.compile(catalog.songs[0],{decodeAudioData:()=>{started();return new Promise(r=>finish=r);}},async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(0)}),s=>s.file,controller.signal);
 await ready;controller.abort();finish({duration:10});assert.equal(await pending,null);
 const f=fixture();let count=0;const decode=f.c.decodeAudioData;f.c.decodeAudioData=async()=>{const b=await decode();if(count++)b.sampleRate=2;return b;};
 await assert.rejects(f.player.play(catalog.songs[0],'one'),/sample rate/);assert.equal(f.voices.length,0);f.player.dispose();
});

test('rapid third song waits for outgoing fade and never retains three song groups',async t=>{
 const f=fixture();t.after(()=>f.player.dispose());await f.player.play(catalog.songs[0],'one');await f.player.play(catalog.songs[1],'two');
 const next=f.player.play(catalog.songs[2],'three');await new Promise(r=>setTimeout(r,30));assert.equal(f.voices.length,8);
 await next;assert.equal(f.voices.length,12);assert.ok(f.voices.slice(0,4).every(v=>v.stopped&&v.buffer===null));assert.ok(f.voices.filter(v=>!v.stopped).length<=8);
});

test('superseded decoding is serialized and only the latest selection starts',async t=>{
 const f=fixture();t.after(()=>f.player.dispose());let finish,entered;const ready=new Promise(r=>entered=r),decode=f.c.decodeAudioData;let first=true;
 f.c.decodeAudioData=async()=>{if(first){first=false;entered();await new Promise(r=>finish=r);}return decode();};
 const old=f.player.play(catalog.songs[0],'one');await ready;const latest=f.player.play(catalog.songs[2],'two');await new Promise(r=>setTimeout(r,10));assert.equal(f.requests.length,1);finish();assert.equal(await old,null);await latest;assert.equal(f.voices.length,4);assert.equal(f.player.status().song,'eldritch');
});
