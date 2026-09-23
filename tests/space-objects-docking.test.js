const test=require('node:test'),assert=require('node:assert/strict');
const field=require('../ship-field-utilities'),objects=require('../space-objects'),fixture=require('./helpers/field-utility-fixture.cjs'),stations=require('../station-access'),maps=require('../ship-map-core');
test('preparation refresh removes recovered objects without losing new or edited GM placements',()=>{
 const a={id:'object-iron',q:0,r:1},b={id:'object-rock',q:1,r:0},c={id:'object-new',q:2,r:2};
 assert.deepEqual(objects.reconcile(null,[],[a,b]),[a,b]);
 assert.deepEqual(objects.reconcile([a,b],[a,{...b,q:3},c],[b]),[{...b,q:3},c]);
 assert.deepEqual(objects.reconcile([a,b],[b],[a,b]),[b],'A manually removed object stays removed');
 assert.deepEqual(objects.reconcile([a,b],[a,b],[a,{...b,q:5}]),[a,{...b,q:5}]);
});
test('object validation rejects invalid coordinates, names, minerals and duplicate IDs',()=>{
 const o={id:'object-test',kind:'mineral',name:'Iron',mineral:'Iron',quantity:5,q:1,r:0};assert.equal(objects.normalize([o])[0].quantity,5);
 for(const change of [{q:Infinity},{r:1.5},{quantity:-1},{mineral:'__proto__'},{name:''}])assert.throws(()=>objects.normalize([{...o,...change}]));assert.throws(()=>objects.normalize([o,o]));
});
test('tractor recovery adds minerals once and arm recovery requires the same hex',()=>{
 const f=fixture();f.seat('tractor');f.room.spaceObjects=objects.normalize([{id:'object-test',kind:'mineral',name:'Iron',mineral:'Iron',quantity:5,q:1,r:0}]);
 const body={starshipId:f.ship.id,sicId:'tractor',kind:'collect-object',targetId:'object-test',receipt:'retrieve-object-1'},opts={campaign:f.campaign,outsideCombat:true};
 let result=field.command(f.room,f.unit,body,opts);assert.equal(result.ok,true,result.error);assert.equal(f.ship.ship.minerals.Iron,5);assert.equal(field.command(f.room,f.unit,body,opts).duplicate,true);assert.equal(field.command(f.room,f.unit,{...body,receipt:'retrieve-object-2'},opts).ok,false);
 f.room.spaceObjects.push({id:'object-cargo',kind:'object',name:'Survey Cache',quantity:1,q:1,r:0});f.seat('arm');const arm={...body,sicId:'arm',targetId:'object-cargo',receipt:'retrieve-object-3'};assert.equal(field.command(f.room,f.unit,arm,opts).ok,false);f.room.spaceObjects[1].q=0;assert.equal(field.command(f.room,f.unit,arm,opts).ok,true);assert.equal(f.ship.ship.fieldState.cargo[0].name,'Survey Cache');
});
test('a bay accepts four one-eighth-Hull ships and releases a chosen vessel',()=>{
 const f=fixture();f.seat('bay');const hostHull=f.ship.ship.gridCells.length,size=Math.floor(hostHull/8);f.room.shipPositions.forEach(p=>{p.q=0;p.r=0;});
 f.room.starships=f.room.starships.filter(s=>s.id===f.ship.id);for(let n=0;n<5;n++){const s=structuredClone(f.target);s.id='small-'+n;s.title=s.id;s.ship.gridCells=s.ship.gridCells.slice(0,size);f.room.starships.push(s);f.room.shipPositions.push({id:s.id,q:0,r:0});}
 const opts={gm:true,campaign:f.campaign,outsideCombat:true};for(let n=0;n<5;n++){const result=field.command(f.room,f.unit,{starshipId:f.ship.id,sicId:'bay',kind:'dock',targetId:'small-'+n,decompressed:true,receipt:'dock-small-'+n},opts);assert.equal(result.ok,n<4,result.error);}
 assert.equal(field.bayCapacity(f.room,f.ship,'bay').ships.length,4);assert.equal(field.command(f.room,f.unit,{starshipId:f.ship.id,sicId:'bay',kind:'undock',targetId:'small-2',decompressed:true,receipt:'undock-small-2'},opts).ok,true);assert.equal(field.bayCapacity(f.room,f.ship,'bay').ships.length,3);assert.equal(f.room.starships.find(s=>s.id==='small-0').ship.fieldState.dockedIn.shipId,f.ship.id);
});
test('meeting room access works across its entire floor without occupying a specific seat',()=>{
 const ship={id:'s',ship:{gridCells:maps.rectangleCells({},42,3,3),sicInventory:[{id:'meeting',type:'meeting-room'}],placements:[{sicId:'meeting',cell:42}]}},unit={id:'u',currentHp:10,location:{starshipId:'s',square:63,mesh:4,stationed:false,sicId:''}},room={starships:[ship],units:[unit]};
 assert.equal(stations.access(room,unit,'meeting').id,'meeting');unit.location.square=20;assert.equal(stations.access(room,unit,'meeting'),null);unit.location.square=63;unit.currentHp=0;assert.equal(stations.access(room,unit,'meeting'),null);
});
