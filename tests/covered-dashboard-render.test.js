const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),map=fs.readFileSync(require.resolve('../ship-combat-map.js'),'utf8');
test('covered dashboard updates visible interior without constructing dashboard DOM',()=>{
 let covered=true,refreshes=0,visibilityChecks=0;const c={window:{SACombatMap:{isExpandedInteriorOpen:()=>covered,renderInlineMaps:()=>refreshes++}},document:{get hidden(){visibilityChecks++;return true;}}};
 vm.runInNewContext(app.slice(app.indexOf('function renderShipCombatColumns() {'),app.indexOf('function updateShipAuMeters()')),c);c.renderShipCombatColumns();assert.equal(refreshes,1);assert.equal(visibilityChecks,0);covered=false;c.renderShipCombatColumns();assert.equal(visibilityChecks,1);
});
test('expanded updates do not traverse covered inline hosts',()=>{
 let coveredQueries=0,expandedQueries=0;const shell={querySelector:()=>null,querySelectorAll:()=>{expandedQueries++;return[];}},document={querySelector:()=>null,querySelectorAll:()=>{coveredQueries++;return[];}};
 const c={document,expandedMap:{dialog:shell,host:{dataset:{inlineShipMap:'s'}}},bridge:()=>({shipDashboardData:()=>({record:{id:'s'},campaign:{}})}),statsMarkup:()=>'',closeExpandedMap(){throw Error('Unexpected close');}};
 vm.runInNewContext(map.slice(map.indexOf('  function renderInlineMaps('),map.indexOf('  function refreshInlinePreview(')),c);c.renderInlineMaps();assert.equal(expandedQueries,1);assert.equal(coveredQueries,0);c.expandedMap=null;c.renderInlineMaps();assert.equal(coveredQueries,1);
});
test('closing clears modal ownership before requesting fresh dashboard state and restores focus',()=>{
 const events=[];const c={expandedMap:{dialog:{close:()=>events.push('close'),remove:()=>events.push('remove')},source:{focus:()=>events.push('focus')}},requestAppRender(){assert.equal(c.expandedMap,null);events.push('refresh');},renderInlineMaps:()=>events.push('inline')};
 vm.runInNewContext(map.slice(map.indexOf('  function closeExpandedMap()'),map.indexOf('  function centerInterior(')),c);c.closeExpandedMap();assert.deepEqual(events,['close','remove','refresh','focus','inline']);c.closeExpandedMap();assert.equal(events.length,5);
});
