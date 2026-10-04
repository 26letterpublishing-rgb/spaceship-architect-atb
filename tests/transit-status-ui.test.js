const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','transit-status.js'),'utf8');
function harness(){
 const body={dataset:{},append(node){node.parentElement=this;}},dialogs=[],article={dataset:{transitShip:'road-trip'}},panel={hidden:false,popoverOpen:true,parentElement:body,querySelectorAll:()=>[article],querySelector:()=>article,matches(){return this.popoverOpen;},hidePopover(){this.popoverOpen=false;},showPopover(){this.popoverOpen=true;}};
 const context=vm.createContext({window:{},document:{documentElement:{},body,querySelectorAll:()=>dialogs},MutationObserver:class{observe(){}}});
 vm.runInContext(source,context);context.panel=panel;vm.runInContext(source.slice(source.indexOf('  function host('),source.indexOf('  new MutationObserver')),context);
 return{context,body,dialogs,panel};
}
test('warp status never covers map or confirmation dialogs and returns after they close',()=>{
 const{context,body,dialogs,panel}=harness();dialogs.push({dataset:{},append(){throw Error('Status must not be moved over a form');}});
 context.host();assert.equal(panel.popoverOpen,false);assert.equal(panel.parentElement,body);
 dialogs.pop();context.host();assert.equal(panel.popoverOpen,true);assert.equal(panel.parentElement,body);
});
test('console access keeps transit cancellation available without duplicating its own console',()=>{
 const{context,dialogs,panel}=harness();const consoleView={dataset:{operatorId:'nova'},append(node){node.parentElement=this;}};dialogs.push(consoleView);
 context.host();assert.equal(panel.popoverOpen,true);assert.equal(panel.parentElement,consoleView);
 consoleView.dataset.transitShip='road-trip';context.host();assert.equal(panel.popoverOpen,false);
});
