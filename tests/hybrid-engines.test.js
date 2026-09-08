const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const maps = require("../ship-map-core");
const power = require("../ship-power");

test("all twelve hybrid engines have source ratings, footprints, stations, and artwork", () => {
  for (const [family, outputs] of [["en-au", [[3,1],[9,2],[19,5],[33,10],[51,17],[73,26]]], ["au-en", [[1,2],[4,5],[9,12],[16,20],[25,30],[36,47]]]]) {
    for (let tier = 1; tier <= 6; tier++) {
      const def = maps.definition(`${family}-engine-${tier}`);
      assert.deepEqual([def.output, def.auOutput], outputs[tier-1]);
      assert.deepEqual([def.width, def.height, def.stations.length], [tier,tier,[1,2,2,3,3,4][tier-1]]);
      assert.match(def.name, /Hybrid Engine/);
      assert.ok(fs.statSync(path.join(__dirname,"..",def.image.split("?")[0])).size > 10000);
      const ship = { gridCells: Array.from({length:tier*tier},(_,i)=>Math.floor(i/tier)*20+i%tier), placements:[{sicId:"core",cell:0}],sicInventory:[{id:"core",type:`${family}-engine-${tier}`} ] };
      const layout = maps.buildLayout(ship);
      assert.equal(layout.footprint.size,tier*tier);
      assert.deepEqual(power.output({id:"ship",ship}),{en:def.output,au:def.auOutput});
    }
  }
});

test("hybrid station bonuses boost the correct resource and impairment retains EN only", () => {
  for (const family of ["en-au", "au-en"]) {
    const ship = { id:"ship",ship:{placements:[{sicId:"core",cell:0}],sicInventory:[{id:"core",type:`${family}-engine-1`}]} };
    const unit={engineeringSkill:2,location:{starshipId:"ship",sicId:"core",square:0,mesh:1,stationed:true}};
    assert.deepEqual(power.output(ship,[unit]),family==="en-au"?{en:5,au:1}:{en:1,au:4});
    power.refresh({starships:[ship],units:[unit]});
    assert.equal(ship.auState.rate,family==="en-au"?1:4);
    ship.ship.sicInventory[0].impaired=true;
    assert.deepEqual(power.output(ship,[unit]),{en:family==="en-au"?3:1,au:0});
    ship.ship.sicInventory[0].status="destroyed";
    assert.deepEqual(power.output(ship,[unit]),{en:0,au:0});
  }
});
