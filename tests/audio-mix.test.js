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
  assert.equal(dice.gain.value,2.4);
  assert.equal(mix.destination(audio,'character'),dice);
  assert.equal(audio.nodes.length,3,'one persistent bus rather than a new graph per dice bounce');
  assert.equal(dice.output.type,'compressor');assert.equal(dice.output.ratio.value,8);
  assert.ok([...dice.output.output.curve].every(x=>Math.abs(x)<=.951));
  assert.equal(dice.output.output.output,audio.destination);
  assert.equal(mix.destination(audio,'launch').gain.value,1);
  assert.notEqual(mix.destination(context(),'character'),dice,'different AudioContexts never share nodes');
});
