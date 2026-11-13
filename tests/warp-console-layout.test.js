'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {warpArtworkBounds}=require('../transit-console-ui');
const {refreshImages}=require('../scripts/capture-console-layout.cjs');
test('Warp artwork covers scene without stretching and spills only into working-area underlay',()=>{
 for(const scene of [{left:400,top:125,width:980,height:807},{left:250,top:125,width:500,height:447},{left:200,top:125,width:900,height:300}]){
  const regions=[scene,{left:40,top:125,width:200,height:scene.height},{left:scene.left+scene.width+12,top:125,width:300,height:scene.height}],b=warpArtworkBounds(scene,regions,{width:1536,height:1024});
  assert(Math.abs(b.image.width/b.image.height-1.5)<1e-10);assert(b.image.width>=scene.width);assert(b.image.height>=scene.height);
  assert(Math.abs(b.area.left+b.image.left+b.image.width/2-(scene.left+scene.width/2))<1e-8);
  assert(Math.abs(b.area.top+b.image.top+b.image.height/2-(scene.top+scene.height/2))<1e-8);
  assert.equal(b.area.left,40);assert.equal(b.area.top,125);assert(b.area.width>scene.width);
 }
 assert.equal(warpArtworkBounds({width:0,height:1},[],{width:10,height:10}),null);
});
test('Image-only ALMA refresh preserves baseline identity and exact geometry; rejects incompatible recapture',()=>{
 const a={consoleId:'warp',baselineId:'original',width:1920,height:1016,boxes:[{id:'scene',x:10,y:20,w:100,h:200,image:'old',overflow:{bottom:0}}],guides:[{x:10}],colors:['yellow']};
 const b=structuredClone(a);b.baselineId='new-source-hash';b.boxes[0].image='new';b.background='background';b.reference='reference';b.capturedAt='now';b.sourceHashes={css:'new'};
 const result=refreshImages(a,b);assert.equal(result.baselineId,'original');assert.equal(result.boxes[0].image,'new');assert.equal(result.boxes[0].w,100);assert.deepEqual(result.guides,a.guides);assert.equal(a.boxes[0].image,'old');
 b.boxes[0].w+=1;assert.throws(()=>refreshImages(a,b),/Geometry changed/);
});

test('Explicit reduced-overflow image refresh preserves layout and rejects growth or geometry changes',()=>{
 const a={consoleId:'surv-camera',baselineId:'keep',width:100,height:100,boxes:[{id:'hold',label:'Hold',x:1,y:2,w:80,h:50,overflow:{bottom:12},image:'old'}],guides:[{x:1}],colors:['red']};
 const b=structuredClone(a);b.boxes[0].overflow.bottom=0;b.boxes[0].image='new';
 assert.throws(()=>refreshImages(a,b));
 const r=refreshImages(a,b,{allowReducedOverflow:true});assert.equal(r.baselineId,'keep');assert.equal(r.boxes[0].overflow.bottom,0);assert.deepEqual(r.boxes[0],{...a.boxes[0],overflow:{bottom:0},image:'new'});assert.deepEqual(r.guides,a.guides);assert.equal(a.boxes[0].overflow.bottom,12);
 for(const bad of [13,-1,NaN]){b.boxes[0].overflow.bottom=bad;assert.throws(()=>refreshImages(a,b,{allowReducedOverflow:true}),/Overflow may only decrease/);}
 b.boxes[0].overflow.bottom=0;b.boxes[0].w=81;assert.throws(()=>refreshImages(a,b,{allowReducedOverflow:true}),/Geometry changed/);
 b.boxes[0].w=80;b.boxes[0].id='different';assert.throws(()=>refreshImages(a,b,{allowReducedOverflow:true}),/Missing measured section/);
});

test('Reduced overflow refresh updates matching guide metadata without changing geometry or notes',()=>{
 const box={id:'hold',x:1,y:2,w:80,h:50,overflow:{bottom:12},image:'old'};
 const a={consoleId:'surv-camera',baselineId:'keep',width:100,height:100,boxes:[box],guides:[{...box,image:undefined}],notes:'preserve'};
 const b=structuredClone(a);b.boxes[0].overflow.bottom=0;
 const r=refreshImages(a,b,{allowReducedOverflow:true});
 assert.deepEqual(r.guides[0],{...a.guides[0],overflow:{bottom:0}});assert.equal(r.notes,a.notes);assert.equal(a.guides[0].overflow.bottom,12);
 // Also repairs the previously stale guide when the box was already refreshed.
 a.boxes[0]={...box,overflow:{bottom:0}};assert.equal(refreshImages(a,b,{allowReducedOverflow:true}).guides[0].overflow.bottom,0);
 a.guides[0].w=81;assert.throws(()=>refreshImages(a,b,{allowReducedOverflow:true}),/Guide geometry mismatch/);
});

const {warpDistanceFallback}=require('../transit-console-ui');
test('unmapped combat and Debug retain distance planning without bypassing usable map privacy',()=>{
 const active={hasEngagedClock:true},map={role:'character',starmaps:{maps:[{id:'m'}],positions:{s:{mapId:'m',q:0,r:0}},navigation:{allowed:{galaxy:true}}}};
 assert.equal(warpDistanceFallback(null,'s',active),true);assert.equal(warpDistanceFallback(map,'s',active),false);
 assert.equal(warpDistanceFallback({...map,starmaps:{...map.starmaps,positions:{}}},'s',active),true);
 assert.equal(warpDistanceFallback({...map,starmaps:{...map.starmaps,navigation:{allowed:{galaxy:false}}}},'s',active),true);
 assert.equal(warpDistanceFallback(null,'s',{hasEngagedClock:true,encounterEndedAt:1}),false);assert.equal(warpDistanceFallback(null,'s',{}),false);assert.equal(warpDistanceFallback(null,'s',{debugConsole:true}),true);
});
