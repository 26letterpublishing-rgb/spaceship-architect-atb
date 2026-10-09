const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(combat=true){
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
 const frames=[],timers=[],store=new Map(),win={innerHeight:800,listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);},requestAnimationFrame:fn=>frames.push(fn),ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}}};doc={defaultView:win,createElement:t=>new Element(t)};doc.documentElement=new Element('html');doc.head=new Element('head');doc.body=new Element('body');doc.documentElement.append(doc.head,doc.body);doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);doc.querySelector=s=>doc.querySelectorAll(s)[0]||null;doc.getElementById=id=>doc.querySelectorAll('*').find(n=>n.id===id)||null;win.document=doc;
 const context=vm.createContext({window:win,document:doc,location:{href:'http://localhost/index.html'},URL,CustomEvent:class{},setTimeout:fn=>(timers.push(fn),timers.length),clearTimeout(){},setInterval(){},clearInterval(){},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},matchMedia:()=>({matches:true}),console});
 const run=name=>vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8'),context);run('result-feedback.js');win.SAInterfaceNotices.setCombatActive(combat);
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


test('outside combat suppresses all rail messages and results without deferring them',()=>{
 const e=environment(false);
 for(const kind of ['', 'success','error'])e.win.SAResultFeedback.notice('Setting changed',kind);
 e.win.SAResultFeedback.push('outside','Diagnostics','Complete');e.flush();
 assert.equal(e.doc.querySelector('.interface-notice-rail'),null);
 assert.equal(e.store.get('sa-result:outside'),'1');
 e.win.SAInterfaceNotices.setCombatActive(true);e.win.SAResultFeedback.push('outside','Diagnostics','Complete');e.flush();
 assert.equal(e.doc.querySelector('.result-notifications'),null);
 e.win.SAResultFeedback.notice('New combat alert');e.flush();assert.equal(e.doc.querySelector('.interface-notice-rail').popoverOpen,true);
});

test('ending combat clears alerts and restores space even with a console open',()=>{
 const e=environment(),dialog=e.doc.createElement('dialog');dialog.className='shared-console-layout';dialog.open=true;dialog.height=800;dialog.style.setProperty('height','100dvh');e.doc.body.append(dialog);
 e.win.SAResultFeedback.notice('Combat alert');e.win.SAResultFeedback.push('combat','Attack','Success');e.flush();
 const rail=e.doc.querySelector('.interface-notice-rail');assert.equal(rail.popoverOpen,true);
 e.win.SAInterfaceNotices.setCombatActive(false);assert.equal(rail.popoverOpen,false);assert.equal(e.doc.querySelector('.interface-notice-space').hidden,true);assert.equal(dialog.style.getPropertyValue('height'),'100dvh');
 assert.equal(e.doc.querySelector('.result-notifications').children.length,0);
 const foreign=e.doc.createElement('div');foreign.textContent='External fleet warning';e.win.SAInterfaceNotices.host().mount(foreign);e.flush();assert.equal(foreign.hidden,true);
 e.win.SAInterfaceNotices.setCombatActive(true);assert.equal(rail.popoverOpen,false);
});

test('paused combat retains alerts while preparation, previews and ended encounters suppress them',()=>{
 const e=environment(false),send=state=>e.win.dispatchEvent({type:'sa-combat-state',detail:{state}});
 send({hasEngagedClock:true,running:false});assert.equal(e.win.SAInterfaceNotices.isCombatActive(),true);
 for(const state of [{hasEngagedClock:false},{hasEngagedClock:true,practice:true},{hasEngagedClock:true,catalogPreview:true},{hasEngagedClock:true,encounterEndedAt:'ended'}]){send(state);assert.equal(e.win.SAInterfaceNotices.isCombatActive(),false);}
});

test('embedded consoles follow their campaign shell and Explore perspectives remain isolated',()=>{
 const parent=environment(false),child=environment(true);child.win.frameElement=parent.doc.createElement('iframe');child.win.parent=parent.win;
 assert.equal(child.win.SAInterfaceNotices.isCombatActive(),false);
 child.win.SAResultFeedback.notice('Stale console alert');assert.equal(parent.doc.querySelector('.interface-notice-rail'),null);
 parent.win.SAInterfaceNotices.setCombatActive(true);assert.equal(child.win.SAInterfaceNotices.isCombatActive(),true);
 child.win.frameElement.setAttribute('data-explore-perspective','pc');child.win.SAInterfaceNotices.setCombatActive(false);
 assert.equal(child.win.SAInterfaceNotices.isCombatActive(),false);assert.equal(parent.win.SAInterfaceNotices.isCombatActive(),true);
});

test('Banner Exits is the default while explicit PC preferences are retained',()=>{
 const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
 const code=source.slice(source.indexOf('const storedPlayerBannerMode ='),source.indexOf('const storedSkillSort ='));
 for(const value of [null,'invalid','show','hidden','exit']){
  const context=vm.createContext({PLAYER_BANNER_MODE_KEY:'banner',PLAYER_SOUND_KEY:'sound',localStorage:{getItem:key=>key==='banner'?value:null}});
  vm.runInContext(code,context);assert.equal(vm.runInContext('playerBannerMode',context),['show','hidden','exit'].includes(value)?value:'exit');
 }
});
