const test=require('node:test'),assert=require('node:assert/strict');
const sensors=require('../ship-sensors'),health=require('../health-display');
function fixture(){
 const ship=id=>({id,title:id==='b'?'Cinderwake':'Observer',currentHullHp:94,maximumHullHp:96,currentShieldHp:0,maximumShieldHp:10,sensorScenarioMasking:1,ship:{gridCells:[42,43,44,62,63,64],placements:[{sicId:'cp',cell:42},{sicId:'sn',cell:43}],sicInventory:[{id:'cp',type:'cockpit-1'},{id:'sn',type:'sensors-3'}],doorStates:{}}});
 const a=ship('a'),b=ship('b'),room={showcase:true,starships:[a,b],units:[],shipPositions:[{id:'a',q:0,r:0},{id:'b',q:2,r:0}],log:[],threshold:100};
 sensors.refresh(room);return {a,b,room};
}
test('current authorized enemy condition wins over historical exact analysis without changing records',()=>{
 const {a,b,room}=fixture();sensors.report(a,{analysis:true,targetId:'b',text:'Systems Analysis',layout:structuredClone(b.ship),hull:{current:94,maximum:96},shield:{current:0,maximum:10,layers:[]}});
 b.currentHullHp=2;sensors.refresh(room);const projected=sensors.view(room,'a').starships.find(s=>s.id==='b');
 assert.equal(projected.currentHullHp,0);assert.equal(projected.maximumHullHp,6);assert.equal(projected.analysisHealth.hull.current,94);
 const before=JSON.stringify(projected);
 for(const exact of [false,true]){const html=health.hull(projected,exact);assert.equal((html.match(/sa-health-icon hull empty/g)||[]).length,3);assert.doesNotMatch(html,/94|96|<small>|sa-analysis-meter/);}
 assert.equal(JSON.stringify(projected),before);assert.equal(b.currentHullHp,2);
 assert.match(health.hull(b,true),/2\/96/);assert.doesNotMatch(health.hull(b,false),/<small>/);
});
test('analyzed shield icons use filtered current layers, never historical exact readings',()=>{
 const record={id:'shield-display',analyzedContact:true,shieldConditions:[1,0],analysisHealth:{shield:{current:10,maximum:10}}};
 const html=health.shields(record,true);assert.equal((html.match(/sa-health-icon shield/g)||[]).length,6);assert.equal((html.match(/shield half/g)||[]).length,1);assert.doesNotMatch(html,/<small>|10|sa-analysis-meter/);
 assert.equal(health.shields({...record,contactOnly:true}), '');
});
test('unanalyzed and unknown contacts gain no exact values or shield systems',()=>{
 const {room,b}=fixture();b.currentHullHp=2;sensors.refresh(room);const p=sensors.view(room,'a').starships.find(s=>s.id==='b');assert.equal(p.contactOnly,true);assert.equal(p.analysisHealth,undefined);assert.equal(health.shields(p,true),'');assert.doesNotMatch(health.hull(p,true),/<small>|96/);
 room.starships[0].sensorState.contacts.b={id:'unknown-a',level:'unknown',title:'Unknown Object',position:{q:3,r:0}};
 const unknown=sensors.view(room,'a').starships.find(s=>s.id==='unknown-a');assert.equal(unknown.analysisHealth,undefined);assert.equal(health.shields(unknown,true),'');assert.doesNotMatch(JSON.stringify(unknown),/Cinderwake|94|96/);
});
