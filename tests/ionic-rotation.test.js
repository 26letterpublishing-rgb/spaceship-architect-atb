const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const maps = require('../ship-map-core');
const power = require('../ship-power');

test('Ionic Pulse Thrusters match B14-B18 and render pulses instead of flames', () => {
  for (let tier = 1; tier <= 5; tier++) {
    const type = `ionic-pulse-thruster-${tier}`, d = maps.definition(type);
    assert.deepEqual([d.width,d.height], [[1,1],[2,1],[3,2],[3,2],[4,2]][tier-1]);
    assert.deepEqual([d.price,d.energyCost,d.security,d.threshold,d.auCost,d.auBoost,d.exhaust], [tier*350,tier*5,[2,2,3,3,4][tier-1],tier+7,2,tier,0]);
    assert.equal(d.cardNumber,`B-${13+tier}`); assert.deepEqual(d.stations,[]);
    assert.ok(fs.existsSync(path.join(__dirname,'..',d.sprite)));
    const ship = {gridCells:[106,107,108,109],sicInventory:[{id:'ion',type}],placements:[{sicId:'ion',cell:126}]};
    assert.equal(maps.exteriorError(ship),'');
    const markup = maps.surfaceMarkup(maps.buildLayout(ship),126);
    assert.match(markup,/sa-ion-pulse/); assert.doesNotMatch(markup,/sa-thruster-flame/);
    assert.equal(maps.propulsion(ship).exhaust,0); assert.equal(maps.propulsion(ship).evadeCount,1);
    ship.sicInventory[0].impaired = true;
    assert.equal(maps.propulsion(ship).evadeCount,0); assert.equal(maps.propulsion(ship).moveSpeed,10+tier);
  }
});

test('both rectangular thruster families preserve rotated footprints and emission frames on every mount', () => {
  for (const family of ['exhaust','ionic-pulse']) for(let tier=2;tier<=5;tier++) for(const rotation of [0,90]) {
    const item={id:'t',type:`${family}-thruster-${tier}`,rotation}, d=maps.componentDefinition(item), origin=126;
    for(const [mount,angle] of [[origin-20,0],[origin+d.width,90],[origin+d.height*20,180],[origin-1,270]]) {
      const ship={gridCells:[mount],sicInventory:[item],placements:[{sicId:'t',cell:origin}]};
      assert.equal(maps.exteriorError(ship),'');
      const restored=JSON.parse(JSON.stringify(ship)),layout=maps.buildLayout(restored);
      assert.equal(layout.footprint.size,d.width*d.height);
      assert.equal(layout.footprint.get(origin).width,d.width);
      assert.equal(maps.exteriorFacing(layout,origin),angle);
      assert.match(maps.surfaceMarkup(layout,origin),/animation-delay:/);
      assert.equal(layout.footprint.get(origin+(d.height-1)*20+d.width-1).blocked,true);
    }
  }
});

test('corner stations retain bonuses, avoid machinery, and do not migrate old saves', () => {
  for(const type of ['en-engine-1','en-engine-2','en-engine-3','en-engine-4','en-engine-5','en-engine-6','au-engine-4','en-au-engine-5','au-en-engine-6']) {
    const legacy=maps.definition(type),item={id:'e',type,stationLayout:'corners-v1'},d=maps.componentDefinition(item);
    assert.deepEqual(maps.componentDefinition({type}).stations,legacy.stations);
    assert.equal(d.stations.length,legacy.stations.length);
    for(const s of d.stations) assert.equal(maps.blocksMovement(type,d.width,d.height,s.x,s.y),false);
    const ship={id:'ship',ship:{gridCells:[],sicInventory:[item],placements:[{sicId:'e',cell:42}]}};
    const s=d.stations[0],base=power.output(ship),bonus=power.output(ship,[{engineeringSkill:3,location:{starshipId:'ship',sicId:'e',stationed:true,square:42+s.y*20+s.x,mesh:s.mesh}}]);
    assert.equal(bonus[d.stationBonus]-base[d.stationBonus],3);
  }
});

test('hallway doors prefer non-station cells while adjacent rooms keep a single shared door', () => {
  const ship={gridCells:Array.from({length:6},(_,y)=>Array.from({length:8},(_,x)=>21+y*20+x)).flat(),sicInventory:[{id:'e',type:'en-engine-4',stationLayout:'corners-v1'},{id:'l',type:'life-support'}],placements:[{sicId:'e',cell:42},{sicId:'l',cell:46}]};
  const layout=maps.buildLayout(ship); assert.equal(layout.connectionDoors.size,1);
  for(const [cell,room] of layout.footprint) for(const side of maps.SIDES) if(layout.boundary(cell,side.name).kind==='door') {
    assert.equal(room.stations.some(s=>s.x===room.column&&s.y===room.row),false);
  }
});

test('Masking includes HSM and installed Exhaust, including negative totals', () => {
  const ship={gridCells:[147,148,167,168],sicInventory:[{id:'e',type:'exhaust-thruster-1'},{id:'i',type:'ionic-pulse-thruster-1'},{id:'stored',type:'exhaust-thruster-5'}],placements:[{sicId:'e',cell:146},{sicId:'i',cell:149}]};
  assert.equal(maps.masking(ship),18);
  ship.sicInventory[0].status='offline'; assert.equal(maps.masking(ship),20);
  const large={gridCells:Array.from({length:151},(_,i)=>i+20),sicInventory:[{id:'t',type:'exhaust-thruster-1'}],placements:[{sicId:'t',cell:0}]};
  assert.equal(maps.masking(large),-7);
});

test('builder normalization retains rotation and pending storage through save and undo snapshots', () => {
  const source=fs.readFileSync(require.resolve('../starship.js'),'utf8');
  const context={SIC_CATALOG:maps.catalog}; vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function constructionState('),source.indexOf('function defaultDraft(')),context);
  const input={sicInventory:[{id:'t',type:'ionic-pulse-thruster-3',rotation:90,stationLayout:'corners-v1',pendingPurchase:true,storage:true}],placements:[]};
  const restored=context.constructionState(context.constructionState(input));
  assert.equal(restored.sicInventory[0].rotation,90); assert.equal(restored.sicInventory[0].storage,true);
  assert.equal(restored.sicInventory[0].stationLayout,'corners-v1');
});
