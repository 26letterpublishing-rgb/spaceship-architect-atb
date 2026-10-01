const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),maps=require('../ship-map-core');
function builder(){
 const source=fs.readFileSync(require.resolve('../starship.js'),'utf8'),feedback={textContent:'',dataset:{}},dialogs=[],draft={gridCells:[],placements:[],sicInventory:[],groupCredits:100},messages=[];let serial=0;
 const context={draft,SIC_CATALOG:maps.catalog,window:{SAShipMap:maps},document:{querySelector:selector=>selector==='[data-purchase-feedback]'?feedback:null},cardHost:{body:{append(){}},createElement(){
  const nodes={'select':{value:'shield-host'},'[data-addon-price]':{textContent:''},'[role=alert]':{textContent:''},'[data-addon-buy]':{},'[data-addon-cancel]':{}};
  const dialog={nodes,setAttribute(){},querySelector:selector=>nodes[selector],showModal(){this.open=true;},close(){this.open=false;this.onclose?.();},remove(){}};dialogs.push(dialog);return dialog;
 }},showMessage:(text,tone)=>messages.push({text,tone}),rememberForUndo(){},saveDraft(){},renderAll(){},uid:type=>type+'-'+(++serial),formatCredits:value=>value.toLocaleString(),escapeHtml:String,sicDefinition:item=>maps.definition(typeof item==='string'?item:item.type),placementForSic:id=>draft.placements.find(p=>p.sicId===id),pendingCost:()=>draft.sicInventory.filter(i=>i.pendingPurchase).reduce((sum,i)=>sum+maps.sicPrice(i,draft),0)};
 let start=source.indexOf('function clearPurchaseFeedback(');vm.runInNewContext(source.slice(start,source.indexOf('document.querySelectorAll("[data-purchase-sic]")',start)),context);
 start=source.indexOf('function purchaseHullUpgrade(');vm.runInNewContext(source.slice(start,source.indexOf('\ninstallTriangleControls();',start)),context);
 return {context,draft,feedback,dialogs,messages};
}
test('Hull purchase failures stay actionable in the shop and successful retry clears the prior error',()=>{
 const {context,draft,feedback}=builder();assert.equal(context.purchaseSic('hull-plating'),false);assert.match(feedback.textContent,/Build the Hull/);
 draft.gridCells=Array.from({length:10},(_,n)=>21+n);assert.equal(context.purchaseSic('hull-plating'),false);assert.match(feedback.textContent,/Not enough Group Credits.*4,500/);assert.equal(draft.sicInventory.length,0);
 draft.groupCredits=10000;assert.equal(context.purchaseSic('hull-plating'),true);assert.match(feedback.textContent,/covers all 10 Hull sections.*Confirm Changes/);assert.equal(feedback.dataset.tone,'success');assert.equal(draft.sicInventory.length,1);assert.equal(draft.groupCredits,10000,'Purchase remains pending until Confirm');
 assert.equal(context.purchaseSic('hull-plating'),false);assert.match(feedback.textContent,/Only one Hull Plating/);assert.equal(feedback.dataset.tone,'error');assert.equal(draft.sicInventory.length,1);
});
test('add-on missing-host and chooser errors preserve purchase state and allow a successful retry',()=>{
 const {context,draft,feedback,dialogs}=builder();assert.equal(context.purchaseSic('static-shield'),false);assert.match(feedback.textContent,/Install a compatible host/);assert.equal(dialogs.length,0);
 draft.gridCells=[21];draft.sicInventory.push({id:'shield-host',type:'shield-1',storage:true});draft.placements.push({sicId:'shield-host',cell:21});assert.equal(context.purchaseSic('static-shield'),false,'Stored hosts are not usable');
 draft.sicInventory[0].storage=false;assert.equal(context.purchaseSic('static-shield'),true);let dialog=dialogs.at(-1);assert.equal(dialog.open,true);assert.equal(feedback.textContent,'');
 assert.equal(dialog.nodes['[data-addon-buy]'].onclick(),false);assert.match(dialog.nodes['[role=alert]'].textContent,/Not enough Group Credits/);assert.equal(feedback.textContent,dialog.nodes['[role=alert]'].textContent);assert.equal(dialog.open,true);assert.equal(draft.sicInventory.length,1);
 draft.groupCredits=40000;assert.equal(dialog.nodes['[data-addon-buy]'].onclick(),true);assert.equal(dialog.open,false);assert.match(feedback.textContent,/Static Shields attached to Shield 1.*Confirm Changes/);assert.equal(feedback.dataset.tone,'success');assert.equal(draft.sicInventory.length,2);
 assert.equal(context.purchaseSic('static-shield'),true);dialog=dialogs.at(-1);assert.equal(dialog.nodes['[data-addon-buy]'].onclick(),false);assert.match(feedback.textContent,/already has Static Shields/);assert.equal(dialog.open,true);assert.equal(draft.sicInventory.length,2);
});
