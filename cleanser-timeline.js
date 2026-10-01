(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SACleanserTimeline=api;}(typeof window==='object'?window:globalThis,function(){
 // Browser-decoded duration of assets/zup.mp3 (MP3 padding excluded).
 // Keep this with the served audio copy.
 const audioSeconds=2.88288,explosion=audioSeconds+.05;
 const current=Object.freeze({version:2,audio:'cleanser-zup.mp3',impactAudio:'cleanser-fire.wav',impactOffset:8,audioSeconds,beam:audioSeconds,explosion,aftermath:explosion+5,result:explosion+8,dice:explosion+4,duration:explosion+12});
 const legacy=Object.freeze({version:1,audio:'cleanser-fire.wav',audioSeconds:20,beam:4,explosion:8,aftermath:13,result:16,dice:12,duration:20});
 const confirmed=Object.freeze({...current,version:3,dice:Infinity});
 const forEvent=event=>event?.cinematicVersion===3?confirmed:event?.cinematicVersion===2?current:legacy;
 function stage(timeline,elapsed){return elapsed<timeline.beam?'buildup':elapsed<timeline.explosion?'beam':elapsed<timeline.aftermath?'rupture':elapsed<timeline.result?'aftermath':'result';}
 function syncAudio(audio,elapsed,enabled,timeline){
  if(!audio)return;
  if(!enabled||elapsed>=timeline.audioSeconds){if(!audio.paused)audio.pause();return;}
  if(!audio.ended&&audio.paused&&audio.readyState>=1){
   audio.currentTime=Math.min(elapsed,Math.max(0,(Number.isFinite(audio.duration)?audio.duration:timeline.audioSeconds)-.01));
   audio.play().catch(()=>{});
  }
 }
 return {current,forEvent,stage,syncAudio};
}));
