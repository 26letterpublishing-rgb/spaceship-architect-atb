'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {installMenuMedia}=require('../home-screen');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({reduced=false,blocked=false}={}){
 let time=0,active=true,observer,plays=0,releases=0;const timers=new Map(),events=new Map(),mediaEvents=new Map(),raf=new Map(),images=[];let id=0;
 const audio={currentTime:0,paused:true,ended:false,addEventListener:(k,f)=>mediaEvents.set(k,f),removeEventListener:k=>mediaEvents.delete(k),play(){plays++;if(blocked)return Promise.reject(Error('NotAllowedError'));this.paused=false;this.ended=false;mediaEvents.get('playing')?.();return Promise.resolve();},pause(){this.paused=true;mediaEvents.get('pause')?.();},removeAttribute(){},load(){}};
 const on=(type,fn)=>events.set(type,fn),off=type=>events.delete(type);
 const document={hidden:false,body:{classList:{contains:()=>active}},addEventListener:on,removeEventListener:off};
 const window={performance:{now:()=>time},navigator:{userActivation:{hasBeenActive:true}},Audio:function(){return audio;},Image:function(){this.decode=async()=>{};this.removeAttribute=()=>{this.src='';};images.push(this);},matchMedia:()=>({matches:reduced}),MutationObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},addEventListener:on,removeEventListener:off,setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),SAAudioMix:{level:()=>1,trackMedia(){},context:()=>({state:'running'}),releaseMedia(){releases++;}}};
 const banner={src:'home-animation-frame-0.jpg'},controller=installMenuMedia(window,document,banner);
 return {window,document,banner,audio,events,mediaEvents,images,controller,get plays(){return plays;},get releases(){return releases;},async at(ms){time=ms;for(const [id,t]of [...timers])if(t.at<=ms){timers.delete(id);await t.fn();}for(const [id,fn]of [...raf]){raf.delete(id);fn();}await flush();},async song(seconds){audio.currentTime=seconds;mediaEvents.get('timeupdate')?.();await flush();},leave(){active=false;observer();},unblock(){blocked=false;}};
}
test('first gesture starts media while context resume is still pending',async()=>{
 const f=fixture();f.window.navigator.userActivation.hasBeenActive=false;await f.at(10000);assert.equal(f.plays,0);
 let finish;const context={state:'suspended',resume:()=>new Promise(resolve=>{finish=()=>{context.state='running';resolve();};})};f.window.SAAudioMix.context=()=>context;
 f.window.navigator.userActivation.hasBeenActive=true;f.events.get('pointerup')();assert.equal(f.plays,1);assert.equal(context.state,'suspended');finish();await flush();assert.equal(f.audio.paused,false);f.events.get('pointerup')();assert.equal(f.plays,1);
});
test('song starts at ten seconds; nine frames repeat every twenty seconds from song170',async()=>{
 const f=fixture();await f.at(9999);assert.equal(f.plays,0);await f.at(10000);assert.equal(f.plays,1);
 await f.song(140);assert.equal(f.images.length,9);assert(f.images.every(i=>i.src));await f.song(169.999);assert.match(f.banner.src,/-0.jpg$/);
 for(let i=0;i<9;i++){await f.song(170+i*.112);assert.equal(f.banner.src,`home-animation-frame-${i+1}.jpg`);}
 await f.song(171);assert.match(f.banner.src,/-0.jpg$/);assert(f.images.every(i=>i.src));await f.song(189.999);assert.match(f.banner.src,/-0.jpg$/);await f.song(190);assert.match(f.banner.src,/-1.jpg$/);await f.song(191);assert.match(f.banner.src,/-0.jpg$/);await f.song(210);assert.match(f.banner.src,/-1.jpg$/);assert.equal(f.images.length,9);assert.equal(f.plays,1);
});
test('late autoplay waits beyond wall-clock deadline, then follows actual song position',async()=>{
 const f=fixture({blocked:true});await f.at(10000);await f.at(199000);await f.at(400000);assert.equal(f.images.length,0);assert.match(f.banner.src,/-0.jpg$/);
 f.unblock();f.events.get('pointerup')();await flush();await f.song(140);await f.at(600000);assert.match(f.banner.src,/-0.jpg$/);await f.song(170);assert.match(f.banner.src,/-1.jpg$/);
});
test('pauses before and during cue do not advance animation on wall-clock time',async()=>{
 const f=fixture();await f.at(10000);await f.song(140);await f.song(169.9);f.audio.pause();await f.at(500000);assert.match(f.banner.src,/-0.jpg$/);
 await f.audio.play();await f.song(170.4);const held=f.banner.src;f.audio.pause();await f.at(600000);assert.equal(f.banner.src,held);await f.audio.play();await f.song(170.8);assert.match(f.banner.src,/-8.jpg$/);await f.song(171);assert.match(f.banner.src,/-0.jpg$/);
});
test('blocked playback retries and leaving clears media listeners and pending frames',async()=>{
 const f=fixture({blocked:true});await f.at(10000);assert.equal(f.plays,1);f.unblock();f.events.get('pointerup')();await flush();assert.equal(f.plays,2);await f.song(140);
 f.leave();assert.equal(f.releases,1);assert.equal(f.audio.paused,true);assert.equal(f.mediaEvents.size,0);assert(f.images.every(i=>!i.src));await f.at(500000);assert.match(f.banner.src,/-0.jpg$/);assert.equal(f.events.has('pointerup'),false);
});
test('reduced motion remains static; hidden pause resumes from the media cue',async()=>{
 const r=fixture({reduced:true});await r.at(10000);await r.song(170);assert.match(r.banner.src,/-0.jpg$/);assert.equal(r.images.length,0);
 const f=fixture();await f.at(10000);await f.song(140);await f.song(169.9);f.document.hidden=true;f.events.get('visibilitychange')();await f.at(500000);assert.match(f.banner.src,/-0.jpg$/);f.document.hidden=false;f.events.get('visibilitychange')();await flush();await f.song(170);assert.match(f.banner.src,/-1.jpg$/);
});
test('mute and absent activation defer playback; visibility resume does not restart song',async()=>{
 const f=fixture();f.window.SAAudioMix.level=()=>0;await f.at(10000);assert.equal(f.plays,0);f.window.SAAudioMix.level=()=>1;f.window.navigator.userActivation.hasBeenActive=false;f.events.get('pointerup')();assert.equal(f.plays,0);f.window.navigator.userActivation.hasBeenActive=true;f.events.get('pointerup')();await flush();await f.song(40);f.document.hidden=true;f.events.get('visibilitychange')();assert.equal(f.audio.paused,true);f.document.hidden=false;f.events.get('visibilitychange')();await flush();assert.equal(f.plays,2);assert.equal(f.audio.currentTime,40);
});
test('song end schedules exactly one restart after ten seconds and resets animation cycle',async()=>{
 const f=fixture();await f.at(10000);await f.song(170);f.audio.paused=true;f.audio.ended=true;f.audio.currentTime=356.706;f.mediaEvents.get('ended')();f.mediaEvents.get('ended')();assert(f.images.every(i=>!i.src));assert.match(f.banner.src,/-0.jpg$/);
 f.events.get('pointerup')();await f.at(19999);assert.equal(f.plays,1);await f.at(20000);assert.equal(f.plays,2);assert.equal(f.audio.currentTime,0);await f.song(169.999);assert.match(f.banner.src,/-0.jpg$/);await f.song(170);assert.match(f.banner.src,/-1.jpg$/);
});
test('leaving during the inter-song gap cancels restart; muted restart waits for permitted gesture',async()=>{
 const f=fixture();await f.at(10000);f.audio.paused=true;f.audio.ended=true;f.mediaEvents.get('ended')();f.leave();await f.at(50000);assert.equal(f.plays,1);
 const muted=fixture();await muted.at(10000);muted.audio.paused=true;muted.audio.ended=true;muted.mediaEvents.get('ended')();muted.window.SAAudioMix.level=()=>0;await muted.at(20000);assert.equal(muted.plays,1);muted.window.SAAudioMix.level=()=>1;muted.events.get('pointerup')();await flush();assert.equal(muted.plays,2);
});
