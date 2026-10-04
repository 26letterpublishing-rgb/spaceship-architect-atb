const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../starship.js'),'utf8');
const map=require('../ship-map-core.js');
function context(entries={},newShip=false){
 const records=new Map(Object.entries(entries)),shipStorage={getItem:key=>records.get(key)||null,setItem:(key,value)=>records.set(key,String(value)),removeItem:key=>records.delete(key)};
 let nextId=0;const historyCalls=[];
 const c=vm.createContext({window:{SAShipMap:map},SIC_CATALOG:map.catalog,BUILD_VERSION:3,NEW_SHIP_REQUEST:newShip,STORAGE_KEY:'draft',LIBRARY_KEY:'library',ACTIVE_STARSHIP_KEY:'active',shipStorage,uid:()=>`fresh-${++nextId}`,clone:value=>JSON.parse(JSON.stringify(value)),loadStarshipLibrary:()=>JSON.parse(shipStorage.getItem('library')||'[]'),URL,location:{href:'http://localhost/starship.html?new=1&campaign=TEST'},history:{replaceState:(_state,_title,url)=>historyCalls.push(String(url))}});
 vm.runInContext(source.slice(source.indexOf('function constructionState'),source.indexOf('GRID_SIZE=window.SAShipMap.gridColumns(draft);')),c);
 c.draft=()=>vm.runInContext('draft',c);return{c,records,historyCalls};
}
const saved=(id,title,extra={})=>({id,title,buildVersion:3,confirmedOnce:true,gridCells:[0,1],sicInventory:[],placements:[],...extra});
test('builder restores an unconfirmed working ship rather than the previously active library ship',()=>{
 const {c}=context({active:'old',library:JSON.stringify([saved('old','Old Ship')]),draft:JSON.stringify(saved('new','My new ship',{confirmedOnce:false}))});
 assert.equal(c.draft().id,'new');assert.equal(c.draft().title,'My new ship');assert.equal(c.draft().confirmedOnce,false);
});
test('builder retains latest unconfirmed edits to an existing ship across reload',()=>{
 const {c}=context({active:'same',library:JSON.stringify([saved('same','Confirmed Title')]),draft:JSON.stringify(saved('same','Edited Title',{gridCells:[0,1,2]}))});
 assert.equal(c.draft().title,'Edited Title');assert.deepEqual([...c.draft().gridCells],[0,1,2]);
});
test('missing or malformed working data falls back to the selected saved ship',()=>{
 for(const draft of ['', '{broken', '[]']){const {c}=context({active:'old',library:JSON.stringify([saved('old','Recovered')]),draft});assert.equal(c.draft().id,'old');assert.equal(c.draft().title,'Recovered');}
});
test('new ship is recoverable before the new URL flag is removed',()=>{
 const {c,records,historyCalls}=context({active:'old',library:JSON.stringify([saved('old','Old Ship')]),draft:JSON.stringify(saved('old','Old Ship'))},true);
 const first=c.draft();assert.equal(records.has('active'),false);assert.equal(JSON.parse(records.get('draft')).id,first.id);assert.equal(first.confirmedOnce,false);
 assert.equal(historyCalls.length,1);assert.equal(new URL(historyCalls[0]).searchParams.has('new'),false);assert.equal(new URL(historyCalls[0]).searchParams.get('campaign'),'TEST');
 first.title='Test Recovery';records.set('draft',JSON.stringify(first));const reloaded=context(Object.fromEntries(records));assert.equal(reloaded.c.draft().id,first.id);assert.equal(reloaded.c.draft().title,'Test Recovery');
});
test('canceling New and Delete changes neither working draft nor saved library',async()=>{
 const c=vm.createContext({draft:saved('keep','Keep me'),confirmShipDecision:async()=>false,shipStorage:{removeItem(){throw Error('Unexpected storage change');}}});
 vm.runInContext(source.slice(source.indexOf('async function startNewStarship'),source.indexOf('function resetNewShipMapView')),c);
 vm.runInContext(source.slice(source.indexOf('async function deleteStarship'),source.indexOf('function activeCampaignCredentials')),c);
 await c.startNewStarship();await c.deleteStarship();assert.equal(c.draft.id,'keep');
});
