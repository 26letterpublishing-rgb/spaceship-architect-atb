const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
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
  assert.equal(audio.nodes.length,3,'one persistent bus rather than a new graph per dice bounce');
  assert.equal(dice.output.type,'compressor');assert.equal(dice.output.ratio.value,8);
  assert.ok([...dice.output.output.curve].every(x=>Math.abs(x)<=.951));
  assert.equal(dice.output.output.output,audio.destination);
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
