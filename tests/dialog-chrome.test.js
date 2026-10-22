const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(native=false){
 let observer;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.nodeType=1;this.children=[];this.attributes={};this.className='';this.textContent='';this.disabled=false;this.hidden=false;this.type='button';this.listeners={};this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>{if(!this.classList.contains(n))this.className+=' '+n;},remove:n=>{this.className=this.className.split(' ').filter(x=>x!==n).join(' ');}};}
  setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}hasAttribute(k){return k in this.attributes;}removeAttribute(k){delete this.attributes[k];}
  set tabIndex(v){this.setAttribute('tabindex',v);}get tabIndex(){return Number(this.getAttribute('tabindex')||0);}
  matches(s){if(s.includes(','))return s.split(',').some(x=>this.matches(x));if(s==='[hidden]')return this.hidden;if(s==='[role="dialog"][aria-modal="true"]')return this.attributes.role==='dialog';return this.tagName===s.toUpperCase();}
  closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
  querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
  append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
  prepend(n){this.append(n);this.children=[n,...this.children.filter(x=>x!==n)];}
  click(){if(!this.disabled)this.onclick?.({preventDefault(){},stopPropagation(){}});}
  dispatchEvent(e){this.cancelEvent=e;return !this.preventCancel;}close(){this.closed=true;}
 }
 const root=new Element('html'),dialog=new Element(native?'dialog':'section');if(!native)dialog.setAttribute('role','dialog');root.append(dialog);
 const button=(text,attrs={})=>{const b=new Element('button');b.textContent=text;Object.assign(b,attrs);dialog.append(b);return b;};
 const run=()=>vm.runInNewContext(fs.readFileSync(require.resolve('../dialog-chrome.js'),'utf8'),{document:{documentElement:root,createElement:t=>new Element(t)},Event,MutationObserver:class{constructor(fn){observer=fn;}observe(){}}});
 const flush=()=>observer([{type:'childList',target:dialog,addedNodes:[]}]);
 const x=()=>dialog.querySelectorAll('button').find(b=>b.classList.contains('dialog-circle-close'));
 return {Element,root,dialog,button,run,flush,x};
}
test('PC submissions stay visible and X only runs the separate close handler',()=>{
 for(const label of ['Confirm and Submit','Retry Submit','Submit Manual Damage','Save PC Code and Finalize','Save Contacts and Finish','Confirm Transfer','Send to GM','Use Drama Card','Request Rest','Confirm Damage']){
  const e=fixture();let submitted=0,closed=0;
  const submit=e.button(label,{id:'closeOldAction',onclick:()=>submitted++}),close=e.button('Close',{onclick:()=>closed++});
  e.run();assert.ok(!submit.classList.contains('dialog-original-dismiss'),label);assert.ok(close.classList.contains('dialog-original-dismiss'));
  e.x().click();assert.equal(closed,1);assert.equal(submitted,0);submit.click();assert.equal(submitted,1);
 }
});
test('a reused close control becomes visible and cannot be submitted by the old X even before observer runs',()=>{
 const e=fixture();let sent=0;const b=e.button('Close',{onclick:()=>sent++});b.setAttribute('tabindex','3');e.run();
 b.textContent='Confirm and Submit';e.x().click();assert.equal(sent,0);assert.equal(e.x().disabled,true);
 assert.equal(b.classList.contains('dialog-original-dismiss'),false);assert.equal(b.getAttribute('aria-hidden'),null);assert.equal(b.getAttribute('tabindex'),'3');
 b.click();assert.equal(sent,1);
});
test('dialog re-renders rebind X to the new dismissal control, never to a detached button',()=>{
 const e=fixture();let old=0,next=0;const b=e.button('Close',{onclick:()=>old++});e.run();
 for(const child of [...e.dialog.children])child.remove();e.button('Confirm and Submit');e.button('Dismiss',{onclick:()=>next++});e.flush();e.x().click();
 assert.equal(old,0);assert.equal(next,1);assert.ok(!b.classList.contains('dialog-original-dismiss'));
});
test('gameplay cancellation and submit-type OK buttons are not dismissal controls',()=>{
 for(const label of ['Cancel Treatment','Cancel Self-Destruct','Close Exterior Door','Dismiss Projection','Confirm and Submit','OK']){
  const e=fixture(true);let actions=0;const b=e.button(label,{onclick:()=>actions++});if(label==='OK'){b.type='submit';b.form={method:'post'};}
  e.run();e.x().click();assert.equal(actions,0,label);assert.ok(!b.classList.contains('dialog-original-dismiss'));assert.equal(e.dialog.closed,true);
 }
});
test('required native rolls reject X; native cancel handlers still control dismissal',()=>{
 const e=fixture(true);e.dialog.setAttribute('data-required-roll','');e.run();assert.equal(e.x().disabled,true);e.x().click();assert.equal(e.dialog.closed,undefined);
 e.dialog.removeAttribute('data-required-roll');e.dialog.preventCancel=true;e.flush();e.x().click();assert.equal(e.dialog.closed,undefined);
 e.dialog.preventCancel=false;e.x().click();assert.equal(e.dialog.closed,true);
});
test('hidden and disabled close controls keep X disabled until the result is acknowledged',()=>{
 const e=fixture();const close=e.button('Exit',{hidden:true});e.button('Confirm and Submit');e.run();assert.equal(e.x().disabled,true);
 close.hidden=false;close.disabled=true;e.flush();assert.equal(e.x().disabled,true);
 close.disabled=false;e.flush();assert.equal(e.x().disabled,false);
});


test('X uses the final close action while preserving a separate Back navigation action',()=>{
 const e=fixture(true);let back=0,closed=0;
 const previous=e.button('Back',{onclick:()=>back++}),close=e.button('Close',{onclick:()=>closed++});
 e.run();e.x().click();assert.equal(closed,1);assert.equal(back,0);
 assert.equal(previous.classList.contains('dialog-original-dismiss'),false);
 assert.equal(close.classList.contains('dialog-original-dismiss'),true);
});
test('console exit is replaced by X and restored when reused as Console View',()=>{
 const e=fixture(true);let exits=0;const button=e.button('Exit Console',{onclick:()=>exits++});e.run();
 assert.ok(button.classList.contains('dialog-original-dismiss'));e.x().click();assert.equal(exits,1);
 button.textContent='Console View';e.flush();assert.equal(button.classList.contains('dialog-original-dismiss'),false);
});
