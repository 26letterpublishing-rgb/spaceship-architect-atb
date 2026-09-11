const test=require('node:test'),assert=require('node:assert/strict'),wire=require('../combat-wire');
test('combat deltas preserve untouched hardware and do not mutate earlier snapshots',()=>{
  const before={revision:1,starships:[{ship:{gridCells:[1,2],sicInventory:[{type:'laser'}]},au:4}],units:[{id:'a',atb:2}],old:true};
  const after=structuredClone(before);after.revision=2;after.units[0].atb=3;delete after.old;
  const next=wire.apply(before,{base:1,changes:wire.diff(before,after)});assert.deepEqual(next,after);assert.equal(next.starships,before.starships);assert.equal(before.units[0].atb,2);assert.equal(before.old,true);
});
test('combat deltas handle array replacement, nulls and reconnect mismatch',()=>{
  let previous={revision:1,units:[],value:null};
  for(let i=2;i<100;i++){const next={revision:i,units:Array.from({length:i%5},(_,j)=>({id:j,hp:i-j})),value:i%2?{a:[i]}:null};assert.deepEqual(wire.apply(previous,{base:previous.revision,changes:wire.diff(previous,next)}),next);previous=next;}
  assert.throws(()=>wire.apply(previous,{base:1,changes:[]}),/snapshot/);
  assert.throws(()=>wire.apply(previous,{base:previous.revision,changes:[[['__proto__','bad'],1]]}),/Invalid/);
});
