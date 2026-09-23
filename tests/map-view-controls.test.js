const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function api(){
 const document={addEventListener(){},querySelector:()=>({}),defaultView:{frameElement:null,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}}};
 const context={window:{SAShipDistances:require('../ship-distances'),SAShipMap:require('../ship-map-core')},document,CSS:{escape:value=>value},requestAnimationFrame:fn=>fn(),location:{href:'http://localhost/'}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../space-map'),'utf8'),context);return {maps:context.window.SASpaceMap,document};
}
function svg(width,height,markers=[]){
 const box={x:-10,y:-5,width:20,height:10};
 return {clientWidth:width,clientHeight:height,viewBox:{baseVal:box},querySelectorAll:()=>markers,getBoundingClientRect:()=>({width:0,height:0}),setAttribute(name,value){if(name==='viewBox')Object.assign(box,Object.fromEntries(['x','y','width','height'].map((key,i)=>[key,Number(value.split(' ')[i])])));}};
}
const marker=(x,y,planet=false)=>({transform:{baseVal:{consolidate:()=>({matrix:{e:x,f:y}})}},hasAttribute:name=>name==='data-planet'&&planet});
test('shared fit contains contact markers and full planets using the actual wide or tall viewport',()=>{
 const {maps}=api();
 for(const [width,height] of [[1000,320],[450,800]]){
  const map=svg(width,height,[marker(-12,6),marker(25,-8,true)]);maps.fitRendered(map);const box=map.viewBox.baseVal;
  assert.ok(box.x<=-13.5&&box.x+box.width>=28);assert.ok(box.y<=-11&&box.y+box.height>=7.5);
  assert.ok(Math.abs(box.width/box.height-width/height)<1e-10);assert.ok(box.width>=12);
 }
});
test('map zoom preserves the current center, aspect and marker identity',()=>{
 const {maps}=api(),markers=[marker(0,0)],map=svg(600,300,markers);maps.zoom(map,.7);const box=map.viewBox.baseVal;
 assert.equal(box.width,14);assert.equal(box.height,7);assert.equal(box.x+box.width/2,0);assert.equal(box.y+box.height/2,0);assert.equal(map.querySelectorAll()[0],markers[0]);
});
function focusedView(document){
 const classes=new Set(),listeners=new Map(),events=[];
 let button={dataset:{},setAttribute(name,value){this[name]=value;},focus(){this.focused=true;}};
 const view={ownerDocument:document,dataset:{},classList:{contains:name=>classes.has(name),toggle(name){if(classes.has(name)){classes.delete(name);return false;}classes.add(name);return true;}},querySelector:()=>button,querySelectorAll:()=>[],addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},dispatchEvent(event){events.push(event);},lockedDestination:{q:8,r:-3}};
 button.closest=()=>view;
 return {view,listeners,events,get button(){return button;},replaceButton(){button={dataset:{},setAttribute(name,value){this[name]=value;},focus(){this.focused=true;},closest:()=>view};}};
}
test('enlarging an interactive map preserves the original dialog and locked route; Escape returns before closing',()=>{
 const {maps,document}=api(),f=focusedView(document),route=f.view.lockedDestination;
 const source={closest:()=>f.view,get outerHTML(){throw Error('Interactive map must not be cloned.');}};
 maps.enlarge(source,f.button);assert.equal(f.view.classList.contains('map-focus'),true);assert.equal(f.button.textContent,'Return to Console');assert.equal(f.button['aria-pressed'],'true');assert.equal(f.view.lockedDestination,route);
 let prevented=false,stopped=false;
 f.listeners.get('keydown')[0]({type:'keydown',key:'Escape',preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
 assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(f.view.classList.contains('map-focus'),false);assert.equal(f.button.textContent,'Enlarge Map');assert.equal(f.view.lockedDestination,route);assert.equal(f.events.length,2);
 prevented=false;f.listeners.get('keydown')[0]({type:'keydown',key:'Escape',preventDefault(){prevented=true;},stopImmediatePropagation(){}});assert.equal(prevented,false,'a later Escape can close the ordinary dialog');
});
test('preparation focus survives refreshed controls and never duplicates its Escape handlers',()=>{
 const {maps,document}=api(),f=focusedView(document);f.view.dataset.mapEditor='';
 maps.focusMap(f.view,f.button);assert.equal(f.button.textContent,'Return to Setup');const first=f.button;f.replaceButton();
 f.listeners.get('cancel')[0]({type:'cancel',preventDefault(){},stopImmediatePropagation(){}});assert.equal(f.button.textContent,'Enlarge Map');assert.equal(f.button.focused,true);assert.notEqual(f.button,first);
 maps.focusMap(f.view,f.button);assert.equal(f.listeners.get('cancel').length,1);assert.equal(f.listeners.get('keydown').length,1);
});
test('every ship scale gets a shield around its artwork and an independent transparent pointer target',()=>{
 const {maps}=api();let previous=0;
 for(const count of [26,50,100,200,201]){
  const ship={id:'ship',title:'Test Ship',currentShieldHp:20,ship:{gridCells:Array.from({length:count},(_,i)=>i)}},html=maps.markup([ship],[{id:'ship',q:0,r:0}],true);
  const ring=Number(html.match(/data-shield-ring r="([^"]+)"/)[1]),art=Number(html.match(/href="sic-art-starship-rank-\d.webp"[^>]*width="([^"]+)"/)[1]);
  assert.ok(ring>=art/2);assert.ok(ring>=previous);previous=ring;
  assert.match(html,/<circle data-ship-hit r="[^"]+" fill="transparent" stroke="none" pointer-events="all"\/>/);
  ship.currentShieldHp=0;const unshielded=maps.markup([ship],[{id:'ship',q:0,r:0}],true);assert.doesNotMatch(unshielded,/data-shield-ring/);assert.match(unshielded,/data-ship-hit/);
 }
});
test('live refresh resizes an existing shield ring and pointer target when ship scale changes',()=>{
 const {maps,document}=api(),ship={id:'ship',title:'Test',currentShieldHp:20,ship:{gridCells:Array.from({length:201},(_,i)=>i)}};
 const element=()=>({attributes:{},dataset:{},style:{setProperty(){}},setAttribute(name,value){this.attributes[name]=String(value);},querySelector:()=>null});
 const hit=element(),ring=element(),body=element();body.dataset.rank='5';hit.attributes.r='.75';ring.attributes.r='.55';
 const marker={style:{},querySelector:name=>({'[data-ship-hit]':hit,'[data-shield-ring]':ring,'[data-vessel-body]':body}[name]||null),insertAdjacentHTML(){}};
 const map=svg(600,300);map.querySelector=()=>marker;map.insertAdjacentHTML=()=>{};document.querySelectorAll=selector=>selector==='[data-space-canvas]'?[map]:[];
 maps.refresh([ship],[{id:'ship',q:0,r:0}]);
 const expected=maps.markup([ship],[{id:'ship',q:0,r:0}],true).match(/data-shield-ring r="([^"]+)"/)[1];
 assert.equal(ring.attributes.r,expected);assert.equal(hit.attributes.r,expected);assert.ok(Number(expected)>1.6);
});
