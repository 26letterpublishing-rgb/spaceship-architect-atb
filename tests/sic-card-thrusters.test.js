const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const maps = require('../ship-map-core');

test('all five Exhaust Thrusters match their printed cards and have both artwork assets', () => {
  const sizes = [[1,1],[2,1],[3,2],[3,2],[4,2]];
  for (let tier = 1; tier <= 5; tier++) {
    const d = maps.definition(`exhaust-thruster-${tier}`);
    assert.deepEqual([d.width,d.height], sizes[tier-1]);
    assert.equal(d.price, tier*200); assert.equal(d.energyCost, tier*2);
    assert.equal(d.security, [2,2,3,3,4][tier-1]); assert.equal(d.threshold, 8+tier*2);
    assert.equal(d.impulseBonus,tier); assert.equal(d.exhaust,-tier-1);
    assert.equal(d.auBoost,tier); assert.equal(d.auCost,4);
    assert.equal(d.cardNumber,tier===5?'B-13':`A-${22+tier}`);
    assert.deepEqual(d.stations,[]);
    for (const asset of [d.image.split('?')[0],d.sprite]) assert.ok(fs.existsSync(require('node:path').join(__dirname,'..',asset)),asset);
  }
});

test('multi-square thrusters render once, point away from every mount, and never become hull or stations', () => {
  for(let tier=1;tier<=5;tier++) {
    const type=`exhaust-thruster-${tier}`,d=maps.definition(type),origin=126;
    const cells=Array.from({length:d.height},(_,y)=>Array.from({length:d.width},(_,x)=>origin+y*20+x)).flat();
    const mounts=[{cell:origin-20,angle:0},{cell:origin+d.width,angle:90},{cell:origin+d.height*20,angle:180},{cell:origin-1,angle:270}];
    for(const mount of mounts) {
      const ship={gridCells:[mount.cell],sicInventory:[{id:'t',type}],placements:[{sicId:'t',cell:origin}]};
      assert.equal(maps.exteriorError(ship),'');
      const layout=maps.buildLayout(ship);
      assert.equal(layout.hull.size,1);
      for(const cell of cells) {
        assert.equal(maps.exteriorFacing(layout,cell),mount.angle);
        assert.equal(layout.footprint.get(cell).blocked,true);
        assert.deepEqual(layout.footprint.get(cell).stations,[]);
      }
      const markup=cells.map(cell=>maps.surfaceMarkup(layout,cell)).join('');
      assert.equal((markup.match(/<img /g)||[]).length,1);
      assert.match(markup,new RegExp(`--thruster-angle:${mount.angle}deg`));
      assert.match(markup,new RegExp(`width:${d.width*100}%;height:${d.height*100}%`));
      ship.sicInventory[0].status='offline';
      assert.doesNotMatch(maps.surfaceMarkup(maps.buildLayout(ship),origin),/is-firing/);
    }
  }
});

test('mixed thruster tiers share the four-part cap and each grant only one Evade die', () => {
  const ship={gridCells:[147,148,167,168],sicInventory:[{id:'a',type:'exhaust-thruster-5'},{id:'b',type:'exhaust-thruster-2'}],placements:[{sicId:'a',cell:107},{sicId:'b',cell:187}]};
  assert.equal(maps.exteriorError(ship),'');
  assert.deepEqual(maps.propulsion(ship).impulses,[15,12]);
  assert.equal(maps.propulsion(ship).exhaust,-9);
  assert.equal(maps.propulsion(ship).evadeCount,2);
  ship.sicInventory[0].impaired=true;
  assert.equal(maps.propulsion(ship).evadeCount,1);
  assert.equal(maps.propulsion(ship).moveSpeed,27);
  ship.sicInventory.push(...[3,4,1].map(tier=>({id:String(tier),type:`exhaust-thruster-${tier}`})));
  assert.match(maps.exteriorError(ship),/four thrusters/);
});

function purchaseContext(credits=1000) {
  const source=fs.readFileSync(require.resolve('../starship.js'),'utf8');
  const calls=[];
  const context={SIC_CATALOG:maps.catalog,draft:{groupCredits:credits,sicInventory:[]},selectedSicId:null,mapView:{},
    sicDefinition:item=>maps.definition(item.type),pendingCost:()=>context.draft.sicInventory.reduce((n,item)=>n+maps.definition(item.type).price,0),
    showMessage:(...args)=>calls.push(args),rememberForUndo(){},saveDraft(){},saveMapView(){},renderAll(){},document:{querySelector:()=>({click(){}})}};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function purchaseSic('),source.indexOf('document.querySelectorAll("[data-purchase-sic]")')),context);
  return {context,calls};
}
test('repeat purchases get unique pending identities and respect reserved credits', () => {
  const {context,calls}=purchaseContext(450);
  context.purchaseSic('exhaust-thruster-1'); context.purchaseSic('exhaust-thruster-1'); context.purchaseSic('exhaust-thruster-1');
  assert.equal(context.draft.sicInventory.length,2);
  assert.notEqual(context.draft.sicInventory[0].id,context.draft.sicInventory[1].id);
  assert.ok(context.draft.sicInventory.every(i=>i.pendingPurchase&&!i.storage));
  assert.match(calls.at(-1)[0],/Not enough Group Credits/);
  assert.equal(context.draft.groupCredits,450,'credits are deducted by the existing confirmation transaction');
});
test('duplicate purchasing cannot bypass the mixed-tier thruster limit', () => {
  const {context,calls}=purchaseContext(10000);
  for(let tier=1;tier<=5;tier++)context.purchaseSic(`exhaust-thruster-${tier}`);
  assert.equal(context.draft.sicInventory.length,4);
  assert.match(calls.at(-1)[0],/four thrusters/);
});
