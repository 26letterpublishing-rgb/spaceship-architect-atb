const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function node(){return {dataset:{},style:{},attributes:{},children:[],namespaceURI:'http://www.w3.org/2000/svg',setAttribute(k,v){this.attributes[k]=String(v);},append(child){child.parent=this;this.children.push(child);},remove(){this.parent.children=this.parent.children.filter(c=>c!==this);},querySelectorAll(selector){const names=selector.match(/\[data-([\w-]+)\]/g).map(s=>s.slice(6,-1).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()));return this.children.filter(c=>names.some(n=>n in c.dataset));},querySelector(selector){return this.querySelectorAll(selector)[0]||null;}};}
function controls(){const entries=new Map();return s=>{if(!entries.has(s))entries.set(s,{value:'0',textContent:'',disabled:false,hidden:false});return entries.get(s);};}
function scanFixture(){
 const source=fs.readFileSync(require.resolve('../sensor-console-ui.js'),'utf8'),get=controls(),svg=node();
 const context={get:s=>s==='[data-map] svg[data-space-canvas]'?svg:get(s),host:{createElementNS:()=>node()},selecting:{dataset:{order:'hex'}},scanPoint:{q:12,r:-3},hexSelected:true,q:{value:'12'},r:{value:'-3'},busy:false,window:{SAShipTargets:{point:()=>({q:0,r:0})},SAShipDistances:{hexDistance:(a,b)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r))}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('    function renderScanPlot('),source.indexOf('    function selectScanHex(')),context);
 return {context,get,svg,draw:ready=>context.renderScanPlot({}, {id:'owner'},10,ready)};
}
test('sensor selection previews the seven actual scanned hexes, warns outside range, and requires a ready turn to confirm',()=>{
 const f=scanFixture();f.draw(true);assert.equal(f.get('[data-confirm-scan]').disabled,false);assert.match(f.get('[data-destination]').textContent,/outside of sensor range/);
 const preview=f.svg.querySelector('[data-scan-preview]');assert.equal(preview.children.length,7);assert.equal(preview.dataset.scanPreview,'selected');assert.equal(preview.children[0].attributes['vector-effect'],'non-scaling-stroke');
 f.draw(false);assert.equal(f.get('[data-confirm-scan]').disabled,true);assert.equal(f.svg.querySelectorAll('[data-scan-preview]').length,1);assert.equal(f.svg.querySelectorAll('[data-sensor-range]').length,1);
});
test('scan range and locked selection restore on a rebuilt map; cancellation removes both without a command',()=>{
 const f=scanFixture();f.draw(true);f.svg.children=[];f.context.selecting.dataset.order='life';f.draw(true);
 assert.equal(f.get('[data-confirm-scan]').textContent,'Confirm Life Scan');assert.equal(f.svg.children.length,2);
 f.context.selecting=null;f.context.scanPoint=null;f.context.hexSelected=false;f.draw(true);assert.equal(f.get('[data-scan-planner]').hidden,true);assert.equal(f.svg.children.length,0);
});
function probeFixture(){
 const source=fs.readFileSync(require.resolve('../probe-console.js'),'utf8'),get=controls(),svg=node();
 const context={get:s=>s==='[data-map] svg[data-space-canvas]'?svg:get(s),doc:{createElementNS:()=>node()},selected:()=>({state:{},access:{ship:{id:'owner'}},p:{id:'probe',position:{q:2,r:1}}}),person:()=>({}),planning:{kind:'move',destination:{q:4,r:2},locked:false},window:{SAShipTargets:{point:()=>({q:0,r:0})},SAShipProbes:{destinationError:()=>''}}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function circle('),source.indexOf('  function selected('))+'\n'+source.slice(source.indexOf('  function plot('),source.indexOf('  function clearPlot(')),context);
 return {context,get,svg,draw:()=>context.plot()};
}
test('probe route follows its current origin and remains a visible screen-space line at every zoom',()=>{
 const f=probeFixture();f.draw();const line=f.svg.querySelector('[data-probe-preview]');assert.equal(line.attributes['stroke-width'],'3');assert.equal(line.attributes['vector-effect'],'non-scaling-stroke');assert.equal(line.dataset.probePreview,'preview');assert.equal(f.get('[data-confirm-flight]').disabled,true);
 f.context.planning.locked=true;f.draw();assert.equal(f.svg.querySelectorAll('[data-probe-preview]').length,1);assert.equal(f.svg.querySelector('[data-probe-preview]').dataset.probePreview,'locked');assert.equal(f.get('[data-confirm-flight]').disabled,false);
 f.get('[data-order="move"]').disabled=true;f.draw();assert.equal(f.get('[data-confirm-flight]').disabled,true);
});
test('out-of-range probe destination remains visibly invalid and cannot be confirmed',()=>{
 const f=probeFixture();f.context.planning.locked=true;f.context.window.SAShipProbes.destinationError=()=> 'Choose a hex within sensor range.';f.draw();assert.equal(f.get('[data-confirm-flight]').disabled,true);assert.match(f.get('[data-destination]').textContent,/within sensor range/);assert.equal(f.svg.querySelector('[data-probe-preview]').attributes.stroke,'#ff7886');
});

test('typed sensor coordinates update the selected scan before blur and reject incomplete or fractional coordinates',()=>{
 const source=fs.readFileSync(require.resolve('../sensor-console-ui.js'),'utf8'),f=scanFixture();let renders=0;
 Object.assign(f.context,{manualViewBox:null,lastMap:'old-frame',redraw:()=>renders++});
 vm.runInContext(source.slice(source.indexOf('    function updateCoordinates('),source.indexOf('    view.oninput=updateCoordinates;')),f.context);
 const event={target:{matches:()=>true}};f.context.q.value='25';f.context.r.value='0';f.context.updateCoordinates(event);
 assert.equal(f.context.scanPoint.q,25);assert.equal(f.context.scanPoint.r,0);assert.equal(f.context.hexSelected,true);assert.equal(renders,1);assert.equal(f.context.lastMap,'');
 for(const value of ['', '1.5','10001','-10001']){f.context.q.value=value;f.context.updateCoordinates(event);assert.equal(f.context.scanPoint,null);assert.equal(f.context.hexSelected,false);f.draw(true);assert.equal(f.get('[data-confirm-scan]').disabled,true);assert.match(f.get('[data-destination]').textContent,/whole-number coordinates/);}
 f.context.q.value='-10000';f.context.r.value='10000';f.context.updateCoordinates(event);assert.equal(f.context.hexSelected,true);
});

test('probe preview clears an old range warning as the pointer returns to a legal destination',()=>{
 const source=fs.readFileSync(require.resolve('../probe-console.js'),'utf8'),f=probeFixture();f.context.window.SAShipProbes.destinationError=(_s,_ship,p)=>p.q>12?'Outside sensor range.':'';
 vm.runInContext(source.slice(source.indexOf('  function preview('),source.indexOf("  get('[data-map]').onpointermove=")),f.context);
 f.context.preview({q:20,r:0});assert.equal(f.get('[data-error]').textContent,'Outside sensor range.');f.context.preview({q:5,r:0});assert.equal(f.get('[data-error]').textContent,'');assert.equal(f.context.planning.destination.q,5);
});


test('sensor analysis and sharing lists contain detected starships, not probe, drone, missile or unknown contacts',()=>{
 const source=fs.readFileSync(require.resolve('../sensor-console-ui.js'),'utf8'),context={};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function shipContacts('),source.indexOf('  function open(')),context);
 const entries=[{id:'ship',level:'detected',nature:'Starship'},{id:'probe',level:'detected',isProbe:true},{id:'drone',level:'detected',isDrone:true},{id:'missile',level:'detected',isMissile:true},{id:'old-probe',level:'detected',nature:'Probe'},{id:'unknown',level:'unknown'}];
 assert.equal(context.shipContacts({sensorState:{contacts:Object.fromEntries(entries.map(c=>[c.id,c]))}}).map(c=>c.id).join(','),'ship');
});
