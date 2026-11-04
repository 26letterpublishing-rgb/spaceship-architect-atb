const test=require('node:test'),assert=require('node:assert/strict');
const make=require('../showcase-starters'),maps=require('../ship-map-core'),power=require('../ship-power');
const common=['en-au-engine-4','en-au-engine-2','bridge-2','life-support','sensors-2','lock-on-3','shield-1','warp-drive-1','repair-drone-1','exhaust-thruster-3','exhaust-thruster-3','decent-hover'];
for(const side of ['pc','gm'])test(`fresh ${side} ship has approved systems, safe geometry and an accessible airlock`,()=>{
 const s=make('test',side,['pc-a','pc-b'],['npc-a']),ship=s.ship;
 assert.equal(s.title,side==='pc'?'Lantern':'Cinderwake');
 assert.deepEqual(ship.sicInventory.map(i=>i.type).sort(),[...common,side==='pc'?'beam-laser-6':'ripple-cannon-2'].sort());
 assert.deepEqual(power.designBudget(s),{output:42,demand:side==='pc'?38:35,available:side==='pc'?4:7,au:12});
 assert.equal(maps.exteriorError(ship),'');assert.equal(power.constructionError(s),'');
 const used=new Set();for(const p of ship.placements){const item=ship.sicInventory.find(i=>i.id===p.sicId);for(const n of maps.placementSquares(ship,item,p)){assert.ok(!used.has(n),'No overlapping SICs');used.add(n);}}
 const layout=maps.buildLayout(ship),hatch=ship.airlocks[0];assert.equal(ship.airlocks.length,1);assert.ok(maps.airlockCandidates(ship).some(a=>a.square===hatch.square&&a.side===hatch.side));
 assert.ok(!layout.footprint.has(hatch.square),'Hatch opens into corridor, not an SIC');
 for(let n=hatch.square-11;n<=hatch.square;n++){assert.ok(layout.hull.has(n));assert.ok(!layout.footprint.has(n),'Continuous clear corridor');}
 assert.ok(maps.propulsion(s).moveSpeed>0);assert.deepEqual(s.crewCharacterIds,['pc-a','pc-b']);assert.deepEqual(s.crewNpcUnitIds,['npc-a']);
 const roundtrip=JSON.parse(JSON.stringify(s));maps.ensureAirlocks(roundtrip);assert.deepEqual(roundtrip,s);
 const untouched=JSON.parse(JSON.stringify(s));make('another',side);assert.deepEqual(s,untouched,'Generating another default cannot mutate existing ships');
});
