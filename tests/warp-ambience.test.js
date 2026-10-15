const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('warp ambience fades both base gain and pulse to silence when muted, hidden or stopped',()=>{
 const events={},store=new Map(),gains=[];let interval;
 const param=()=>({value:0,setTargetAtTime(v){this.target=v}}),audioNode=()=>({connect(){},start(){},gain:param(),frequency:param()});
 class AudioContext{constructor(){this.currentTime=0;this.sampleRate=10;this.state='running'}createGain(){const n=audioNode();gains.push(n);return n}createOscillator(){return audioNode()}createBuffer(){return {getChannelData:()=>new Float32Array(30)}}createBufferSource(){return audioNode()}createBiquadFilter(){return audioNode()}}
 const document={hidden:false,addEventListener(){},createElement:()=>({setAttribute(){},className:'',remove(){this.removed=true}})};
 const window={addEventListener:(k,f)=>events[k]=f,SAAudioMix:{destination:()=>audioNode()},SAExploreSession:{active:()=>true}};
 const scene={isConnected:true,classList:{toggle(){}},style:{setProperty(){}},getClientRects:()=>[{}],ownerDocument:document,querySelector(){return this.layer&&!this.layer.removed?this.layer:null},prepend(n){this.layer=n}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../warp-effects'),'utf8'),{window,document,localStorage:{getItem:k=>store.get(k)},matchMedia:()=>({matches:false,addEventListener(){}}),AudioContext,performance:{now:()=>0},requestAnimationFrame(){},cancelAnimationFrame(){},setInterval:f=>interval=f,ResizeObserver:class{}});
 const ship={warpState:{phase:'traveling'},thrusterDirection:270};window.SAWarpEffects.updateMap(ship,scene);assert.equal(gains.length,0);events.pointerdown();assert.equal(gains[0].gain.target,.045);assert.equal(gains.at(-1).gain.target,.012);
 store.set('sa-atb-alerts','off');interval();assert.equal(gains[0].gain.target,0);assert.equal(gains.at(-1).gain.target,0);
 store.delete('sa-atb-alerts');document.hidden=true;interval();assert.equal(gains[0].gain.target,0);document.hidden=false;interval();assert.equal(gains[0].gain.target,.045);
 window.SAWarpEffects.updateMap({warpState:{phase:'idle'}},scene);assert.equal(gains[0].gain.target,0);assert.equal(scene.layer.removed,true);
});
