const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const maintenance=require('../ship-maintenance'),maps=require('../ship-map-core');
function fixture(){return {ship:{gridCells:[42],sicInventory:[{id:'c',type:'cockpit-1',impaired:true,impairmentPoints:2,disabled:true,status:'powered-down'}],placements:[{sicId:'c',cell:42}]},characterLocations:{pc:{square:42,mesh:0}}};}
test('diagnostics retain a completed result and do not unexpectedly power on a SIC',()=>{
  const ship=fixture();maintenance.diagnostics(ship,'pc');maintenance.passTime(ship,54);assert.equal(ship.ship.maintenanceReports,undefined);
  maintenance.passTime(ship,1);assert.equal(ship.ship.diagnostics.length,0);assert.equal(ship.ship.sicInventory[0].impairmentPoints,0);
  assert.equal(ship.ship.sicInventory[0].disabled,true);assert.match(ship.ship.maintenanceReports[0].text,/complete.*Power state is unchanged/);
  maintenance.passTime(ship,60);assert.equal(ship.ship.maintenanceReports.length,1);
});
test('leaving diagnostics produces a cancellation result without repair',()=>{
  const ship=fixture();maintenance.diagnostics(ship,'pc');ship.characterLocations.pc.square=43;maintenance.passTime(ship,0);
  assert.match(ship.ship.maintenanceReports[0].text,/cancelled/);assert.equal(ship.ship.sicInventory[0].impairmentPoints,2);
});
test('blocked engine centers get a shared low-resolution shade, walkways do not',()=>{
  const ship={gridCells:Array.from({length:9},(_,i)=>42+Math.floor(i/3)*20+i%3),sicInventory:[{id:'engine',type:'en-engine-3'}],placements:[{sicId:'engine',cell:42}]};
  const layout=maps.buildLayout(ship),blocked=[...layout.footprint].filter(([,c])=>c.blocked);
  assert.ok(blocked.length);assert.match(maps.surfaceMarkup(layout,blocked[0][0]),/sa-blocked-floor/);assert.doesNotMatch(maps.surfaceMarkup(layout,42),/sa-blocked-floor/);
});
test('ordinary D12 palette is distinct from damage red',()=>{
  const source=fs.readFileSync(require.resolve('../dice-roller.js'),'utf8');assert.match(source,/12: \{ color: 0x365517/);assert.match(source,/damage\?\{color:0xa40d20/);
});
