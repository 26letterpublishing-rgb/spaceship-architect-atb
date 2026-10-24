const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../intruder-alert.js'),'utf8');
test('embedded intruder reporters share one stable banner, clear detached sources and never compete',()=>{
 let shows=0,hides=0,intervals=0;const listeners=new Map();
 const owner={frameElement:null,setInterval(){intervals++;return 1;},addEventListener(k,f){listeners.set(k,f);}};
 const doc={defaultView:owner,body:{append(e){e.isConnected=true;}},createElement(){return {isConnected:false,title:'',style:{},setAttribute(){},open:false,matches(){return this.open;},showPopover(){shows++;this.open=true;},hidePopover(){hides++;this.open=false;}};}};owner.document=doc;
 let active=true;const child={frameElement:{isConnected:true,hasAttribute(){return false;}},parent:{document:doc},addEventListener(){},SACombatBridge:{state:()=>({intruderShips:active?[{id:'ship',title:'Ship'}]:[]})}};
 const run=(window,document)=>vm.runInNewContext(source,{window,document});owner.SACombatBridge={state:()=>({intruderShips:[]})};run(owner,doc);run(child,{defaultView:child});
 const shared=owner.__saIntruderAlert;for(let i=0;i<10;i++)shared.refresh();assert.equal(intervals,1);assert.equal(shows,1);assert.equal(hides,0);
 active=false;shared.refresh();assert.equal(hides,1);active=true;shared.refresh();assert.equal(shows,2);
 child.frameElement.isConnected=false;shared.refresh();assert.equal(hides,2);assert.equal(shared.sources.size,1);
 run(owner,doc);assert.equal(intervals,1,'repeated script does not install another timer');
});
