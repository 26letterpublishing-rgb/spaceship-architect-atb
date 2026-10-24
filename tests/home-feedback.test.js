const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('home click feedback lasts 500ms, maps supplied sounds and cannot hang on failed audio',async()=>{
 const timers=[],clips=[],classes=new Set(),attrs=new Map();let finish;
 const control={matches:()=>false,classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const window={SAAudioMix:{unlock(){},buttonSound(role){clips.push(role);return {ended:new Promise(r=>finish=r)};}}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../home-feedback.js'),'utf8'),{window,setTimeout:(fn,ms)=>timers.push({fn,ms})});
 const feedback=window.SAHomeFeedback,pressed=feedback.activate(control,'robot');assert.deepEqual(clips,['robot']);assert.equal(classes.has('home-activating'),true);assert.equal(timers[0].ms,500);timers.shift().fn();await pressed;assert.equal(classes.size,0);feedback.release(control);assert.equal(attrs.size,0);
 feedback.accepted();assert.equal(clips.length,1,'completion does not duplicate activation feedback');
 const chunk=feedback.activate(control,'chunk');assert.equal(clips.at(-1),'chunk');timers.find(t=>t.ms===500).fn();await chunk;
 assert.equal(feedback.accepted(),undefined,'navigation never waits for audio');
});
