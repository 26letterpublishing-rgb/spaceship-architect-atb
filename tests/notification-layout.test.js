const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function environment(combat=true,reduce=true){
 let doc;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.listeners={};this.hidden=false;this.className='';this.text='';const properties=new Map();this.style={setProperty:(k,v,p='')=>properties.set(k,{v,p}),getPropertyValue:k=>properties.get(k)?.v||'',getPropertyPriority:k=>properties.get(k)?.p||'',removeProperty:k=>properties.delete(k)};this.classList={toggle:(name,on)=>{const set=new Set(this.className.split(' ').filter(Boolean));if(on)set.add(name);else set.delete(name);this.className=[...set].join(' ');},contains:name=>this.className.split(' ').includes(name)};}
  set textContent(value){this.replaceChildren();this.text=String(value);}get textContent(){return this.text+this.children.map(n=>n.textContent).join('');}
  get childElementCount(){return this.children.length;}get isConnected(){return this===doc.documentElement||!!this.parentElement?.isConnected;}get lastElementChild(){return this.children.at(-1);}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;node.ownerDocument=this.ownerDocument;this.children.push(node);}}prepend(...nodes){this.append(...nodes);this.children=[...nodes,...this.children.filter(n=>!nodes.includes(n))];}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.text='';this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}hasAttribute(k){return k in this.attributes;}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}fire(k){const e={stopped:false,prevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.prevented=true;}};for(const fn of this.listeners[k]||[])fn(e);this['on'+k]?.(e);return e;}
  matches(s){if(s.includes(','))return s.split(',').some(p=>this.matches(p));if(s===':popover-open')return!!this.popoverOpen;if(s==='dialog[open]')return this.tagName==='DIALOG'&&this.open;if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('link['))return this.tagName==='LINK';return this.tagName===s.toUpperCase();}
  querySelectorAll(s){const found=[];for(const n of this.children){if(n.matches(s))found.push(n);found.push(...n.querySelectorAll(s));}return found;}querySelector(s){return this.querySelectorAll(s)[0]||null;}
  showPopover(){this.popoverOpen=true;}hidePopover(){this.popoverOpen=false;}
  getBoundingClientRect(){return{height:this.classList.contains('interface-notice-rail')?(this.popoverOpen?this.children.filter(n=>!n.hidden).length*48:0):this.height||50};}get clientWidth(){return 500;}get scrollWidth(){return this.textContent.length*10;}animate(frames,options){this.animation={frames,options};return {finished:Promise.resolve()};}
 }
 const documentListeners={},frames=[],timers=[],store=new Map(),win={matchMedia:()=>({matches:reduce}),innerHeight:800,listeners:{},addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);},dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);},requestAnimationFrame:fn=>frames.push(fn),ResizeObserver:class{observe(){}},MutationObserver:class{observe(){}disconnect(){}}};doc={addEventListener(name,fn){(documentListeners[name]??=[]).push(fn);},defaultView:win,createElement:t=>new Element(t)};doc.documentElement=new Element('html');doc.head=new Element('head');doc.body=new Element('body');doc.documentElement.append(doc.head,doc.body);doc.querySelectorAll=s=>doc.documentElement.querySelectorAll(s);doc.querySelector=s=>doc.querySelectorAll(s)[0]||null;doc.getElementById=id=>doc.querySelectorAll('*').find(n=>n.id===id)||null;win.document=doc;
 const context=vm.createContext({window:win,document:doc,location:{href:'http://localhost/index.html'},URL,CustomEvent:class{},setTimeout:(fn,ms)=>(fn.delay=ms,timers.push(fn),timers.length),clearTimeout(){},setInterval(){},clearInterval(){},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},matchMedia:()=>({matches:reduce}),console});
 const run=name=>vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',name),'utf8'),context);run('result-feedback.js');win.SAInterfaceNotices.setCombatActive(combat);
 const flush=()=>{for(let limit=0;frames.length&&limit<20;limit++)frames.shift()();assert.equal(frames.length,0);};
 return{win,doc,run,flush,timers,store,documentListeners};
}
test('corner notice dismissal consumes clicks without reserving page space',()=>{
 const e=environment();e.win.SAResultFeedback.notice('Saved.');e.flush();const rail=e.doc.querySelector('.interface-notice-rail'),close=rail.querySelector('button');
 assert.equal(e.doc.querySelector('.interface-notice-space'),null);assert.ok(close.fire('pointerdown').stopped);const click=close.fire('click');assert.ok(click.stopped&&click.prevented);assert.equal(rail.popoverOpen,false);
 e.win.SAResultFeedback.notice('Another result');e.flush();assert.equal(rail.popoverOpen,true);
});

test('routine result lifetime is eight wall-clock seconds and duplicate packets do not renew it',()=>{
 const e=environment();e.win.SAResultFeedback.push('scan','Scan: no dice required','Guaranteed contacts.');e.flush();
 const card=e.doc.querySelector('.result-notifications').children[0];assert.equal(e.timers.length,1);assert.equal(e.timers[0].delay,8000);
 e.win.SAResultFeedback.push('scan','Scan: no dice required','Guaranteed contacts.');assert.equal(e.timers.length,1);
 e.timers[0]();assert.equal(card.isConnected,false);assert.equal(e.store.get('sa-result:scan'),'1');
 e.win.SAResultFeedback.push('scan','Scan: no dice required','Guaranteed contacts.');assert.equal(e.doc.querySelector('.result-notifications').children.length,0);
});
test('stacked result timers are independent and manual dismissal is idempotent',()=>{
 const e=environment();e.win.SAResultFeedback.push('a','Scan','Done');e.win.SAResultFeedback.push('b','Analysis','Processing');e.flush();
 const tray=e.doc.querySelector('.result-notifications');tray.children[0].querySelector('button').fire('click');e.timers[0]();assert.equal(tray.children.length,1);assert.match(tray.textContent,/Analysis/);e.timers[1]();assert.equal(tray.children.length,0);
});
test('notice rail follows the active modal without moving or resizing the Console',()=>{
 const e=environment(),modal=e.doc.createElement('dialog');modal.open=true;const matches=modal.matches.bind(modal);modal.matches=s=>s===':modal'||matches(s);e.doc.body.append(modal);
 e.win.SAResultFeedback.push('modal','Scan','Done');e.flush();const rail=e.doc.querySelector('.interface-notice-rail');assert.equal(rail.parentElement,modal);assert.equal(modal.parentElement,e.doc.body);
 modal.open=false;e.win.SAInterfaceNotices.host().refresh();assert.equal(rail.parentElement,e.doc.body);
});
test('ending combat disposes result lifecycle without clearing persistent waiting semantics early',()=>{
 const e=environment();e.win.SAResultFeedback.waiting('Required roll');e.win.SAResultFeedback.push('routine','Scan','Done');e.flush();e.timers[0]();assert.match(e.doc.querySelector('.combat-waiting-notice').textContent,/Required roll/);
 e.win.SAResultFeedback.push('pending','Analysis','Processing');e.win.SAInterfaceNotices.setCombatActive(false);e.timers[1]();assert.equal(e.doc.querySelector('.result-notifications').children.length,0);
});

test('notices never resize or reparent native consoles',()=>{
 const e=environment(),dialog=e.doc.createElement('dialog');dialog.className='shared-console-layout';dialog.open=true;dialog.style.setProperty('height','100dvh','important');e.doc.body.append(dialog);
 e.win.SAResultFeedback.notice('Saved');e.flush();const rail=e.doc.querySelector('.interface-notice-rail');assert.equal(rail.parentElement,e.doc.body);assert.equal(dialog.style.getPropertyValue('top'),'');assert.equal(dialog.style.getPropertyValue('height'),'100dvh');rail.querySelector('button').fire('click');assert.equal(dialog.style.getPropertyValue('height'),'100dvh');
});

test('dismissing one result preserves earlier results and remembers only that acknowledgement',()=>{
 const e=environment();e.win.SAResultFeedback.push('first','First roll','Roll total 11.');e.win.SAResultFeedback.push('second','Second roll','Roll total 22.');e.flush();const tray=e.doc.querySelector('.result-notifications');
 assert.equal(tray.children.length,2);tray.children[1].querySelector('button').fire('click');assert.equal(tray.children.length,1);assert.match(tray.textContent,/First roll/);assert.equal(e.store.get('sa-result:second'),'1');assert.equal(e.store.has('sa-result:first'),false);
 e.win.SAResultFeedback.push('second','Second roll','Roll total 22.');assert.equal(tray.children.length,1);
});
test('critical lock alerts queue once per transition and ordinary damage stays in logs',()=>{
 const e=environment();e.run('fleet-notices.js');const status={lockedShips:[{id:'scout',title:'Scout'}],damagedSystems:[{shipTitle:'Scout',name:'Thruster',status:'damaged'}]};
 e.win.SAFleetNotices.update({notices:status});let banner=e.doc.querySelector('.critical-flight-banner');assert.match(banner.textContent,/Enemy Locked-On/);assert.equal(e.doc.querySelector('.damaged-systems-warning'),null);
 banner.querySelector('button').fire('click');e.win.SAFleetNotices.update({notices:status});assert.equal(e.doc.querySelector('.critical-flight-banner'),null);
 e.win.SAFleetNotices.update({notices:{lockedShips:[]}});e.win.SAFleetNotices.update({notices:status});assert.ok(e.doc.querySelector('.critical-flight-banner'));
});

test('ordinary combat activity never creates a top banner',()=>{
 const e=environment();e.run('fleet-notices.js');e.win.SAFleetNotices.update({notices:{activity:[]}});e.win.SAFleetNotices.update({notices:{activity:[{id:'new',at:new Date().toISOString(),text:'The GM ended the encounter.'}]}});e.flush();assert.equal(e.doc.querySelector('.critical-flight-banner'),null);assert.equal(e.doc.querySelector('.combat-activity-banner'),null);
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

test('ending combat clears combat alerts but preserves GM roll delivery notices',()=>{
 const e=environment();e.win.SAResultFeedback.notice('Combat alert');e.win.SAResultFeedback.push('combat','Attack','Success');e.win.SAResultFeedback.push('gm-roll','Nova — Awareness','12',{allowOutsideCombat:true});e.win.SAResultFeedback.critical('danger','Enemy locked on');e.flush();
 e.win.SAInterfaceNotices.setCombatActive(false);assert.equal(e.doc.querySelector('.critical-flight-banner'),null);assert.equal(e.doc.querySelector('.result-notifications').children.length,1);assert.match(e.doc.querySelector('.result-notifications').textContent,/Nova/);assert.equal(e.doc.querySelector('.interface-notice-space'),null);
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


test('Explore keeps a GM result while hidden and shows it when that perspective returns',()=>{
 const e=environment(false);let active=false;e.win.SAExploreSession={active:()=>active};e.win.SAResultFeedback.push('late-result','Nova','Awareness: 21',{allowOutsideCombat:true});e.flush();const rail=e.doc.querySelector('.interface-notice-rail');assert.equal(!!rail.popoverOpen,false);
 active=true;e.win.dispatchEvent({type:'sa-perspective-visibility'});e.flush();assert.equal(rail.popoverOpen,true);assert.match(rail.textContent,/Awareness: 21/);
});


test('combat-start banner expires without an opacity fade and advances queued alerts',()=>{
 const e=environment();e.win.SAResultFeedback.critical('combat-start-test','ALL HANDS ON DECK','combat-start');const banner=e.doc.querySelector('.critical-flight-banner');let animated=false;banner.animate=()=>{animated=true;return {finished:Promise.resolve()};};
 assert.equal(e.timers[0].delay,8000);assert.equal(banner.querySelector('small').textContent,'---enter the combat tab immediately!---');assert.equal(banner.querySelector('button').getAttribute('aria-label'),'Dismiss All hands on deck');
 e.win.SAResultFeedback.critical('combat-start-test','All hands on deck','combat-start');assert.equal(banner.isConnected,true,'a repeated announcement cannot remove the active banner');assert.equal(e.timers.length,1);
 e.win.SAResultFeedback.critical('next-alert','Next alert','warning');e.timers.shift()();assert.equal(animated,false);assert.equal(banner.isConnected,false);assert.match(e.doc.querySelector('.critical-flight-banner').textContent,/Next alert/);
});


test('combat-start X dismisses locally, preserves deduplication and safely advances the queue',()=>{
 const e=environment(),other=environment();
 for(const session of [e,other])session.win.SAResultFeedback.critical('start','All hands on deck','combat-start');
 const banner=e.doc.querySelector('.critical-flight-banner'),timeout=e.timers[0];
 e.win.SAResultFeedback.critical('next','Next alert','warning');
 banner.querySelector('button').fire('click');
 assert.equal(banner.isConnected,false);
 const next=e.doc.querySelector('.critical-flight-banner');assert.match(next.textContent,/Next alert/);
 assert.ok(other.doc.querySelector('.critical-flight-banner'),'another client remains unaffected');
 timeout();assert.equal(e.doc.querySelector('.critical-flight-banner'),next,'stale timeout cannot close the next alert');
 e.win.SAResultFeedback.critical('start','All hands on deck','combat-start');assert.equal(e.doc.querySelector('.critical-flight-banner'),next,'dismissed announcement does not reappear');
});

const microtasks=async()=>{await Promise.resolve();await Promise.resolve();};
test('prompt result waits 24 seconds, has structured failure and critical state, and expires once',async()=>{
 const e=environment(),actions=[];e.win.SAResultFeedback.push('prompt-test','Roll','Awareness: 2 Critical Failure',{allowOutsideCombat:true,promptResult:{score:2,outcome:'Critical Failure'},onResolve:async a=>actions.push(a)});e.flush();const card=e.doc.querySelector('.result-notifications').children[0];assert.equal(card.dataset.outcome,'failed');assert.equal(card.dataset.critical,'true');assert.equal(e.timers[0].delay,24000);assert.equal(card.querySelector('b').textContent,'2');e.timers[0]();e.timers[0]();await microtasks();assert.deepEqual(actions,['expire']);assert.equal(card.isConnected,false);
});
test('manual Dismiss wins expiry race; failed acknowledgement retries the same action',async()=>{
 const e=environment(),actions=[];let fail=true;e.win.SAResultFeedback.push('prompt-dismiss','Roll','Success',{allowOutsideCombat:true,promptResult:{score:20,outcome:'Success'},onResolve:async a=>{actions.push(a);if(fail)throw Error('offline');}});e.flush();const card=e.doc.querySelector('.result-notifications').children[0];card.querySelector('.notice-dismiss').fire('click');e.timers[0]();await microtasks();assert.deepEqual(actions,['dismiss']);assert.equal(card.isConnected,true);assert.equal(card.hidden,false);assert.equal(e.store.get('sa-result:prompt-dismiss'),undefined);fail=false;e.timers.at(-1)();await microtasks();assert.deepEqual(actions,['dismiss','dismiss']);assert.equal(card.isConnected,false);
});
test('unhandled prompted result disposed on navigation is not silently acknowledged',()=>{
 const e=environment();e.win.SAResultFeedback.push('prompt-reload','Roll','Success',{allowOutsideCombat:true,promptResult:{score:20,outcome:'Success'},onResolve:()=>assert.fail('Navigation is not expiry')});for(const fn of e.win.listeners.pagehide)fn();assert.equal(e.store.get('sa-result:prompt-reload'),undefined);
});

test('prompt outcomes distinguish success, failure, criticals and no-difficulty results',()=>{for(const [outcome,color,critical] of [['Success','success',false],['Critical Success','success',true],['Failure','failed',false],['Critical Failure','failed',true],['Result','pending',false]]){const e=environment();e.win.SAResultFeedback.push(outcome,'Roll',outcome,{allowOutsideCombat:true,promptResult:{score:7,outcome},onResolve:async()=>{}});const card=e.doc.querySelector('.result-notifications').children[0];assert.equal(card.dataset.outcome,color);assert.equal(card.dataset.critical,String(critical));}});

test('critical banner follows modal transitions without resetting its timer or reviving after dismissal',()=>{
 const e=environment();e.win.SAResultFeedback.critical('owned','Detected','detection');const banner=e.doc.querySelector('.critical-flight-banner'),timer=e.timers[0];
 assert.equal(banner.parentElement,e.doc.body);
 const modal=e.doc.createElement('dialog');modal.open=true;const matches=modal.matches.bind(modal);modal.matches=s=>s===':modal'||matches(s);e.doc.body.append(modal);e.win.SAInterfaceNotices.host().refresh();
 assert.equal(banner.parentElement,modal);assert.equal(banner.popoverOpen,true);assert.equal(e.timers.length,1);
 const nested=e.doc.createElement('dialog');nested.open=true;const nestedMatches=nested.matches.bind(nested);nested.matches=s=>s===':modal'||nestedMatches(s);modal.append(nested);e.win.SAInterfaceNotices.host().refresh();assert.equal(banner.parentElement,nested);
 nested.remove();e.win.SAInterfaceNotices.host().refresh();assert.equal(banner.parentElement,modal,'removed dialogs must not swallow an active banner');
 modal.open=false;e.win.SAInterfaceNotices.host().refresh();assert.equal(banner.parentElement,e.doc.body);
 banner.querySelector('button').fire('click');e.win.SAInterfaceNotices.host().refresh();timer();e.flush();assert.equal(banner.isConnected,false);assert.equal(e.doc.querySelector('.critical-flight-banner'),null);
});

test('critical queue advances under current modal and combat ending unregisters banners',()=>{
 const e=environment(),modal=e.doc.createElement('dialog');modal.open=true;modal.matches=s=>s===':modal'||s==='dialog[open]';e.doc.body.append(modal);
 e.win.SAResultFeedback.critical('one','First');e.win.SAResultFeedback.critical('two','Second');const first=e.doc.querySelector('.critical-flight-banner');first.querySelector('button').fire('click');const second=e.doc.querySelector('.critical-flight-banner');assert.notEqual(first,second);assert.equal(second.parentElement,modal);assert.match(second.textContent,/Second/);
 e.win.SAInterfaceNotices.setCombatActive(false);e.win.SAInterfaceNotices.host().refresh();assert.equal(second.isConnected,false);assert.equal(e.doc.querySelector('.critical-flight-banner'),null);
});

test('capture bypass is limited to a currently owned notification dismissal',()=>{
 const e=environment();e.win.SAResultFeedback.critical('guarded','Detected');const button=e.doc.querySelector('.critical-flight-banner button')||e.doc.querySelector('.critical-flight-banner').querySelector('button');
 const send=target=>{const event={target:{closest:()=>target},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const fn of e.documentListeners.click)fn(event);return event;};
 const fake=e.doc.createElement('button');fake._noticeDismiss=()=>assert.fail('Unowned game control must not bypass guards');e.doc.body.append(fake);assert.equal(send(fake).stopped,undefined);
 const event=send(button);assert.equal(event.stopped,true);assert.equal(event.prevented,true);assert.equal(e.doc.querySelector('.critical-flight-banner'),null);
 button._noticeDismiss=()=>assert.fail('Detached dismiss control must not run');assert.equal(send(button).stopped,undefined);
});

test('scroll speed is constant and expiry matches the final text edge without a minimum delay',()=>{for(const message of ['Hi','Long message '.repeat(30)]){const e=environment(true,false);e.win.SAResultFeedback.critical('motion',message);const b=e.doc.querySelector('.critical-flight-banner'),t=b.querySelector('span'),duration=(500+message.length*10)/115*1000;assert.equal(t.animation.options.duration,duration);assert.equal(t.animation.options.easing,'linear');assert.equal(t.animation.frames[0].transform,'translateX(500px)');assert.equal(t.animation.frames[1].transform,'translateX(-'+message.length*10+'px)');assert.equal(e.timers[0].delay,duration);e.timers[0]();assert.equal(b.isConnected,false);}});
test('reduced motion retains full text and gives long messages reading time',()=>{const e=environment(),message=Array(90).fill('message').join(' ');e.win.SAResultFeedback.critical('read',message);const b=e.doc.querySelector('.critical-flight-banner');assert.equal(b.querySelector('span').textContent,message);assert.equal(b.querySelector('span').animation,undefined);assert.equal(e.timers[0].delay,32000);});

test('lock-loss banners suppress initial history, stale events and duplicates while preserving queue',()=>{const e=environment();e.run('fleet-notices.js');const loss=(id,age=0)=>({id,at:new Date(Date.now()-age).toISOString(),text:'Own ship: Lock-on lost.'});e.win.SAFleetNotices.update({notices:{lockLosses:[loss('initial')]}});assert.equal(e.doc.querySelector('.critical-flight-banner'),null);e.win.SAFleetNotices.update({notices:{lockLosses:[loss('stale',31000),loss('new')]}});const first=e.doc.querySelector('.critical-flight-banner');assert.match(first.textContent,/Lock-on lost/);assert.equal(first.dataset.type,'warning');e.win.SAFleetNotices.update({notices:{lockLosses:[loss('new'),loss('second')]}});first.querySelector('button').fire('click');const second=e.doc.querySelector('.critical-flight-banner');assert(second&&second!==first);second.querySelector('button').fire('click');e.win.SAFleetNotices.update({notices:{lockLosses:[loss('new'),loss('second')]}});assert.equal(e.doc.querySelector('.critical-flight-banner'),null);});
