const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./ship-locks.test.js'),'utf8');
const fixture=new Function('power','sensors',source.slice(source.indexOf('function fixture'),source.indexOf("test('"))+';return fixture;')(require('../ship-power'),require('../ship-sensors'));
const project=require('../fleet-status').project;
test('impairment counts remain limited to GM and the affected ship crew',()=>{
 const {room,a,b,unit}=fixture();unit.characterId='owner';a.crewCharacterIds=['owner'];b.crewCharacterIds=['other'];
 Object.assign(a.ship.sicInventory[0],{impairmentPoints:3,impaired:true});
 for(const session of [{role:'gm'},{role:'character',characterId:'owner'}])assert.equal(project(room,session).damagedSystems[0].impairmentPoints,3);
 for(const session of [{role:'character',characterId:'other'},{role:'character',characterId:'unrelated'},{role:'spectator'},null])assert.equal(project(room,session).damagedSystems.length,0);
 a.ship.sicInventory[0].impairmentPoints=undefined;assert.equal(project(room,{role:'gm'}).damagedSystems[0].impairmentPoints,1);
 a.ship.sicInventory[0].impairmentPoints=4;a.ship.sicInventory[0].status='destroyed';assert.equal(project(room,{role:'gm'}).damagedSystems[0].impairmentPoints,4);
});
function notices(){const calls=[],window={SAResultFeedback:{critical:(...args)=>calls.push(args)},addEventListener(){},dispatchEvent(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../fleet-notices'),'utf8'),{window,CustomEvent:class{}});return {calls,send:(count,ships=['a'])=>window.SAFleetNotices.update({notices:{drones:ships.map(id=>({id})),damagedSystems:count?[{shipId:'a',shipTitle:'Own ship',sicId:'bridge',name:'Bridge 2',impairmentPoints:count}]:[]}})};}
test('first history and duplicates are silent; increases announce actual delta and total',()=>{
 const f=notices();f.send(1);f.send(1);assert.equal(f.calls.length,0);f.send(3);assert.equal(f.calls.length,1);assert.match(f.calls[0][1],/gained 2 impairments \(3 total\)/);f.send(3);assert.equal(f.calls.length,1);
});
test('repairs stay silent and later damage has a distinct notice',()=>{
 const f=notices();f.send(0);f.send(1);f.send(0);assert.equal(f.calls.length,1);f.send(1);assert.equal(f.calls.length,2);assert.notEqual(f.calls[0][0],f.calls[1][0]);f.send(4);assert.match(f.calls[2][1],/gained 3 impairments \(4 total\)/);
});
test('newly authorized or reappearing ships establish a baseline rather than replaying damage',()=>{
 const f=notices();f.send(0,[]);f.send(2);assert.equal(f.calls.length,0);f.send(3);assert.equal(f.calls.length,1);f.send(0,[]);f.send(4);assert.equal(f.calls.length,1);
});

test('compact combat packets cannot erase the full campaign ship baseline',()=>{const calls=[],window={SAResultFeedback:{critical:(...a)=>calls.push(a)},addEventListener(){},dispatchEventListener(){},dispatchEvent(){}};vm.runInNewContext(fs.readFileSync(require.resolve('../fleet-notices'),'utf8'),{window,CustomEvent:class{}});const update=notices=>window.SAFleetNotices.update({notices});update({drones:[{id:'a'}],damagedSystems:[]});update({damagedSystems:[]});update({drones:[{id:'a'}],damagedSystems:[{shipId:'a',sicId:'bridge',shipTitle:'A',name:'Bridge',impairmentPoints:1}]});assert.equal(calls.length,1);});
