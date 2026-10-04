const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../starship.js'),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const output={},buttons=[{}],requests=[],saved=[],rendered=[];
 const ship={id:'one',title:'Original',campaignLink:{roomCode:'TEST'},gridCells:[0,1],groupCredits:1000,warpFuel:{F:0},minerals:{},missileAmmo:{},missileStorage:{},resourceReceipts:[]};ship.confirmed=clone(ship);
 const c=vm.createContext({draft:ship,shipStockRequest:null,linkedCampaignState:{code:'TEST'},pageParameters:new URLSearchParams(),clone,uid:()=>String(requests.length+1),document:{querySelector:()=>output,querySelectorAll:()=>buttons},statesMatch:(left,right)=>JSON.stringify(left.gridCells)===JSON.stringify(right.gridCells),activeCampaignCredentials:()=>({token:'gm'}),campaignApi:(url,body)=>new Promise((resolve,reject)=>requests.push({url,body,resolve,reject})),saveDraft:()=>saved.push(clone(c.draft)),renderAll:()=>rendered.push('all'),renderShipStores:()=>buttons.forEach(b=>b.disabled=!!c.shipStockRequest)});
 vm.runInContext(source.slice(source.indexOf('async function saveShipStock'),source.indexOf('shipFields.forEach',source.indexOf('async function saveShipStock'))),c);
 const result=()=>({campaign:{code:'TEST'},starship:{ship:{warpFuel:{F:2},minerals:{},missileAmmo:{},missileStorage:{},groupCredits:800,resourceReceipts:['received']}}});
 return{c,output,buttons,requests,saved,rendered,result};
}
test('stock purchases submit once while pending and recover after a server error',async()=>{
 const {c,requests,buttons,result}=setup();const first=c.saveShipStock({purchaseGrade:'F',quantity:2});assert.equal(buttons[0].disabled,true);
 const duplicate=await c.saveShipStock({purchaseGrade:'F',quantity:2});assert.equal(duplicate.ok,false);assert.equal(requests.length,1);
 requests[0].reject(Error('Disconnected'));assert.equal((await first).ok,false);assert.equal(c.shipStockRequest,null);assert.equal(buttons[0].disabled,false);
 const retry=c.saveShipStock({purchaseGrade:'F',quantity:2});requests[1].resolve(result());assert.equal((await retry).ok,true);assert.equal(c.draft.warpFuel.F,2);
});
test('a resource response cannot overwrite a newly selected or newly created draft',async()=>{
 const {c,requests,saved,rendered,result}=setup();const pending=c.saveShipStock({purchaseGrade:'F',quantity:2});const newer={id:'two',title:'New Ship',groupCredits:50000,warpFuel:{F:10}};c.draft=newer;
 requests[0].resolve(result());const answer=await pending;assert.equal(answer.stale,true);assert.match(answer.message,/Original/);assert.equal(c.draft,newer);assert.equal(c.draft.groupCredits,50000);assert.equal(c.draft.warpFuel.F,10);assert.equal(saved.length,0);assert.equal(rendered.length,0);
});
test('resource completion preserves unconfirmed layout changes made while waiting',async()=>{
 const {c,requests,result}=setup();const pending=c.saveShipStock({purchaseGrade:'F',quantity:2});c.draft.gridCells.push(2);requests[0].resolve(result());await pending;
 assert.deepEqual([...c.draft.gridCells],[0,1,2]);assert.deepEqual([...c.draft.confirmed.gridCells],[0,1]);assert.equal(c.draft.warpFuel.F,2);assert.equal(c.draft.confirmed.warpFuel.F,2);assert.equal(c.draft.confirmed.groupCredits,800);
});
test('stock mutation remains unavailable in detail views and active combat',async()=>{
 const {c,requests}=setup();c.pageParameters.set('details','1');assert.equal((await c.saveShipStock({purchaseGrade:'F',quantity:2})).ok,false);c.pageParameters.delete('details');c.linkedCampaignState.combatActive=true;assert.equal((await c.saveShipStock({purchaseGrade:'F',quantity:2})).ok,false);assert.equal(requests.length,0);
});
test('editing ammunition quantity does not reenable or resubmit a pending purchase',async()=>{
 const button={},space={},status={},close={},form={quantity:{value:'1'},ammunition:{value:'missile-1'},launcher:{value:''},querySelector:()=>button,querySelectorAll:()=>[]};const view={style:{},setAttribute(){},querySelector(selector){return selector==='form'?form:selector==='[data-space]'?space:selector==='[role=status]'?status:close;},showModal(){},remove(){}};const document={defaultView:{frameElement:null},createElement:()=>view,body:{append(){}}};let resolvePurchase,calls=0;
 const c=vm.createContext({draft:{id:'one',groupCredits:1000,sicInventory:[],placements:[]},shipStockRequest:null,linkedCampaignState:{},document,window:{SAShipMap:{definition:()=>({})},SAMissileAmmo:{catalog:{}}},saveShipStock:()=>{calls++;return new Promise(resolve=>resolvePurchase=resolve);}});
 vm.runInContext(source.slice(source.indexOf('function purchaseMissile'),source.indexOf('async function saveShipStock')),c);c.purchaseMissile('missile-1');
 const pending=form.onsubmit({preventDefault(){}});assert.equal(button.disabled,true);form.quantity.value='4';form.onchange();assert.equal(button.disabled,true);await form.onsubmit({preventDefault(){}});assert.equal(calls,1);resolvePurchase({message:'Ship stores updated.'});await pending;assert.equal(button.disabled,false);assert.equal(status.textContent,'Ship stores updated.');
});
