const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('./near-zero-ship-targets.test'),'utf8');
const fixture=new Function('require',source.slice(0,source.indexOf("test('"))+'return fixture;')(require);
const sensors=require('../ship-sensors');
function setup(){const f=fixture();sensors.report(f.a,{analysis:true,targetId:'b',text:'Analysis',layout:structuredClone(f.b.ship),snapshot:{layout:structuredClone(f.b.ship)}});return {...f,visible:()=>sensors.view(f.room,'a').starships.find(s=>s.id==='b')};}
test('authorized analyzed floorplan tracks impairment increases and repairs without modifying historical analysis',()=>{
 const f=setup(),saved=JSON.stringify(sensors.analysis(f.a,'b')),item=f.b.ship.sicInventory[0];
 for(const points of [1,3,4,0]){Object.assign(item,{impairmentPoints:points,impaired:points>0,status:points===4?'destroyed':points?'impaired':'online'});const v=f.visible().ship.sicInventory[0];assert.equal(v.impairmentPoints,points);assert.equal(v.impaired,points>0);assert.equal(v.status,points===4?'destroyed':points?'impaired':undefined);assert.equal(JSON.stringify(sensors.analysis(f.a,'b')),saved);}
});
test('live impairment refresh never discloses new or replaced equipment or unrelated live fields',()=>{
 const f=setup(),before=structuredClone(sensors.analysis(f.a,'b').layout),item=f.b.ship.sicInventory[0];
 Object.assign(item,{impairmentPoints:2,impaired:true,status:'powered-down',secret:'not disclosed',bootRemaining:17});f.b.ship.sicInventory.push({id:'secret',type:'science-lab',impairmentPoints:3});f.b.ship.placements.push({sicId:'secret',cell:99});f.b.ship.doorStates={secret:true};
 const v=f.visible().ship;assert.equal(v.sicInventory.length,before.sicInventory.length);assert.deepEqual(v.placements,before.placements);assert.equal(v.sicInventory[0].secret,undefined);assert.equal(v.sicInventory[0].bootRemaining,undefined);assert.equal(v.sicInventory[0].status,undefined);assert.deepEqual(v.doorStates,before.doorStates);
 item.type='science-lab';assert.equal(f.visible().ship.sicInventory[0].impairmentPoints,undefined);
});
test('lost and unanalyzed contacts do not gain floorplans or impairment data',()=>{
 const f=setup();f.b.ship.sicInventory[0].impairmentPoints=3;f.a.sensorState.contacts.b.level='lastKnown';assert.equal(f.visible().ship.sicInventory.length,0);
 f.a.sensorState.contacts.b.level='detected';f.a.sensorState.analyses={};f.a.sensorState.reports=[];assert.equal(f.visible().ship.sicInventory.length,0);
});
