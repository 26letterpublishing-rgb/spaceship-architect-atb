(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetTerrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const types=['temperate','desert','ice','volcanic','ocean','moon'];
 const colors={temperate:'#53865c',desert:'#c8a263',ice:'#afcfdb',volcanic:'#514448',ocean:'#246a89',moon:'#85858d'};
 function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
 function random(seed){let n=hash(seed);return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
 function dimensions(region=false){return region?{width:15,height:10}:{width:30,height:20};}
 function cells(region=false){const {width,height}=dimensions(region);return Array.from({length:width*height},(_,i)=>({key:String(i),column:i%width,row:Math.floor(i/width)}));}
 // Low-frequency, wrapped continental fields create large connected oceans.
 // Rank the field once to retain ~70% water, with no per-cell random speckling.
 function generate(seed,type='temperate',region=false){
  const all=cells(region);if(type!=='temperate')return all.map(()=>types.includes(type)?type:'moon');
  const rand=random(seed),{width,height}=dimensions(region),centers=Array.from({length:4},()=>({x:rand()*width,y:2+rand()*(height-4),rx:width*(.12+rand()*.13),ry:height*(.18+rand()*.18)}));
  const scores=all.map(({column:x,row:y},i)=>({i,n:centers.reduce((n,c)=>{const d=Math.min(Math.abs(x-c.x),width-Math.abs(x-c.x));return n+Math.exp(-((d/c.rx)**2+((y-c.y)/c.ry)**2)*2);},0)+.035*Math.sin(x*.7+y*.5+hash(seed)%31)})).sort((a,b)=>b.n-a.n||a.i-b.i);
  const land=new Set(scores.slice(0,Math.round(all.length*.3)).map(x=>x.i));return all.map((_,i)=>land.has(i)?'temperate':'ocean');
 }
 function terrain(seed,type,overrides={},region=false){return generate(seed,type,region).map((value,i)=>overrides[i]?.terrain||value);}
 function validHex(value,region=false){return /^\d+$/.test(String(value))&&Number(value)<(region?150:600)&&Number(value)>=0;}
 return {types,colors,hash,random,dimensions,cells,generate,terrain,validHex};
});
