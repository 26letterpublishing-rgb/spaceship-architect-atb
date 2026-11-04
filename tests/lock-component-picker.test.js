const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const maps=require('../ship-map-core'),source=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
function render(ship){
 const context={window:{SAShipMap:maps},layoutFor:maps.buildLayout,footprint:r=>maps.buildLayout(r.ship).footprint,interiorRotation:r=>maps.displayRotation(r,270),esc:v=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'),inlineZoom:new Map(),selectedShipId:'secret',preview:{square:42},interaction:'move'};
 // Private state must never be consulted by the Analysis-only path.
 Object.defineProperty(context,'combatState',{get(){throw Error('Read private combat state');}});
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function inlineMapMarkup('),source.indexOf('  const inlineMarkupCache')),context);
 return context.inlineMapMarkup({ship,controlType:'gm'},false,true);
}
const layout=()=>({zoneColumns:20,gridCells:[42,43,44,62,63,64],shipDirection:'up',unifiedShipFacing:true,shipRotation:0,sicInventory:[{id:'known',type:'lock-on-5'},{id:'stored',type:'sensors-1'}],placements:[{sicId:'known',cell:42}]});
test('Analysis preview reuses actual floorplan geometry without live crew, movement or stored SICs',()=>{const ship=layout(),before=JSON.stringify(ship),html=render(ship);assert.match(html,/data-component-sic="known"/);assert.doesNotMatch(html,/data-component-sic="stored"|combat-token|data-map-mesh|data-combat-door|inline-map-move-controls|combat-map-stats/);assert.equal((html.match(/data-component-sic="known"/g)||[]).length,maps.buildLayout(ship).footprint.size);assert.equal(JSON.stringify(ship),before);});
test('rectangular component IDs survive all saved forward references without coordinate mutation',()=>{for(const direction of ['up','right','down','left']){const ship=layout();ship.shipDirection=direction;const html=render(ship);assert.match(html,new RegExp('data-display-rotation="'+maps.displayRotation({ship},270)+'"'));assert.match(html,/data-inline-square="42" data-component-sic="known"/);assert.match(html,/data-inline-square="43" data-component-sic="known"/);}});
test('undisclosed Analysis component is not reconstructed from hull geometry',()=>{const ship=layout();ship.sicInventory=[];ship.placements=[];const html=render(ship);assert.doesNotMatch(html,/data-component-sic|Lock-On/);assert.match(html,/data-inline-square="42"/);});
test('empty disclosed floorplan has a safe empty state',()=>{assert.match(render({gridCells:[],placements:[],sicInventory:[]}),/no confirmed floorplan/);});

test('standalone Console Debug can load the shared preview without Combat DOM or replacing its controls',()=>{
 const openMove=()=>{},links=[],document={querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({dataset:{}}),head:{append:link=>links.push(link)}};
 const context={document,window:{SAShipMap:maps,SACombatMap:{openMove}},location:{href:'http://localhost/console-viewer.html'},URL};
 vm.runInNewContext(source,context);assert.equal(context.window.SACombatMap.openMove,openMove);const html=context.window.SACombatMap.componentPreview(layout(),document);assert.match(html,/data-component-sic="known"/);assert.equal(links.length,3);assert.ok(links.every(link=>link.href.startsWith('http://localhost/')));
});
