const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../character.js'),'utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
test('drawer references refresh for stored gear, weapons, notes and earned experience without unrelated section churn',()=>{
 const c=vm.createContext({character:{id:'pc',phase:'finalized',items:[],storedItems:[],weapons:[],storedWeapons:[],resources:{},experience:{available:0},identity:{},crew:[],notes:'old'},campaignEditable:true,campaignState:{shipCredits:10}});
 vm.runInContext(section('function sheetDrawerRevision','function updateSheetDrawer'),c);
 for(const [sectionName,field,value]of [['supplies','items',[{name:'Tool'}]],['supplies','storedWeapons',[{weaponId:'rifle'}]],['identity','notes','new'],['identity','crew',[{name:'Alex'}]],['resources','experience',{available:10}]]){const before=c.sheetDrawerRevision(sectionName);c.character[field]=value;assert.notEqual(c.sheetDrawerRevision(sectionName),before,field+' refreshes '+sectionName);}
 const attributes=c.sheetDrawerRevision('attributes');c.character.storedItems.push({name:'Spare'});assert.equal(c.sheetDrawerRevision('attributes'),attributes);
});
test('drawer controls mirror the actual selected value while remaining references',()=>{
 const c=vm.createContext({});vm.runInContext(section('function copySheetReferenceState','function updateSheetDrawer'),c);
 const copy={value:'default',selectedIndex:0,disabled:true},original={tagName:'SELECT',value:'selected-rifle',selectedIndex:3};c.copySheetReferenceState(copy,original);assert.equal(copy.value,'selected-rifle');assert.equal(copy.selectedIndex,3);assert.equal(copy.disabled,true);
 const checkbox={value:'',checked:false,disabled:true};c.copySheetReferenceState(checkbox,{tagName:'INPUT',value:'yes',checked:true});assert.equal(checkbox.checked,true);assert.equal(checkbox.disabled,true);
});
function purchaseContext(){
 const requests=[],notices=[],c=vm.createContext({character:{id:'one',identity:{characterName:'Alex'},phase:'finalized',resources:{creditsBase:1000},items:[]},campaignCode:'TEST',campaignCharacterId:'one',campaignToken:'token',campaignEditable:true,campaignDirty:true,gearPurchasePending:false,GM_ADJUSTMENT_MODE:false,manualInputMode:()=>false,mayReceiveGearForFree:()=>true,notice:(...args)=>notices.push(args),gearPayload:item=>item,deepCopy:value=>JSON.parse(JSON.stringify(value)),askConfirmation:async()=>false,campaignRequest:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject})),receiveCampaignState(){},renderResources(){},renderGear(){},queueSave(){},mergeItemInto(){throw Error('Unexpected local mutation');}});
 vm.runInContext(section('async function addGearItem','async function removeCarriedItem'),c);return{c,requests,notices};
}
test('pending gear purchase cannot apply its response to a different selected character',async()=>{
 const {c,requests}=purchaseContext();const pending=c.addGearItem({name:'Tool',unitCost:10},'purchase');c.character={id:'two',identity:{characterName:'Blair'},resources:{creditsBase:500},items:[{name:'Keep'}]};c.campaignCharacterId='two';
 requests[0].resolve({campaign:{characters:[{id:'one',character:{resources:{creditsBase:990},items:[{name:'Tool'}]}}]}});
 await assert.rejects(pending,/completed for Alex/);assert.equal(c.character.resources.creditsBase,500);assert.equal(c.character.items[0].name,'Keep');assert.equal(c.gearPurchasePending,false);
});
test('gear purchase has one in-flight transaction and retains unrelated unsaved character edits',async()=>{
 const {c,requests}=purchaseContext();const pending=c.addGearItem({name:'Tool',unitCost:10},'purchase');assert.equal(await c.addGearItem({name:'Tool',unitCost:10},'purchase'),false);assert.equal(requests.length,1);
 requests[0].resolve({campaign:{characters:[{id:'one',character:{resources:{creditsBase:990},items:[{name:'Tool'}]}}]}});assert.equal(await pending,true);assert.equal(c.character.items[0].name,'Tool');assert.equal(c.campaignDirty,true);assert.equal(c.gearPurchasePending,false);
});
test('canceling negative-credit purchase restores Purchase +1 instead of leaving it disabled',async()=>{
 const {c}=purchaseContext();c.character.resources.creditsBase=0;assert.equal(await c.addGearItem({name:'Tool',unitCost:10},'purchase'),false);assert.equal(c.gearPurchasePending,false);
 const button={dataset:{gearId:'tool',gearAddMode:'purchase'}},event={target:{closest:()=>button}};let rendered=0;
 c.character.items=[{id:'tool',name:'Tool',unitCost:10}];c.event=event;c.renderGear=()=>rendered++;c.pendingGearAdds=new Set(['tool']);c.renderAll=()=>{};
 const handler=section('  const addMode = event.target.closest("[data-gear-add-mode]");','  const minus = event.target.closest("[data-gear-minus]");');vm.runInContext('async function handle(){'+handler+'}',c);await c.handle();assert.equal(button.disabled,false);assert.equal(rendered,1);
});
test('hacking practice closes and clears its local session even when busy and server cleanup fails',async()=>{
 const hacking=fs.readFileSync(path.join(__dirname,'../hacking-practice-ui.js'),'utf8'),begin=hacking.indexOf("  $('#endPractice').onclick="),end=hacking.indexOf("  $('#clearGuess')",begin),control={};let closed=0,removed=0,redirect='';
 const c=vm.createContext({$:()=>control,busy:true,ending:false,token:'expired',key:'practice',render(){},request:async()=>{throw Error('Offline');},sessionStorage:{removeItem(){removed++;}},window:{close(){closed++;},closed:false},setTimeout:fn=>fn(),location:{assign:value=>redirect=value}});
 vm.runInContext(hacking.slice(begin,end),c);await control.onclick({preventDefault(){}});await Promise.resolve();assert.equal(closed,1);assert.equal(removed,1);assert.equal(redirect,'index.html');
});
