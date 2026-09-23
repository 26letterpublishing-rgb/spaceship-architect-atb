const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../space-map.js'),'utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function staggerLabelBoxes('),source.indexOf('  function coverViewport(')),context);
const place=(boxes,viewport={x:0,y:0,width:300,height:200})=>Array.from(context.staggerLabelBoxes(boxes,viewport,3));
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('same-hex scenery and probe labels occupy distinct nearby rows without moving their marker',()=>{
 const labels=[{x:80,y:80,width:70,height:14},{x:90,y:80,width:55,height:14}],original=structuredClone(labels),offsets=place(labels);
 assert.equal(offsets[0],0);assert.ok(Math.abs(offsets[1])<=17);assert.equal(overlap({...labels[0],y:labels[0].y+offsets[0]},{...labels[1],y:labels[1].y+offsets[1]}),false);assert.deepEqual(labels,original);
});
test('labels at the bottom edge stagger upward and stay within the viewport',()=>{
 const labels=[{x:30,y:181,width:65,height:14},{x:35,y:181,width:50,height:14}],offsets=place(labels),result=labels.map((l,i)=>({...l,y:l.y+offsets[i]}));
 assert.equal(overlap(result[0],result[1]),false);for(const box of result){assert.ok(box.y>=3);assert.ok(box.y+box.height<=197);}
});
test('isolated labels retain their placement and dense clusters remain bounded and deterministic',()=>{
 assert.deepEqual(place([{x:10,y:30,width:45,height:14},{x:110,y:30,width:45,height:14}]),[0,0]);
 const labels=Array.from({length:12},()=>({x:60,y:90,width:55,height:14})),first=place(labels);assert.deepEqual(place(labels),first);assert.ok(first.every(dy=>Math.abs(dy)<=4*17));
});
