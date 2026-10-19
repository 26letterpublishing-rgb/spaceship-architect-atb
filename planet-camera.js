(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./planet-terrain'):root.SAPlanetTerrain);if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetCamera=api;})(typeof globalThis!=='undefined'?globalThis:this,function(terrain){
 'use strict';
 function limits(region,width,height,size){
  const aspect=Math.max(1,width)/Math.max(1,height),world=terrain.geometry(region,size),maxWidth=region?Math.max(1550,440*aspect*1.25):world.height*aspect;
  return {aspect,world,baseWidth:Math.min(region?775:1455,maxWidth),maxWidth};
 }
 function constrain(camera,region,viewport){
  const w=Math.max(Math.min(180,viewport.maxWidth),Math.min(viewport.maxWidth,camera.w)),h=w/viewport.aspect;
  const bound=(value,extent,visible)=>visible>=extent?(extent-visible)/2:Math.max(0,Math.min(extent-visible,value));
  return {x:region?camera.x:bound(camera.x,viewport.world.width,w),y:region?camera.y:bound(camera.y,viewport.world.height,h),w,h,overview:!region&&w>=viewport.maxWidth-.01};
 }
 function zoom(camera,factor,region,viewport){
  const w=Math.max(Math.min(180,viewport.maxWidth),Math.min(viewport.maxWidth,camera.w*factor)),h=w/viewport.aspect;
  return constrain({x:camera.x+(camera.w-w)/2,y:camera.y+(camera.h-h)/2,w,h},region,viewport);
 }
 return {limits,constrain,zoom};
});
