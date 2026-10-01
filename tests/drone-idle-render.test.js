const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('idle drone overlay never measures a large hull and removes departed drones',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../drone-map.js'),'utf8'),{window});
 let removed=0,queries=0;const grid={querySelector(selector){queries++;assert.equal(selector,'.drone-map-layer');return {remove(){removed++;}};},getBoundingClientRect(){throw Error('Idle overlay measured layout');}};
 window.SADroneMap.update([grid],{gridCells:Array.from({length:343},(_,i)=>i)},[]);
 assert.equal(queries,1);assert.equal(removed,1);
});
