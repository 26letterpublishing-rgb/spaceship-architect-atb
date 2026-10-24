const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){const played=[],listeners={},previews=[],saved=[];const window={SAAudioMix:{buttonSound:s=>played.push(s),setPreferences:p=>saved.push(p),previewVolume:k=>previews.push(k)},addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../audio-controls.js'),'utf8'),{window,document:{readyState:'loading',addEventListener:(key,fn)=>listeners[key]=fn},Date});
 return {api:window.SAAudioControls,played,listeners,previews,saved};}
function button(text,{override,disabled=false,custom=false,nav=false,mute=false,map=false,summary=false,expanded=false,drawer=false,pause=false,pill=false,dedicated=false}={}){return {textContent:text,dataset:{uiSound:override},parentElement:{open:expanded},classList:{contains:()=>expanded},getAttribute:k=>k==='aria-expanded'?String(expanded):'',
 closest(selector){if(selector==='[data-ui-sound]')return override?this:null;if(selector==='[inert]')return null;if(selector.startsWith('[role=tablist]'))return nav?this:null;if(selector.startsWith('svg,'))return map?this:null;if(selector==='.move-route-pill,.session-control-pill')return pill?this:null;return this;},
 matches(selector){if(selector.startsWith('#gmPanicPause'))return dedicated;if(selector.startsWith(':disabled'))return disabled;if(selector.startsWith('[data-mute]'))return mute;if(selector==='button,a,input,summary')return !custom;if(selector.includes('[role=tab]'))return nav;if(selector==='summary')return summary;if(selector==='.pc-sheet-handle')return drawer;if(selector==='#pauseSession')return pause;return false;}};}
test('explicit overrides and role priority cover confirmation/navigation/standard',()=>{const {api}=setup();
 for(const [label,expected] of [['Save and Close','robot'],['Confirm Return','chunk'],['View Inventory','chunk'],['Wait 3','chunk'],['Close','chunk'],['Load Campaign','robot']])assert.equal(api.role(button(label)),expected,label);
 assert.equal(api.role(button('Confirm',{override:'whoosh'})),'whoosh');assert.equal(api.role(button('Chosen Robot',{override:'robot',pill:true})),'robot');assert.equal(api.role(button('Mute',{mute:true})),'none');
});
test('delegation covers dynamic controls and nested targets without programmatic/disabled feedback',()=>{const {api,played}=setup();const b=button('Confirm');
 api.activate({type:'click',target:{closest:()=>b},isTrusted:true,detail:1});assert.deepEqual(played,['chunk']);
 api.activate({type:'click',target:b,isTrusted:false});api.activate({type:'click',target:button('Save',{disabled:true}),isTrusted:true});assert.equal(played.length,1);
 api.activate({type:'click',target:button('Open panel'),isTrusted:true});assert.deepEqual(played,['chunk','chunk']);
});
test('native keyboard uses click once; custom keyboard avoids repeats and duplicate click',()=>{const {api,played}=setup();const b=button('Save');
 api.activate({type:'keydown',key:'Enter',target:b});api.activate({type:'click',detail:0,target:b});assert.deepEqual(played,['robot']);
 const custom=button('View',{custom:true});api.activate({type:'keydown',key:'Enter',target:custom});api.activate({type:'keydown',key:'Enter',target:custom,repeat:true});api.activate({type:'click',detail:0,target:custom});assert.deepEqual(played,['robot','chunk']);
});
test('visual tabs and map surfaces stay silent; drawer and expansion exceptions remain',()=>{const {api}=setup();
 assert.equal(api.role(button('Save',{nav:true,override:'robot'})),'none');assert.equal(api.role(button('Travel',{map:true})),'none');
 assert.equal(api.role(button('Core & Propulsion',{summary:true})),'whoosh');assert.equal(api.role(button('Core & Propulsion',{summary:true,expanded:true})),'none');
 assert.equal(api.role(button('Character Sheet',{drawer:true})),'chunk');assert.equal(api.role(button('Pause',{pause:true})),'pause-tone');assert.equal(api.role(button('Play',{pause:true,expanded:true})),'play-tone');
});

test('pills default to Chunk and Robot requires an explicit assignment',()=>{const {api}=setup();assert.equal(api.role(button('Direct Route',{pill:true})),'chunk');assert.equal(api.role(button('End',{pill:true})),'chunk');assert.equal(api.role(button('Combat',{pill:true,nav:true})),'none');});

test('map camera controls stay silent before pill/override feedback, including dynamic keyboard activation',()=>{
 const s=setup();
 for(const selector of ['[data-zoom]','[data-auto-zoom]','[data-fit]','[data-map-zoom]','[data-map-fit]','[data-prep-zoom]','[data-prep-fit]','[data-arena-zoom]','[data-arena-fit]','[data-preview-zoom]','[data-interior-fit]','[data-grid-zoom]','[data-large-zoom]','[data-combat-interior-zoom]','.airlock-door-map [data-minus]','.airlock-door-map [data-plus]']){
  const b=button('+',{pill:true,override:'robot'}),matches=b.matches;
  b.matches=function(query){return query.split(',').includes(selector)||matches.call(this,query);};
  assert.equal(s.api.role(b),'none',selector);
  s.api.activate({type:'click',target:{closest:()=>b},isTrusted:true,detail:1});
  s.api.activate({type:'keydown',key:'Enter',target:b,isTrusted:true});
  s.api.activate({type:'click',target:b,isTrusted:true,detail:0});
 }
 for(const label of ['Zoom in Galaxy Map','Zoom out surface map','Fit Map','Fit Ship','Fit Contacts','Fit Link Range'])assert.equal(s.api.role(button(label,{pill:true})),'none',label);
 assert.deepEqual(s.played,[]);
 assert.equal(s.api.role(button('Enlarge Map')),'whoosh','opening a map still follows normal navigation feedback');
 assert.equal(s.api.role(button('Zoom in card')),'chunk','card toolbar is outside this map-only change');
 assert.equal(s.api.role(button('+')),'chunk','unrelated increment controls retain feedback');
});

test('sliders preview only committed user changes, after saving their current value',()=>{
 const s=setup();for(const key of ['master','game','interface']){
  const input={dataset:{volume:key},value:'42',matches:()=>true};
  s.api.activate({type:'click',target:{closest:()=>null},isTrusted:true});assert.equal(s.played.length,0);
  s.listeners.change({isTrusted:true,target:input});assert.equal(s.previews.at(-1),key);assert.equal(s.saved.at(-1)[key],42);
 }
 s.listeners.change({isTrusted:false,target:{dataset:{volume:'game'},matches:()=>true}});
 s.listeners.change({isTrusted:true,target:{dataset:{volume:'game'},matches:()=>false}});
 assert.equal(s.previews.length,3);assert.equal(s.listeners.input,undefined,'drag input is not delegated to the preview listener');
});

test('actions with dedicated effects skip generic feedback, including pills, keyboard and submitted forms',()=>{
 const s=setup(),engage=button('Engage Clock',{dedicated:true,pill:true});
 assert.equal(s.api.role(engage),'none');s.api.activate({type:'click',target:engage,isTrusted:true,detail:1});assert.deepEqual(s.played,[]);
 const keyboard=setup(),roll=button('Roll for Me',{dedicated:true});keyboard.api.activate({type:'keydown',key:'Enter',target:roll});keyboard.api.activate({type:'click',detail:0,target:roll});assert.deepEqual(keyboard.played,[]);
 const form=setup(),target={closest:()=>null};form.listeners.submit({isTrusted:true,target,submitter:button('Confirm',{override:'none'})});assert.deepEqual(form.played,[]);
 form.listeners.submit({isTrusted:true,target,submitter:button('Save')});assert.deepEqual(form.played,['robot'],'Save is an explicit Robot exception');
 const explicit=setup();explicit.listeners.submit({isTrusted:true,target,submitter:button('Save',{override:'robot'})});assert.deepEqual(explicit.played,['robot']);
 const implicit=setup();implicit.listeners.submit({isTrusted:true,target});assert.deepEqual(implicit.played,['chunk']);
 assert.equal(s.api.role(button('Pause',{pause:true,pill:true})),'pause-tone','campaign clock retains its dedicated tone');
});

test('requested role exceptions override labels while reward and close actions stay silent',()=>{
 const {api}=setup();
 for(const [label,expected] of [['Begin Session 2','robot'],['End Session','robot'],['Log Entry','robot'],['Add NPC','robot'],['Add PC','robot'],['Begin Finalization','robot'],['Show Save Character','chunk'],['Confirm Skill Packages','chunk'],['Help','whoosh'],['Return to Campaign','whoosh'],['Save and Return to Campaign','robot'],['Quick Check','none'],['×','none']])assert.equal(api.role(button(label)),expected,label);
 for(const [selector,label,expected] of [['[data-claim-reward]','Receive Reverence','none'],['input[type=checkbox]','Save preference','none'],['[data-help-page]','Next','none'],['[data-help-page]','Previous','none'],['[data-sg-prev]','Previous','none'],['[data-sg-next]','Next','none'],['#pcHeaderMail','Mail','whoosh'],['#gmMailButton','Mail','whoosh'],['#endSession','End','robot'],['[data-apply-packages]','Confirm Skill Packages','chunk']]){
 const b=button(label),match=b.matches;b.matches=function(q){return q.split(',').includes(selector)||match.call(this,q);};assert.equal(api.role(b),expected,selector);
 }
});
