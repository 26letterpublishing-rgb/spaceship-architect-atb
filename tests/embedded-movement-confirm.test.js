const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const source=fs.readFileSync(require.resolve('../movement-controls.js'),'utf8');let forwarded=0,removed=0,disconnected=0;
 const circle={dataset:{},style:{},setAttribute(){},addEventListener(t,fn){this[t]=fn;},remove(){removed++;}};
 const viewport={isConnected:true,offsetWidth:400,scrollLeft:0,scrollTop:0,classList:{add(){}},ownerDocument:{createElement:()=>circle},append(){},addEventListener(){},removeEventListener(){},getClientRects:()=>[1],getBoundingClientRect:()=>({left:0,top:0,right:400,bottom:300,width:400})};
 const target={isConnected:true,getBoundingClientRect:()=>({left:390,right:410,top:290,height:20})};
 const button={isConnected:true,disabled:false,textContent:'Confirm Move',click(){forwarded++;}};
 class Observer{observe(){}disconnect(){disconnected++;}}
 const c={window:{addEventListener(){}},schedule(){},ResizeObserver:Observer,MutationObserver:Observer};vm.createContext(c);vm.runInContext(source.slice(source.indexOf(' const destinations='),source.indexOf(' function arrange()')),c);
 return {circle,viewport,target,button,forwarded:()=>forwarded,removed:()=>removed,disconnected:()=>disconnected,sync:active=>c.window.SAMovementConfirm.sync(button,{viewport,target,movingElement:{},active})};
}
test('embedded destination counterpart mirrors readiness and forwards only to the existing confirmation',()=>{
 const f=fixture();f.sync(true);assert.equal(f.circle.textContent,'Confirm Move');assert.equal(f.circle.hidden,false);assert.equal(f.circle.dataset.uiSound,'none');
 f.circle.click({stopPropagation(){}});assert.equal(f.forwarded(),1);
 f.button.disabled=true;f.sync(true);assert.equal(f.circle.disabled,true);f.circle.click({stopPropagation(){}});assert.equal(f.forwarded(),1);
 f.button.disabled=false;f.button.textContent='Board other ship';f.sync(true);assert.equal(f.circle.textContent,'Board other ship');
 assert.ok(parseFloat(f.circle.style.left)+56<=392);assert.ok(parseFloat(f.circle.style.top)+56<=292);
});
test('embedded counterpart follows scroll and cleans up observers when selection ends',()=>{
 const f=fixture();f.sync(true);const x=parseFloat(f.circle.style.left);f.viewport.scrollLeft=80;f.sync(true);assert.equal(parseFloat(f.circle.style.left),x+80);
 f.target.isConnected=false;f.sync(true);assert.equal(f.circle.hidden,true);f.sync(false);assert.equal(f.removed(),1);assert.equal(f.disconnected(),2);
 f.sync(false);assert.equal(f.removed(),1);
});

test('unchanged refresh does not rewrite circle nodes or crowd the bottom toolbar',()=>{
 const f=fixture();let writes=0,value='';Object.defineProperty(f.circle,'textContent',{get:()=>value,set:x=>{writes++;value=x;}});
 f.viewport.querySelector=()=>({getBoundingClientRect:()=>({top:220})});
 f.sync(true);f.sync(true);assert.equal(writes,1);assert.ok(parseFloat(f.circle.style.top)+56<=212);
});
