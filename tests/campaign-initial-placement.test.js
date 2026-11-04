const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
test('unplaced entry uses existing GM placement and omits already placed ships',()=>{
 const s=fs.readFileSync(require.resolve('../campaign-starmaps-ui'),'utf8');const part=s.slice(s.indexOf('  function unplacedShips('),s.indexOf('  function update(next'));
 assert.match(part,/state.role==='gm'/);assert.match(part,/!state.starmaps\?\.positions/);assert.match(part,/!state.starmaps\?\.localPositions/);assert.match(part,/SACampaignNavigationUI\.beginPlacement\(selectedShip\)/);assert.doesNotMatch(part,/data-nav-level="galaxy"/);assert.match(part,/mode='ship';draw\(\)/);assert.doesNotMatch(part,/fetch\(|send\(/);
});
