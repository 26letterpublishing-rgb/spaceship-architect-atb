'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../room-v03.js'),'utf8');
function fixture({gesture=true,level=.3,running=true}={}){
 class Element{constructor(){this.children=[];this.attrs={};}append(...nodes){this.children.push(...nodes);}setAttribute(k,v){this.attrs[k]=v;}after(n){this.next=n;}}
 const calls=[],anchor=new Element(),mix={level:()=>level,context:()=>({state:running?'running':'suspended'}),turnDing:()=>{calls.push('turn-ding');return{stop:()=>calls.push('stop')};}};
 const sandbox={document:{createElement:()=>new Element()},window:{SAAudioMix:mix,navigator:{userActivation:{hasBeenActive:gesture}}}};
 vm.runInNewContext(source.slice(source.indexOf('  function approvalBanner('),source.indexOf('  async function lobby('))+';this.make=approvalBanner;',sandbox);
 return {update:sandbox.make(anchor),banner:anchor.next,calls,mix};
}
const pending={roomOpen:true,imports:[{id:'one',kind:'character',status:'pending'}]};
test('pending authoritative imports persist across duplicate/reconnect packets with one tone',()=>{const f=fixture();f.update(pending);const node=f.banner;for(let i=0;i<10;i++)f.update(structuredClone(pending));assert.equal(f.banner,node);assert.equal(node.hidden,false);assert.equal(node.attrs.role,'status');assert.deepEqual(f.calls,['turn-ding']);assert.match(node.children[1].textContent,/GM’s Inbox/);});
for(const resolution of ['approved','rejected','completed','superseded'])test(resolution+' clears banner and stops owned tone',()=>{const f=fixture();f.update(pending);f.update({roomOpen:true,imports:[{kind:'character',status:resolution}]});assert.equal(f.banner.hidden,true);assert.deepEqual(f.calls,['turn-ding','stop']);});
test('closed room and linked character clear pending indicator',()=>{for(const state of [{...pending,roomOpen:false},{...pending,ownCharacterId:'pc'}]){const f=fixture();f.update(pending);f.update(state);assert.equal(f.banner.hidden,true);}});
test('ship imports do not produce character banner; new pending interval can tone again',()=>{const f=fixture();f.update({imports:[{kind:'ship',status:'pending'}]});assert.equal(f.banner.hidden,true);f.update(pending);f.update({imports:[]});f.update(pending);assert.deepEqual(f.calls,['turn-ding','stop','turn-ding']);});
for(const [name,options]of [['mute/category zero',{level:0}],['no gesture',{gesture:false}],['suspended context',{running:false}]])test(name+' shows status without queuing audio',()=>{const f=fixture(options);f.update(pending);f.update(pending);assert.equal(f.banner.hidden,false);assert.deepEqual(f.calls,[]);});
test('room loads shared mixer before lobby, no alarm or new synthesis in banner',()=>{const html=fs.readFileSync(require.resolve('../room.html'),'utf8');assert.ok(html.indexOf('audio-mix.js')<html.indexOf('room-v03.js'));const body=source.slice(source.indexOf('function approvalBanner('),source.indexOf('async function lobby('));assert.doesNotMatch(body,/AudioContext|createOscillator|alarm|setInterval|fetch\(/);assert.match(body,/turnDing\(\)/);});
