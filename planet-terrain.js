(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetTerrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const cache=new Map();
 const types=['temperate','desert','ice','volcanic','ocean','moon'];
 const colors={temperate:'#53865c',desert:'#c8a263',ice:'#afcfdb',volcanic:'#514448',ocean:'#246a89',moon:'#85858d'};
 function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
 function random(seed){let n=hash(seed);return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
 function dimensions(region=false){return region?{width:15,height:10}:{width:30,height:40};}
 function cells(region=false){const {width,height}=dimensions(region);return Array.from({length:width*height},(_,i)=>({key:String(i),column:i%width,row:Math.floor(i/width)}));}
 // Low-frequency, wrapped continental fields create large connected oceans.
 // Rank the field once to retain ~70% water, with no per-cell random speckling.
 function generate(seed,type='temperate',region=false,uniform=false){
  const all=cells(region);if(uniform||type!=='temperate')return all.map(()=>types.includes(type)?type:'moon');
  const key=String(seed)+'/'+region;if(cache.has(key))return cache.get(key).slice();const generated=generateBand(seed,region);if(cache.size>32)cache.delete(cache.keys().next().value);cache.set(key,generated);return generated.slice();
 }
 function generateBand(seed,region=false){
  const {width}=dimensions(region),height=region?10:40,all=Array.from({length:width*height},(_,i)=>({column:i%width,row:Math.floor(i/width)}));
  const rand=random(seed),centers=Array.from({length:4},()=>({x:rand()*width,y:2+rand()*(height-4),rx:width*(.12+rand()*.13),ry:height*(.18+rand()*.18)}));
  const scores=all.map(({column:x,row:y},i)=>({i,n:centers.reduce((n,c)=>{const d=Math.min(Math.abs(x-c.x),width-Math.abs(x-c.x));return n+Math.exp(-((d/c.rx)**2+((y-c.y)/c.ry)**2)*2);},0)+.035*Math.sin(x/width*Math.PI*4+y*.5+hash(seed)%31)})).sort((a,b)=>b.n-a.n||a.i-b.i);
  const land=new Set(scores.slice(0,Math.round(all.length*.3)).map(x=>x.i));return all.map((_,i)=>land.has(i)?'temperate':'ocean');
 }
 function terrain(seed,type,overrides={},region=false,uniform=false){return generate(seed,type,region,uniform).map((value,i)=>overrides[i]?.terrain||value);}
 function wrapColumn(column,region=false){const width=dimensions(region).width;return ((column%width)+width)%width;}
 function validHex(value,region=false){return /^\d+$/.test(String(value))&&Number(value)<(region?150:1200)&&Number(value)>=0;}
 function definitions(){return `<defs><pattern id="pt-temperate" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#477d58"/><path d="M0 31Q12 14 24 30T48 31M-8 10Q6 0 20 10T48 11" fill="none" stroke="#7fa470" stroke-width="2" opacity=".55"/><path d="M9 19l4-8 4 8zM32 39l4-9 4 9z" fill="#274f3b"/></pattern><pattern id="pt-ocean" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#245c7b"/><path d="M0 12Q6 6 12 12T24 12T36 12T48 12M0 32Q6 26 12 32T24 32T36 32T48 32" fill="none" stroke="#5096b0" stroke-width="1.5" opacity=".55"/></pattern><pattern id="pt-desert" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#b68f52"/><path d="M-8 28Q10 2 34 26T60 19M-9 38Q14 16 39 39" fill="none" stroke="#ebc785" stroke-width="3" opacity=".7"/></pattern><pattern id="pt-ice" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#a1c3d1"/><path d="M5 42L24 5 45 42M24 5L20 26 30 20" fill="#d6e8eb" stroke="#779eaf" stroke-width="1.5"/></pattern><pattern id="pt-volcanic" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#39343e"/><path d="M5 0L18 15 12 27 32 42M18 15L37 9 48 19" fill="none" stroke="#ef8447" stroke-width="2"/><path d="M0 39L18 20 30 39" fill="#51464d"/></pattern><pattern id="pt-moon" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#777b86"/><ellipse cx="14" cy="15" rx="9" ry="7" fill="#555b68" stroke="#a3a6ad"/><ellipse cx="37" cy="34" rx="6" ry="5" fill="#555b68" stroke="#a3a6ad"/></pattern><g id="pt-city"><path d="M-15 11V-7h8v-8h10v10h10v16z" fill="#e7dac2" stroke="#302d32" stroke-width="2"/><path d="M-11-3v3m0 4v3M-3-10v3m6 2v3m5 1v3" stroke="#6f8f99" stroke-width="3"/></g><g id="pt-pin"><path d="M0 18C-4 9-13 1-13-7a13 13 0 0 1 26 0C13 1 4 9 0 18Z" fill="#ed4853" stroke="#ffb8b8" stroke-width="2"/><circle cy="-7" r="4" fill="#fff4e8"/></g></defs>`;}
 function texture(type){if(!types.includes(type))return '';return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="42">'+definitions()+'<rect width="48" height="42" fill="url(#pt-'+type+')"/></svg>');}
 return {definitions,texture,types,colors,hash,random,dimensions,cells,generate,terrain,wrapColumn,validHex};
});
