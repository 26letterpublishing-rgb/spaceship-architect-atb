(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./planet-terrain'):root.SAPlanetTerrain);if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(terrain){
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3);
 function orbit(seconds){const a=seconds*Math.PI*2/50;return {x:4.5*Math.cos(a),y:1.65*Math.sin(a),heading:Math.atan2(1.65*Math.cos(a),-4.5*Math.sin(a))*180/Math.PI+90};}
 function surface(progress,landing=false,style='hover'){
  const p=clamp(progress),e=landing?ease(p):p*p;
  return landing?{y:-(style==='aerofoil'?360:100)*(1-e),scale:1+2.6*(1-e),thrust:.2+2*(1-p)}:{y:style==='aerofoil'?-440*e:0,scale:style==='aerofoil'?1+.3*e:1+3*e,thrust:.25+2*e};
 }
 function hover(thrust,seconds,index=0,reduced=false){
  const power=clamp(thrust/2.25),phase=reduced?0:seconds*Math.PI*2/.48+index*1.7;
  return {opacity:(.4+.55*power)*clamp(power/.18),scale:.72+.48*power+(reduced?0:.035*Math.sin(phase)),mix:reduced?.5:(1-Math.cos(phase))/2,rotation:reduced?0:(seconds*26+index*91)%360};
 }
 const point=terrain.point;
 return {clamp,ease,orbit,surface,hover,point};
});
