'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {createDebugUnlock}=require('../home-screen');const seq=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
test('Debug unlock requires exact sequence and reveals/chimes once',()=>{let count=0;const key=createDebugUnlock(()=>count++);for(const k of seq.slice(0,-1))key({key:k});assert.equal(count,0);key({key:'A'});assert.equal(count,1);for(const k of seq)key({key:k});assert.equal(count,1);});
test('Debug unlock rejects wrong, editable, inactive, modified and composition keys',()=>{for(const options of [{editable:true},{active:false}]){let count=0;const key=createDebugUnlock(()=>count++);for(const k of seq)key({key:k},options);assert.equal(count,0);for(const k of seq)key({key:k});assert.equal(count,1);}for(const field of ['ctrlKey','metaKey','altKey','isComposing']){let n=0;const key=createDebugUnlock(()=>n++);for(const k of seq)key({key:k,[field]:true});assert.equal(n,0);}let count=0;const key=createDebugUnlock(()=>count++);for(const k of [...seq.slice(0,4),'x',...seq.slice(4)])key({key:k});assert.equal(count,0);for(const k of seq)key({key:k});assert.equal(count,1);});
test('Debug unlock ignores held-key repeats and handles overlapping initial arrows',()=>{let n=0;const key=createDebugUnlock(()=>n++);key({key:'ArrowUp'});key({key:'ArrowUp',repeat:true});for(const k of seq.slice(1))key({key:k});assert.equal(n,1);let other=0;const overlap=createDebugUnlock(()=>other++);overlap({key:'ArrowUp'});for(const k of seq)overlap({key:k});assert.equal(other,1);});
test('release or missing runtime config installs no Debug DOM, listener or audio',()=>{
 const {installDebugUnlock}=require('../home-screen');
 for(const config of [undefined,{debugTools:false},{debugTools:'true'}]){
  const forbidden=()=>{throw Error('Release must not initialize Debug');};
  assert.equal(installDebugUnlock({createElement:forbidden,addEventListener:forbidden},{SARuntimeConfig:config,SAAudioMix:{unlock:forbidden,turnDing:forbidden}},{append:forbidden}),false);
 }
 let listener,chimes=0,appended=0;
 const document={createElement:()=>({style:{},setAttribute(){}}),addEventListener:(type,fn)=>{assert.equal(type,'keydown');listener=fn;},body:{classList:{contains:()=>true}}};
 assert(require('../home-screen').installDebugUnlock(document,{SARuntimeConfig:{debugTools:true},SAAudioMix:{turnDing:()=>chimes++}},{append:()=>appended++}));
 for(const key of seq)listener({key});assert.equal(appended,1);assert.equal(chimes,1);
});
