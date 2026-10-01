const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const impact=require('../cleanser-impact');
test('escaped ships retain the explosion but have no debris or destruction claim',()=>{
  const view=impact.presentation({targetKind:'starship',visualOutcome:'miss',targetMapRank:3});
  assert.equal(view.art,'sic-art-starship-rank-3.webp');assert.equal(view.showRemains,false);assert.equal(view.showFragments,false);assert.equal(view.destroyed,false);assert.match(view.result,/NO DAMAGE/);assert.match(view.stages.aftermath,/EMPTY SPACE/);
});
test('shielded and surviving hull-hit ships remain visually intact, while destroyed ships get ship debris',()=>{
  for(const outcome of ['shielded','damaged']){const view=impact.presentation({targetKind:'starship',visualOutcome:outcome});assert.equal(view.showRemains,false);assert.equal(view.showFragments,false);assert.doesNotMatch(view.result,/DESTROYED/);}
  const shield=impact.presentation({targetKind:'starship',visualOutcome:'shielded'});assert.match(shield.result,/SHIELD LAYER/);assert.match(shield.stages.aftermath,/HULL PROTECTED/);
  const wreck=impact.presentation({targetKind:'starship',visualOutcome:'destroyed'});assert.equal(wreck.showRemains,true);assert.equal(wreck.showFragments,true);assert.equal(wreck.remainsArt,null);assert.match(wreck.remainsAlt,/starship/);
});
test('legacy planet events preserve their art, debris and destruction sequence',()=>{
  const view=impact.presentation({variant:'ice'});assert.equal(view.kind,'planet');assert.equal(view.art,'planet-ice.webp');assert.equal(view.remainsArt,'planet-debris.webp');assert.equal(view.showRemains,true);assert.equal(view.result,'PLANET DESTROYED');
  assert.equal(impact.presentation({variant:'../private'}).art,'planet-ocean.webp');
});
function mapApi(scars){const document={addEventListener(){},querySelector:()=>({}),defaultView:{frameElement:null}};const context={window:{SACombatBridge:{state:()=>({cleanserScars:scars})},SAShipDistances:require('../ship-distances'),SAShipMap:require('../ship-map-core')},document,location:{href:'http://localhost/'},CSS:{escape:v=>v}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../space-map'),'utf8'),context);return context.window.SASpaceMap;}
test('starship blast scars render under ships without debris, targets or selectable objects',()=>{
  const scars=[{id:'blast-1',q:4,r:-2,targetName:'Escape <test>'},{id:'invalid',q:NaN,r:0}],maps=mapApi(scars),ship={id:'s',title:'Survivor',ship:{gridCells:[1]}};
  const html=maps.markup([ship],[{id:'s',q:4,r:-2}]),layer=maps.cleanserScarMarkup(scars);
  assert.match(layer,/translate\(5\.196152422706632 -3\)/);assert.match(layer,/Escape &lt;test&gt;/);assert.doesNotMatch(layer,/invalid|<image|data-space-ship|data-space-object|data-debris/);assert.match(layer,/pointer-events="none"/);
  assert.ok(html.indexOf('data-cleanser-scar=')<html.indexOf('data-space-ship="s"'));
  assert.doesNotMatch(maps.markup([ship],[{id:'s',q:4,r:-2}],true),/data-cleanser-scar=/);
});
