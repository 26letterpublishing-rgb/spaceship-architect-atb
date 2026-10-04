const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(){
 let doc;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.listeners={};this.hidden=false;this.className='';this.text='';const properties=new Map();this.style={setProperty:(k,v,p='')=>properties.set(k,{v,p}),getPropertyValue:k=>properties.get(k)?.v||'',getPropertyPriority:k=>properties.get(k)?.p||'',removeProperty:k=>properties.delete(k)};this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');},contains:name=>this.className.split(' ').includes(name)};}
  set textContent(value){this.replaceChildren();this.text=String(value);}get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}
  get childElementCount(){return this.children.length;}get isConnected(){return this===doc.documentElement||!!this.parentElement?.isConnected;}get lastElementChild(){return this.children.at(-1);}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.push(node);}}prepend(...nodes){this.append(...nodes);this.children=[...nodes,...this.children.filter(n=>!nodes.includes(n))];}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.text='';this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}hasAttribute(k){return k in this.attributes;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}fire(k){const e={stopped:false,prevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};for(const fn of this.listeners[k]||[])fn(e);this['on'+k]?.(e);return e;}
  matches(s){if(s.includes(','))return s.split(',').some(p=>this.matches(p));if(s===':popover-open')return!!this.popoverOpen;if(s==='dialog[open]')return this.tagName==='DIALOG'&&this.open;if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('link['))return this.tagName==='LINK';return this.tagName===s.toUpperCase();}
  querySelectorAll(s){const found=[];for(const n of this.children){if(n.matches(s))found.push(n);found.push(...n.querySelectorAll(s));}return found;}querySelector(s){return this.querySelectorAll(s)[0]||null;}
  showPopover(){this.popoverOpen=true;}hidePopover(){this.popoverOpen=false;}
  getBoundingClientRect(){return{height:this.classList.contains('interface-notice-rail')?(this.popoverOpen?this.children.filter(n=>!n.hidden).length*48:0):this.height||50};}animate(){}
 }
 const frames=[],timers=[],store=new Map(),win={innerHeight:800,addEventListener(){},dispatchEvent(){},requestAnimationFrame:fn=>frames.push(fn),ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}}};doc={defaultView:win,createElement:t=>new Element(t)};doc.documentElement=new Element('html');doc.head=new Element('head');doc.body=new Element('body');doc.documentElement.append(doc.head,doc.body);doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);doc.querySelector=s=>doc.querySelectorAll(s)[0]||null;doc.getElementById=id=>doc.querySelectorAll('*').find(n=>n.id===id)||null;win.document=doc;
 const context=vm.createContext({window:win,document:doc,location:{href:'http://localhost/index.html'},URL,CustomEvent:class{},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},setInterval(){},clearInterval(){},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},matchMedia:()=>({matches:true}),console});
 const run=name=>vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8'),context);run('result-feedback.js');
 const flush=()=>{for(let limit=0;frames.length&&limit<20;limit++)frames.shift()();assert.equal(frames.length,0);};
 return{win,doc,run,flush,timers,store};
}
test('announcement dismissal consumes its click and restores reserved page space',()=>{
 const e=environment();e.win.SAResultFeedback.notice('The GM ended the encounter.');e.flush();
 const rail=e.doc.querySelector('.interface-notice-rail'),space=e.doc.querySelector('.interface-notice-space'),close=rail.querySelector('button');
 assert.equal(space.style.height,'48px');assert.equal(space.hidden,false);assert.equal(close.type,'button');assert.ok(close.fire('pointerdown').stopped);
 const click=close.fire('click');assert.ok(click.stopped&&click.prevented);assert.equal(space.style.height,'0px');assert.equal(space.hidden,true);assert.equal(rail.popoverOpen,false);
 e.win.SAResultFeedback.notice('Encounter resumed.');e.flush();assert.equal(space.style.height,'48px');assert.match(rail.textContent,/Encounter resumed/);
});
test('full-screen native consoles keep their grid and resize below notices, then restore',()=>{
 const e=environment(),dialog=e.doc.createElement('dialog');dialog.className='shared-console-layout';dialog.open=true;dialog.height=800;dialog.style.setProperty('height','100dvh','important');e.doc.body.append(dialog);
 e.win.SAResultFeedback.notice('Enemy detected');e.flush();const rail=e.doc.querySelector('.interface-notice-rail');
 assert.equal(rail.parentElement,dialog);assert.equal(dialog.style.getPropertyValue('top'),'48px');assert.equal(dialog.style.getPropertyValue('height'),'calc(100dvh - 48px)');
 rail.querySelector('button').fire('click');assert.equal(dialog.style.getPropertyValue('height'),'100dvh');assert.equal(dialog.style.getPropertyValue('top'),'');
 dialog.open=false;e.win.SAInterfaceNotices.host().refresh();assert.equal(rail.parentElement,e.doc.body);
});
test('dismissing one result preserves earlier results and remembers only that acknowledgement',()=>{
 const e=environment();e.win.SAResultFeedback.push('first','First roll','Roll total 11.');e.win.SAResultFeedback.push('second','Second roll','Roll total 22.');e.flush();const tray=e.doc.querySelector('.result-notifications');
 assert.equal(tray.children.length,2);tray.children[1].querySelector('button').fire('click');assert.equal(tray.children.length,1);assert.match(tray.textContent,/First roll/);assert.equal(e.store.get('sa-result:second'),'1');assert.equal(e.store.has('sa-result:first'),false);
 e.win.SAResultFeedback.push('second','Second roll','Roll total 22.');assert.equal(tray.children.length,1);
});
test('lock and damage dismissals stay dismissed until the warning changes',()=>{
 const e=environment();e.run('fleet-notices.js');const status={lockedShips:[{title:'Scout'}],damagedSystems:[{shipTitle:'Scout',name:'Thruster',status:'damaged'}],activity:[],repairs:[]};
 e.win.SAFleetNotices.update({notices:status});e.flush();let lock=e.doc.querySelector('.enemy-lock-banner'),damage=e.doc.querySelector('.damaged-systems-warning');assert.equal(lock.hidden,false);assert.equal(damage.hidden,false);
 lock.querySelector('button').fire('click');e.win.SAFleetNotices.update({notices:status});e.flush();assert.equal(lock.hidden,true);assert.equal(damage.hidden,false);
 damage.querySelector('button').fire('click');e.win.SAFleetNotices.update({notices:status});e.flush();assert.equal(damage.hidden,true);
 e.win.SAFleetNotices.update({notices:{lockedShips:[],damagedSystems:[]}});e.win.SAFleetNotices.update({notices:status});e.flush();assert.equal(lock.hidden,false);assert.equal(damage.hidden,false);
});
test('fresh combat activity uses the same clickable reserved notice rail',()=>{
 const e=environment();e.run('fleet-notices.js');e.win.SAFleetNotices.update({notices:{activity:[]}});e.flush();e.win.SAFleetNotices.update({notices:{activity:[{id:'new',at:new Date().toISOString(),text:'The GM ended the encounter.'}]}});e.flush();const activity=e.doc.querySelector('.combat-activity-banner');assert.equal(activity.hidden,false);assert.match(activity.textContent,/GM ended/);assert.ok(activity.querySelector('button').fire('click').stopped);assert.equal(activity.hidden,true);
});
