const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),maps=require('../ship-map-core');
const source=fs.readFileSync(require.resolve('../starship.js'),'utf8');
function functionSource(name){const start=source.indexOf('function '+name+'(');return source.slice(start,source.indexOf('\nfunction ',start+10));}
function setup(){
  const item={id:'brig',type:'brig',brigWidth:3,brigHeight:2},draft={zoneRows:20,zoneColumns:20,gridCells:Array.from({length:400},(_,n)=>n),sicInventory:[item,{id:'neighbor',type:'hibernation-chamber'}],placements:[{sicId:'brig',cell:42},{sicId:'neighbor',cell:46}],groupCredits:5000};
  const messages=[],saves=[];let renders=0;
  const context={draft,window:{SAShipMap:maps},GRID_SIZE:20,undoState:null,sicDefinition:maps.componentDefinition,getWorkingState:()=>JSON.parse(JSON.stringify(draft)),showMessage:(text)=>messages.push(text),saveDraft:()=>saves.push(JSON.parse(JSON.stringify(draft))),renderAll:()=>renders++};
  vm.runInNewContext(['placementCells','placementAt','placementForSic','validateSicPlacement','resizeSic'].map(functionSource).join('\n'),context);
  return {context,draft,item,messages,saves,renders:()=>renders};
}
test('Brig resize commits a legal input once, leaves hull and credits intact, and retains an undo snapshot',()=>{
  const f=setup();assert.equal(f.context.resizeSic('brig','brigWidth','4'),4);assert.equal(f.item.brigWidth,4);assert.equal(f.saves.length,1);assert.equal(f.renders(),1);assert.equal(f.context.undoState.sicInventory[0].brigWidth,3);assert.equal(f.draft.groupCredits,5000);assert.equal(f.draft.gridCells.length,400);
  // A change event followed by blur must not overwrite the pre-resize undo state.
  assert.equal(f.context.resizeSic('brig','brigWidth','4'),4);assert.equal(f.saves.length,1);assert.equal(f.context.undoState.sicInventory[0].brigWidth,3);
});
test('Brig growth detects another SIC even when its own placement is first and restores the displayed size',()=>{
  const f=setup();assert.equal(f.context.resizeSic('brig','brigWidth','5'),3);assert.equal(f.item.brigWidth,3);assert.equal(f.context.undoState,null);assert.equal(f.saves.length,0);assert.match(f.messages[0],/already contains a SIC/);assert.equal(maps.exteriorError(f.draft),'');
  assert.equal(f.context.resizeSic('brig','brigWidth','0'),3);assert.match(f.messages.at(-1),/whole numbers/);
});
