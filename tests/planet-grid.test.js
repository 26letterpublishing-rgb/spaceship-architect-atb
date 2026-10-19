const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const terrain=require('../planet-terrain'),motion=require('../planet-motion');
test('all sizes have dense IDs, matching render and hit coordinates, and hard boundaries',()=>{
 for(const [size,width,height]of [['large',120,40],['small',60,20],['moon',30,10]]){
  assert.deepEqual(terrain.dimensions(false,size),{width,height});const positions=new Set();
  for(const c of terrain.cells(false,size)){
   positions.add(c.column+':'+c.row);assert.equal(terrain.hexAt(c.column,c.row,false,size),c.key);
   const p=motion.point(c.key,false,size),row=Math.round((p.y-30)/42),col=Math.round((p.x-26)/48.5-(row%2)/2);
   assert.equal(terrain.hexAt(col,row,false,size),c.key);
   if(Number(c.key)<30*height){assert.equal(c.column,Number(c.key)%30);assert.equal(c.row,Math.floor(Number(c.key)/30));}
  }
  assert.equal(positions.size,width*height);assert.equal(terrain.generate('size','moon',false,false,size).length,width*height);
  assert.equal(terrain.validHex(width*height,false,size),false);
  for(const [x,y]of [[-1,0],[width,0],[0,-1],[0,height]])assert.equal(terrain.hexAt(x,y,false,size),null);
  assert.equal(terrain.route(terrain.hexAt(0,0,false,size),terrain.hexAt(width-1,0,false,size),false,size).distance,width-1);
 }
 assert.equal(terrain.cells(true).length,150);assert.equal(terrain.hexAt(15,0,true),null);
});
test('legacy core terrain is identical; added continents are unique and deterministic',()=>{
 const values=terrain.generate('legacy-check');
 assert.equal(createHash('sha256').update(JSON.stringify(values.slice(0,1200))).digest('hex'),'176f9f397c5cdac72212e7018e61d06f7600e98535adbccd1817c9800a2261a1');
 const bands=[0,30,60,90].map(start=>Array.from({length:1200},(_,i)=>values[terrain.hexAt(start+i%30,Math.floor(i/30))]));
 assert.equal(new Set(bands.map(b=>b.join(','))).size,4);
 for(let row=0;row<40;row++)assert.equal(terrain.route(terrain.hexAt(29,row),terrain.hexAt(30,row)).distance,1);
 values[0]='mutated';assert.notEqual(terrain.generate('legacy-check')[0],'mutated');
});
