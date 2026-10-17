(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>1-Math.pow(1-clamp(x),3);
 function orbit(seconds){const a=seconds*Math.PI*2/50;return {x:4.5*Math.cos(a),y:1.65*Math.sin(a),heading:Math.atan2(1.65*Math.cos(a),-4.5*Math.sin(a))*180/Math.PI+90,behind:Math.sin(a)<0};}
 function surface(progress,landing=false,style='hover'){
  const p=clamp(progress),e=landing?ease(p):p*p;
  return landing?{y:-(style==='aerofoil'?360:100)*(1-e),scale:1+2.6*(1-e),thrust:.2+2*(1-p)}:{y:style==='aerofoil'?-440*e:0,scale:style==='aerofoil'?1+.3*e:1+3*e,thrust:.25+2*e};
 }
 function point(hex,region=false){const w=region?15:30,r=Math.floor(Number(hex)/w);return{x:26+48.5*(Number(hex)%w+(r%2)/2),y:30+42*r};}
 return {clamp,ease,orbit,surface,point};
});
