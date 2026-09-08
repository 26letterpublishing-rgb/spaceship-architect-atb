const test = require('node:test');
const assert = require('node:assert/strict');
const maps = require('../ship-map-core');

test('compact map fits distant and co-located ships without the old headings', () => {
  const fs=require('node:fs'), vm=require('node:vm');
  const context={window:{SAShipDistances:require('../ship-distances')},document:{addEventListener(){}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../space-map.js'),'utf8'),context);
  const ships=Array.from({length:6},(_,i)=>({id:String(i),title:`Ship ${i}`}));
  const points=ships.map(ship=>({id:ship.id,q:9000,r:9000}));
  const html=context.window.SASpaceMap.markup(ships,points);
  const [x,y,width,height]=html.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  assert.ok(Math.abs(width/height-3.4)<1e-9);
  assert.ok(x>10000); // Do not include the origin when fitting ships far away.
  assert.doesNotMatch(html,/<h3>|1 hex = 1 Unit/);
  const centerY=1.5*9000;
  for(const match of html.matchAll(/<text y="([^"]+)"/g)) {
    const labelY=centerY+Number(match[1]);
    assert.ok(labelY>y && labelY<y+height);
  }
});

test('exterior sprites point away from the hull on all four sides', () => {
  const ship = { gridCells: [21,22,41,42], sicInventory: [], placements: [] };
  for (const [cell, angle] of [[1,180],[23,270],[61,0],[20,90]]) {
    ship.sicInventory.push({id:`t${cell}`,type:'exhaust-thruster-1'});
    ship.placements.push({sicId:`t${cell}`,cell});
    const layout=maps.buildLayout(ship);
    assert.equal(maps.exteriorFacing(layout,cell),angle);
    assert.match(maps.surfaceMarkup(layout,cell),new RegExp(`--thruster-angle:${angle}deg`));
    assert.match(maps.surfaceMarkup(layout,cell),/is-firing/);
    assert.equal(layout.footprint.get(cell).blocked,true);
  }
  ship.sicInventory[0].status='offline';
  assert.doesNotMatch(maps.surfaceMarkup(maps.buildLayout(ship),1),/is-firing/);
});

test('hull plating follows the purchased silhouette without interior borders', () => {
  const ship={gridCells:[21,22,41],sicInventory:[],placements:[]};
  const layout=maps.buildLayout(ship);
  const topLeft=maps.surfaceMarkup(layout,21);
  assert.match(topLeft,/edge-top/);assert.match(topLeft,/edge-left/);
  assert.doesNotMatch(topLeft,/edge-bottom|edge-right/);
  assert.equal(maps.surfaceMarkup(layout,42),'');
  assert.equal(layout.hull.size,3);
});

test('six view controls suspend interior settings without overwriting them', () => {
  const view={labels:true,highResolution:false,combatMesh:true,walls:true,stations:true,hull:true};
  const before=JSON.stringify(view);
  const html=maps.viewControls(view,'data-test-view');
  assert.equal((html.match(/type="checkbox"/g)||[]).length,6);
  for(const key of ['labels','combatMesh','walls','stations']) {
    assert.match(html,new RegExp(`data-test-view="${key}"\\s+disabled`));
    assert.equal(maps.viewDisabled(view,key),true);
  }
  assert.equal(JSON.stringify(view),before);
  view.hull=false;
  assert.match(maps.viewControls(view,'data-test-view'),/data-test-view="stations" checked/);
});
