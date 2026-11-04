const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../gm.js'),'utf8'),maps=require('../ship-map-core');
const start=source.indexOf('    const shields = window.SAShipMap.installedItems(record)');
const calculation=source.slice(start,source.indexOf('    const power =',start));
function shields(items,placements){return vm.runInNewContext(calculation+'\nshields',{window:{SAShipMap:maps},record:{ship:{sicInventory:items,placements}}});}
test('preparation shows zero shield capacity without installed shields',()=>assert.equal(shields([],[]),0));
test('preparation totals exact installed shield variants and excludes stored and queued systems',()=>{
 const items=[{id:'a',type:'shield-1'},{id:'b',type:'shield-3'},{id:'stored',type:'shield-9',storage:true},{id:'queued',type:'shield-5'},{id:'life',type:'life-support'}];
 assert.equal(shields(items,[{sicId:'a'},{sicId:'b'},{sicId:'life'}]),40);
 assert.equal(shields(items,[{sicId:'a'}]),10);
});
test('fleet card keeps all five stats ordered and existing assignment controls',()=>{
 const card=source.slice(source.indexOf('<div class="gm-starship-summary">'),source.indexOf('if (dom.showcaseNpcFleet)'));
 assert.deepEqual([...card.matchAll(/<dt>(.*?)<\/dt>/g)].map(m=>m[1]),['Hull','Shields','EN','AU','Crew']);
 for(const attribute of ['data-starship-control','data-starship-crew','data-starship-npc-crew','data-save-starship-crew'])assert.ok(card.includes(attribute));
});
