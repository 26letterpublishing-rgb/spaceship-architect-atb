(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAPlanetTerrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const cache=new Map();
 const pinShape='<path d="M0 18C-4 9-13 1-13-7a13 13 0 0 1 26 0C13 1 4 9 0 18Z" fill="#ed4853" stroke="#ffb8b8" stroke-width="2"/><circle cy="-7" r="4" fill="#fff4e8"/>';
 const types=['temperate','desert','ice','volcanic','ocean','moon'];
 const colors={temperate:'#53865c',desert:'#c8a263',ice:'#afcfdb',volcanic:'#514448',ocean:'#246a89',moon:'#85858d'};
 function hash(text){let n=2166136261;for(const ch of String(text)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
 function random(seed){let n=hash(seed);return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
 const sizes=Object.freeze({large:{width:120,height:40},small:{width:60,height:20},moon:{width:30,height:10}});
 function dimensions(region=false,size='large'){return region?{width:15,height:10}:{...(sizes[size]||sizes.large)};}
 function count(region=false,size){const {width,height}=dimensions(region,size);return width*height;}
 // Retain IDs in the original 30-column band; added columns form a second band.
 function cell(key,region=false,size){const i=Number(key),d=dimensions(region,size),base=30*d.height,extension=!region&&i>=base,w=region?15:extension?d.width-30:30,n=extension?i-base:i;return {key:String(i),column:n%w+(extension?30:0),row:Math.floor(n/w)};}
 function hexAt(column,row,region=false,size){const {width,height}=dimensions(region,size);if(!Number.isInteger(row)||row<0||row>=height||!Number.isInteger(column)||column<0||column>=width)return null;return String(region?row*width+column:column<30?row*30+column:30*height+row*(width-30)+column-30);}
 const cellCache=new Map();
 function cells(region=false,size='large'){const k=region?'region':size;if(!cellCache.has(k))cellCache.set(k,Object.freeze(Array.from({length:count(region,size)},(_,i)=>Object.freeze(cell(i,region,size)))));return cellCache.get(k);}
 function point(key,region=false,size){const {column,row}=cell(key,region,size);return {x:26+48.5*(column+(row%2)/2),y:30+42*row};}
 function geometry(region=false,size){const d=dimensions(region,size);return {width:region?775:48.5*d.width+26,height:region?440:42*d.height+20};}
 function route(from,to,region=false,size){
  const axial=key=>{const {column,row:r}=cell(key,region,size);return {q:column-(r-(r&1))/2,r};},a=axial(from),b=axial(to);
  const distance=p=>(Math.abs(a.q-p.q)+Math.abs(a.r-p.r)+Math.abs(a.q+a.r-p.q-p.r))/2;
  let end=b;if(!region){const width=dimensions(false,size).width;for(const shift of [-width,width]){const candidate={q:b.q+shift,r:b.r};if(distance(candidate)<distance(end))end=candidate;}}
  return {from:a,to:end,distance:distance(end)};
 }
 function routePoint(route,f,region=false,size){const r=route.from.r+(route.to.r-route.from.r)*f,q=route.from.q+(route.to.q-route.from.q)*f;let x=26+48.5*(q+r/2);if(!region){const period=48.5*dimensions(false,size).width,edge=1.75+24.25*(r%2);x=((x-edge)%period+period)%period+edge;}return {x,y:30+42*r};}
 // Low-frequency continental fields create large connected oceans.
 // Rank the field once to retain ~70% water, with no per-cell random speckling.
 function generate(seed,type='temperate',region=false,uniform=false,size='large'){
  const all=cells(region,size),{width,height}=dimensions(region,size);if(uniform||type!=='temperate')return all.map(()=>types.includes(type)?type:'moon');
  const key=String(seed)+'/'+region+'/'+size;if(cache.has(key))return cache.get(key).slice();
  // Preserve the existing terrain as well as authored overrides. The added band
  // has its own seeded continents; it is not a repeated copy of the old world.
  const generated=generateBand(seed,region?15:30,height);
  if(!region&&width>30){const left=Array.from({length:height},(_,row)=>generated[row*30+29]);generated.push(...generateBand(seed+'/expanded',width-30,height,{left}));}
  if(cache.size>32)cache.delete(cache.keys().next().value);cache.set(key,generated);return generated.slice();
 }
 function generateBand(seed,width,height,edges){
  const all=Array.from({length:width*height},(_,i)=>({column:i%width,row:Math.floor(i/width)}));
  const rand=random(seed),centers=Array.from({length:4},()=>({x:rand()*width,y:2+rand()*(height-4),rx:width*(.12+rand()*.13),ry:height*(.18+rand()*.18)}));
  const scores=all.map(({column:x,row:y},i)=>{
   let n=centers.reduce((n,c)=>{const d=Math.min(Math.abs(x-c.x),width-Math.abs(x-c.x));return n+Math.exp(-((d/c.rx)**2+((y-c.y)/c.ry)**2)*2);},0)+.035*Math.sin(x/width*Math.PI*4+y*.5+hash(seed)%31);
   if(edges){const edge=edges.right&&x>=width/2?edges.right:edges.left,w=Math.max(0,1-(edges.right?Math.min(x,width-1-x):x)/8),coast=[-2,-1,0,1,2].reduce((sum,dy)=>sum+(edge[Math.max(0,Math.min(height-1,y+dy))]==='temperate'?1:0),0)/5;n=n*(1-w)+coast*w;}
   return {i,n};
  }).sort((a,b)=>b.n-a.n||a.i-b.i);
  // Join the original shores without a straight seam through their continents.
  const fixed=new Map();if(edges)for(let row=0;row<height;row++){fixed.set(row*width,edges.left[row]);if(edges.right)fixed.set(row*width+width-1,edges.right[row]);}
  const land=new Set([...fixed].filter(([,type])=>type==='temperate').map(([i])=>i));
  for(const score of scores){if(land.size>=Math.round(all.length*.3))break;if(!fixed.has(score.i))land.add(score.i);}
  return all.map((_,i)=>land.has(i)?'temperate':'ocean');
 }
 function terrain(seed,type,overrides={},region=false,uniform=false,size){return generate(seed,type,region,uniform,size).map((value,i)=>overrides[i]?.terrain||value);}
 function validHex(value,region=false,size){return /^\d+$/.test(String(value))&&Number(value)<count(region,size)&&Number(value)>=0;}
 // Used only during migration, before old IDs are remapped to the bounded grid.
 function legacyCell(key){const i=Number(key),expanded=i>=1200,n=expanded?i-1200:i,w=expanded?114:30;return {column:n%w+(expanded?30:0),row:Math.floor(n/w)};}
 function legacyGenerate(seed,type){if(type!=='temperate')return Array(5760).fill(types.includes(type)?type:'moon');const base=generateBand(seed,30,40),left=Array.from({length:40},(_,r)=>base[r*30+29]),right=Array.from({length:40},(_,r)=>base[r*30]);return base.concat(generateBand(seed+'/expanded',114,40,{left,right}));}
 function definitions(){return `<defs><pattern id="pt-temperate" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#477d58"/><path d="M0 31Q12 14 24 30T48 31M-8 10Q6 0 20 10T48 11" fill="none" stroke="#7fa470" stroke-width="2" opacity=".55"/><path d="M9 19l4-8 4 8zM32 39l4-9 4 9z" fill="#274f3b"/></pattern><pattern id="pt-ocean" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#245c7b"/><path d="M0 12Q6 6 12 12T24 12T36 12T48 12M0 32Q6 26 12 32T24 32T36 32T48 32" fill="none" stroke="#5096b0" stroke-width="1.5" opacity=".55"/></pattern><pattern id="pt-desert" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#b68f52"/><path d="M-8 28Q10 2 34 26T60 19M-9 38Q14 16 39 39" fill="none" stroke="#ebc785" stroke-width="3" opacity=".7"/></pattern><pattern id="pt-ice" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#a1c3d1"/><path d="M5 42L24 5 45 42M24 5L20 26 30 20" fill="#d6e8eb" stroke="#779eaf" stroke-width="1.5"/></pattern><pattern id="pt-volcanic" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#39343e"/><path d="M5 0L18 15 12 27 32 42M18 15L37 9 48 19" fill="none" stroke="#ef8447" stroke-width="2"/><path d="M0 39L18 20 30 39" fill="#51464d"/></pattern><pattern id="pt-moon" width="48" height="42" patternUnits="userSpaceOnUse"><rect width="48" height="42" fill="#777b86"/><ellipse cx="14" cy="15" rx="9" ry="7" fill="#555b68" stroke="#a3a6ad"/><ellipse cx="37" cy="34" rx="6" ry="5" fill="#555b68" stroke="#a3a6ad"/></pattern><g id="pt-city"><path d="M-15 11V-7h8v-8h10v10h10v16z" fill="#e7dac2" stroke="#302d32" stroke-width="2"/><path d="M-11-3v3m0 4v3M-3-10v3m6 2v3m5 1v3" stroke="#6f8f99" stroke-width="3"/></g><g id="pt-pin">${pinShape}</g></defs>`;}
 function partyMarker(x,y,scale=1){return `<g transform="translate(${x} ${y}) scale(${scale})" pointer-events="none" aria-label="Party location"><title>Party location</title>${pinShape}</g>`;}
 function texture(type){if(!types.includes(type))return '';return 'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="42">'+definitions()+'<rect width="48" height="42" fill="url(#pt-'+type+')"/></svg>');}
 return {definitions,partyMarker,texture,types,colors,hash,random,dimensions,count,cell,hexAt,cells,point,geometry,route,routePoint,generate,terrain,sizes,validHex,legacyCell,legacyGenerate};
});
