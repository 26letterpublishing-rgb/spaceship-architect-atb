const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('../ship-map-core'),distances=require('../ship-distances');
const ship=()=>({gridCells:[21,22,41,42],sicInventory:[{id:'t',type:'exhaust-thruster-1'}],placements:[]});
test('GM unit actions do not swallow unrelated map controls',()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const start=source.indexOf('function handleUnitActionButton(');
  const end=source.indexOf('unitList.addEventListener("click"',start);
  const calls=[];
  const context={mode:'gm',action:payload=>calls.push(payload)};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  let swallowed=0;
  const event={preventDefault(){swallowed++;},stopPropagation(){swallowed++;}};
  context.handleUnitActionButton({dataset:{spaceEnlarge:''}},event);
  assert.equal(swallowed,0);
  context.handleUnitActionButton({dataset:{action:'nudge',id:'pc'}},event);
  assert.equal(swallowed,2);assert.equal(calls[0].action,'nudge');
});
test('exterior placement attaches to outer walls, never interiors, holes, corners or occupied space',()=>{
  const s=ship();
  for(const cell of [1,2,20,40,23,43,61,62])assert.equal(maps.exteriorPlacement(s,'exhaust-thruster-1',cell),true);
  for(const cell of [0,21,22,41,42,63,399,-1,400])assert.equal(maps.exteriorPlacement(s,'exhaust-thruster-1',cell),false);
  s.placements=[{sicId:'t',cell:20}];
  assert.equal(maps.exteriorPlacement(s,'exhaust-thruster-1',20),false);
  assert.equal(maps.exteriorPlacement(s,'exhaust-thruster-1',20,'t'),true);
  const ring={gridCells:[21,22,23,41,43,61,62,63],sicInventory:[],placements:[]};
  assert.equal(maps.exteriorPlacement(ring,'exhaust-thruster-1',42),false);
  const layout=maps.buildLayout(s);
  assert.equal(layout.hull.size,4);assert.equal(layout.footprint.get(20).blocked,true);
  assert.equal(layout.boundary(21,'left').kind,'wall');assert.equal(layout.boundary(20,'right').kind,'none');
});
test('thrusters calculate HSM, impulse, exhaust and impairment without changing hull area',()=>{
  const s=ship();s.placements=[{sicId:'t',cell:20}];
  assert.deepEqual(maps.propulsion(s),{hsm:20,impulses:[11],rawSpeed:11,moveSpeed:11,exhaust:-2,evadeCount:1,evadeDie:8});
  s.sicInventory[0].impaired=true;assert.equal(maps.propulsion(s).evadeCount,0);assert.equal(maps.propulsion(s).moveSpeed,11);
  s.sicInventory[0].status='offline';assert.equal(maps.propulsion(s).moveSpeed,0);
  s.sicInventory=Array.from({length:5},(_,i)=>({id:String(i),type:'exhaust-thruster-1'}));assert.match(maps.exteriorError(s),/four/);
  const large={gridCells:Array.from({length:151},(_,i)=>i+20),sicInventory:[{id:'t',type:'exhaust-thruster-1'}],placements:[{sicId:'t',cell:0}]};
  assert.equal(maps.propulsion(large).hsm,-5);assert.equal(maps.propulsion(large).rawSpeed,-1);assert.equal(maps.propulsion(large).moveSpeed,0);
});
test('hex positions produce symmetric consistent distances and validate every ship',()=>{
  const ships=Array.from({length:6},(_,i)=>({id:String(i)}));
  const points=distances.positions(ships);assert.equal(distances.fromPositions(ships,points).length,15);
  assert.equal(distances.hexDistance(points[0],points[1]),25);
  for(const a of points)for(const b of points)for(const c of points){assert.equal(distances.hexDistance(a,b),distances.hexDistance(b,a));assert.ok(distances.hexDistance(a,c)<=distances.hexDistance(a,b)+distances.hexDistance(b,c));}
  assert.deepEqual(distances.validatePositions(ships,points),points);
  assert.throws(()=>distances.validatePositions(ships,points.slice(1)));
  assert.throws(()=>distances.validatePositions(ships,[...points.slice(1),points[1]]));
  assert.throws(()=>distances.validatePositions(ships,points.map((p,i)=>i? p:{...p,q:.5})));
  assert.throws(()=>distances.validatePositions(ships,points.map((p,i)=>i? p:{...p,r:Infinity})));
});
