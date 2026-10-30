const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const maps=require('../ship-map-core'),source=fs.readFileSync(require.resolve('../space-map.js'),'utf8');
const context={xy:p=>({x:Math.sqrt(3)*(p.q+p.r/2),y:1.5*p.r})};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  function sensorRange('),source.indexOf('  function conditionMarkup(')),context);
function canvas(){
 const nodes=[],svg={namespaceURI:'http://www.w3.org/2000/svg',camera:'-10 -10 20 20',halo:{id:'enemy',r:4}};
 svg.ownerDocument={createElementNS(ns,tag){assert.equal(tag,'circle');return {dataset:{},style:{},attrs:{},setAttribute(k,v){this.attrs[k]=String(v)},remove(){nodes.splice(nodes.indexOf(this),1)}}}};
 svg.append=n=>nodes.push(n);svg.querySelectorAll=()=>nodes.slice();svg.querySelector=s=>nodes.find(n=>n.dataset.sensorRange===s.match(/="(.*?)"/)[1]);return {svg,nodes};
}
function ship(type='sensors-1'){return {sicInventory:[{id:'bridge',type:'bridge-2'},{id:'sn',type}],placements:[{sicId:'bridge',cell:0},{sicId:'sn',cell:10}]};}
function radii(nodes,range){assert.equal(nodes.length,2);assert.deepEqual(nodes.map(n=>Number(n.attrs.r)),[range*Math.sqrt(3),range*Math.sqrt(3)*2]);}
test('powered own range8 and Protos Sensors3 range12 retain inner and add concentric double ring',()=>{
 for(const [type,range]of [['sensors-1',8],['sensors-3',12]]){const {svg,nodes}=canvas();assert.equal(maps.sensorStats(ship(type)).range,range);context.sensorRange(svg,{q:2,r:4},range);radii(nodes,range);assert.ok(nodes.every(n=>Number(n.attrs.cx)===Math.sqrt(3)*4&&Number(n.attrs.cy)===6&&n.style.pointerEvents==='none'));assert.equal(nodes[0].attrs.fill,'#80cde908');assert.equal(nodes[0].attrs.stroke,'#88cde970');assert.equal(nodes[1].attrs.stroke,'#88cde947');assert.equal(svg.camera,'-10 -10 20 20');assert.deepEqual(svg.halo,{id:'enemy',r:4});}
});
test('repeated redraw, antenna, impairment and movement update the same two nodes',()=>{
 const {svg,nodes}=canvas(),record=ship();context.sensorRange(svg,{q:0,r:0},maps.sensorStats(record).range);const originals=[...nodes];
 record.sicInventory.push({id:'ant',type:'antenna-2'});record.placements.push({sicId:'ant',cell:20});assert.equal(maps.sensorStats(record).range,10);
 for(let i=0;i<20;i++)context.sensorRange(svg,{q:3,r:-2},maps.sensorStats(record).range);radii(nodes,10);assert.deepEqual(nodes,originals);assert.ok(nodes.every(n=>Number(n.attrs.cx)===Math.sqrt(3)*2&&Number(n.attrs.cy)===-3));
 record.sicInventory[1].impaired=true;assert.equal(maps.sensorStats(record).range,6);context.sensorRange(svg,{q:3,r:-2},6);radii(nodes,6);
});
test('off, destroyed, zero range, missing position and Bridge alone remove both rings',()=>{
 for(const mode of ['powered-down','destroyed','zero','position','bridge-only']){const {svg,nodes}=canvas(),record=ship();context.sensorRange(svg,{q:0,r:0},8);if(mode==='bridge-only')record.sicInventory.splice(1);else if(['powered-down','destroyed'].includes(mode))record.sicInventory[1].status=mode;const range=mode==='zero'?0:maps.sensorStats(record).range;context.sensorRange(svg,mode==='position'?null:{q:0,r:0},range);assert.equal(nodes.length,0,mode);context.sensorRange(svg,{q:0,r:0},8);radii(nodes,8);}
});
