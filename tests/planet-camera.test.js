const test=require('node:test'),assert=require('node:assert/strict'),camera=require('../planet-camera'),terrain=require('../planet-terrain');
test('all sizes stop zooming out at full height and pan only within hard edges',()=>{
 for(const size of ['large','small','moon'])for(const [width,height]of [[1800,455],[1800,600],[800,600],[360,700]]){
  const limits=camera.limits(false,width,height,size),world=terrain.geometry(false,size),view=camera.zoom({x:900,y:1200,w:1455,h:1455/limits.aspect},100,false,limits);
  assert.equal(view.overview,true);assert.ok(Math.abs(view.h-world.height)<1e-8);assert.ok(Math.abs(view.y)<1e-8);
  assert.ok(Math.abs(view.w/view.h-width/height)<1e-8);assert.equal(camera.zoom(view,2,false,limits).w,view.w);
  const left=camera.constrain({...view,x:-100000,y:-100000},false,limits),right=camera.constrain({...view,x:100000,y:100000},false,limits);
  assert.ok(Math.abs(left.y-right.y)<1e-8);
  if(view.w<world.width){assert.equal(left.x,0);assert.equal(right.x,world.width-view.w);}else{assert.equal(left.x,(world.width-view.w)/2);assert.equal(right.x,left.x);}
  const closer=camera.zoom(view,.75,false,limits);assert.equal(closer.overview,false);
  assert.equal(camera.constrain({...closer,y:1e6},false,limits).y,world.height-closer.h);
 }
});
test('region default framing and extended zoom-out stay unchanged',()=>{
 const limits=camera.limits(true,1800,600),original={x:0,y:0,w:775,h:775/3};
 assert.equal(camera.constrain(original,true,limits).w,775);
 const wide=camera.zoom(original,100,true,limits);assert.ok(wide.w>=1550);assert.equal(wide.overview,false);
 assert.equal(camera.constrain({...wide,x:5000},true,limits).x,5000);
});
