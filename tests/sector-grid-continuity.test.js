const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../campaign-starmaps-ui.js'),'utf8');
const pattern=source.match(/<pattern id="galaxy-hex-grid"[\s\S]*?<\/pattern>/)[0];
const d=pattern.match(/<path d="([^"]+)"/)[1],a=.866025404,W=2*a;
function segments(path){
 const tokens=path.match(/[MLVZ]|-?(?:\d*\.)?\d+/g),edges=[];let p,start;
 for(let i=0;i<tokens.length;){const c=tokens[i++];let q;
  if(c==='M'){p=[+tokens[i++],+tokens[i++]];start=p;continue;}
  if(c==='L')q=[+tokens[i++],+tokens[i++]];else if(c==='V')q=[p[0],+tokens[i++]];else if(c==='Z')q=start;else throw Error(c);
  edges.push([p,q]);p=q;
 }return edges;
}
const edges=segments(d);
function covered(x,y){return edges.some(([p,q])=>{const cross=(x-p[0])*(q[1]-p[1])-(y-p[1])*(q[0]-p[0]);return Math.abs(cross)<1e-8&&x>=Math.min(p[0],q[0])-1e-9&&x<=Math.max(p[0],q[0])+1e-9&&y>=Math.min(p[1],q[1])-1e-9&&y<=Math.max(p[1],q[1])+1e-9;});}
test('Sector lattice covers complete hex edges across three horizontal and vertical tile seams',()=>{
 for(let row=-1;row<=1;row++)for(let col=-1;col<=1;col++)for(const cy of [0,1.5,3]){
  const cx=(cy===1.5?a:0)+col*W,centerY=cy+row*3;
  const vertices=[[0,-1],[a,-.5],[a,.5],[0,1],[-a,.5],[-a,-.5]];
  for(let e=0;e<6;e++)for(const t of [.1,.3,.5,.7,.9]){
   const p=vertices[e],q=vertices[(e+1)%6],x=cx+p[0]+(q[0]-p[0])*t,y=centerY+p[1]+(q[1]-p[1])*t;
   const tx=((x%W)+W)%W,ty=((y%3)+3)%3;
   assert.ok(covered(tx,ty),`missing periodic edge ${x},${y} -> ${tx},${ty}`);
  }
 }
});
test('missing half-edge joins next tile without changing period or stroke',()=>{
 assert.match(pattern,/width="1.732050808" height="3"/);assert.match(pattern,/stroke-opacity=".22" stroke-width=".022"/);
 for(let y=2.51;y<3.5;y+=.02)assert.ok(covered(a,y%3),`gap at ${y}`);
 assert.equal(edges.filter(([p,q])=>p[0]===a&&q[0]===a&&p[1]<=2.75&&q[1]>=2.75).length,1,'no doubled missing segment');
});
