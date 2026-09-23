const test=require('node:test'),assert=require('node:assert/strict'),timeline=require('../cleanser-timeline');
test('zup explosion starts half a second before audio ends, with time for the dice and aftermath',()=>{
 const t=timeline.current;assert.equal(t.audio,'cleanser-zup.mp3');assert.equal(t.audioSeconds-t.explosion,.5);assert.equal(timeline.stage(t,t.explosion-.001),'beam');assert.equal(timeline.stage(t,t.explosion),'rupture');assert.ok(t.dice>t.explosion);assert.ok(t.duration-t.dice>=8);assert.equal(require('../ship-cleanser').CINEMATIC,Math.ceil(t.duration*1000));
});
test('saved legacy cinematics retain their original audio and stage schedule',()=>{
 const t=timeline.forEvent({});assert.equal(t.audio,'cleanser-fire.wav');assert.equal(t.duration,20);assert.equal(timeline.stage(t,7.99),'beam');assert.equal(timeline.stage(t,8),'rupture');assert.equal(timeline.forEvent({cinematicVersion:2}),timeline.current);
});
test('the existing explosion audio tail fits the new aftermath without repeating its old buildup',()=>{
 const t=timeline.current;assert.equal(t.impactAudio,'cleanser-fire.wav');assert.equal(t.impactOffset,8);assert.ok(Math.abs(t.impactOffset+t.duration-t.explosion-20)<1e-9);
});
test('late audio playback seeks to shared elapsed time; mute and completion never restart the clip',()=>{
 let plays=0;const audio={paused:true,readyState:0,duration:timeline.current.audioSeconds,currentTime:0,play(){this.paused=false;plays++;return Promise.resolve();},pause(){this.paused=true;}};
 timeline.syncAudio(audio,1,true,timeline.current);assert.equal(plays,0);audio.readyState=1;timeline.syncAudio(audio,1.2,true,timeline.current);assert.equal(audio.currentTime,1.2);assert.equal(plays,1);
 timeline.syncAudio(audio,1.4,false,timeline.current);assert.equal(audio.paused,true);timeline.syncAudio(audio,2,true,timeline.current);assert.equal(audio.currentTime,2);assert.equal(plays,2);
 timeline.syncAudio(audio,3,true,timeline.current);assert.equal(audio.paused,true);timeline.syncAudio(audio,4,true,timeline.current);assert.equal(plays,2);audio.ended=true;timeline.syncAudio(audio,2.8,true,timeline.current);assert.equal(plays,2);
});

test('confirmed damage sequence keeps zup timing and does not roll dice again in the cinematic',()=>{
 const t=timeline.forEvent({cinematicVersion:3});assert.equal(t.version,3);assert.equal(t.audioSeconds-t.explosion,.5);assert.equal(t.dice,Infinity);assert.equal(t.duration,timeline.current.duration);
});
