const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){let time=0,queue=[],writes=0;const state={running:true},matrix={e:0,f:0};const marker={isConnected:true,style:{},transform:{baseVal:{consolidate:()=>({matrix})}},setAttribute(k,v){if(k==='transform'){[matrix.e,matrix.f]=v.match(/[-\d.]+/g).map(Number);writes++;}}};const document={addEventListener(){},hidden:false,defaultView:{frameElement:null}};const context={document,window:{SACombatBridge:{state:()=>state}},performance:{now:()=>time},requestAnimationFrame:f=>{queue.push(f);return 1;}};vm.runInNewContext(fs.readFileSync(require.resolve('../space-map.js'),'utf8'),context);return{state,document,marker,matrix,now(n){time=n;},frame(n){const batch=queue;queue=[];batch.forEach(f=>f(n));},move:context.window.SASpaceMap.moveMarker,tick(n){time=n;const batch=queue;queue=[];batch.forEach(f=>f(time));},queued:()=>queue.length,writes:()=>writes};}
test('map motion interpolates intermediate coordinates and does not schedule stationary markers',()=>{const f=fixture();f.move(f.marker,{x:10,y:4});f.tick(100);assert.equal(f.matrix.e,5);assert.equal(f.matrix.f,2);f.tick(200);assert.equal(f.matrix.e,10);assert.equal(f.queued(),0);const count=f.writes();f.move(f.marker,{x:10,y:4});assert.equal(f.writes(),count);assert.equal(f.queued(),0);});
test('paused and detached map markers cannot keep an animation loop alive',()=>{const f=fixture();f.move(f.marker,{x:10,y:0});f.state.hardPaused=true;f.tick(20);assert.equal(f.matrix.e,10);assert.equal(f.queued(),0);f.state.hardPaused=false;f.move(f.marker,{x:20,y:0});f.marker.isConnected=false;f.tick(40);assert.equal(f.queued(),0);});

test('stale frame timestamps never extrapolate behind the start, on either axis',()=>{
 const f=fixture();f.now(100);f.move(f.marker,{x:10,y:-6});
 f.frame(80);assert.equal(f.matrix.e,0);assert.equal(f.matrix.f,0);
 f.frame(200);assert.equal(f.matrix.e,5);assert.equal(f.matrix.f,-3);
 f.frame(300);assert.equal(f.matrix.e,10);assert.equal(f.matrix.f,-6);assert.equal(f.queued(),0);
});
test('retargeting preserves the current position through stale frames and supports real reversal',()=>{
 const f=fixture();f.move(f.marker,{x:10,y:6});f.tick(100);
 f.now(150);f.move(f.marker,{x:20,y:12});
 f.frame(130);assert.equal(f.matrix.e,5);assert.equal(f.matrix.f,3);
 f.frame(225);assert.equal(f.matrix.e,12.5);assert.equal(f.matrix.f,7.5);
 f.frame(300);assert.equal(f.matrix.e,20);assert.equal(f.matrix.f,12);
 f.now(350);f.move(f.marker,{x:-4,y:-8});f.frame(330);
 assert.equal(f.matrix.e,20);assert.equal(f.matrix.f,12);
 f.frame(450);assert.equal(f.matrix.e,8);assert.equal(f.matrix.f,2);
 f.frame(900);assert.equal(f.matrix.e,-4);assert.equal(f.matrix.f,-8);assert.equal(f.queued(),0);
});
test('same target does not reset progress and hidden tabs snap then stop',()=>{
 const f=fixture();f.move(f.marker,{x:10,y:4});f.tick(100);
 f.now(150);f.move(f.marker,{x:10,y:4});assert.equal(f.queued(),1);
 f.frame(200);assert.equal(f.matrix.e,10);assert.equal(f.matrix.f,4);assert.equal(f.queued(),0);
 f.now(300);f.move(f.marker,{x:20,y:8});f.document.hidden=true;f.frame(280);
 assert.equal(f.matrix.e,20);assert.equal(f.matrix.f,8);assert.equal(f.queued(),0);
 f.move(f.marker,{x:30,y:12});assert.equal(f.matrix.e,30);assert.equal(f.queued(),0);
});
