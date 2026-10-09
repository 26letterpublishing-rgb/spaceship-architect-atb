const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('header shortcut opens preparation, hides there and retains active End Combat behavior',()=>{
 const source=fs.readFileSync(require.resolve('../gm.js'),'utf8'),start=source.indexOf('function updateExitEncounterVisibility()'),end=source.indexOf('function deploymentOptions',start),tab={hidden:true},noticeStates=[];
 const c=vm.createContext({window:{SAInterfaceNotices:{setCombatActive:active=>noticeStates.push(active)}},campaign:{combatActive:false},encounterState:null,dom:{atbLive:{hidden:true},atbSetup:{hidden:false},exitEncounter:{}},document:{querySelector:()=>tab}});vm.runInContext(source.slice(start,end),c);
 c.updateExitEncounterVisibility();assert.equal(c.dom.exitEncounter.textContent,'Prepare Combat');assert.equal(c.dom.exitEncounter.hidden,false);
 tab.hidden=false;c.updateExitEncounterVisibility();assert.equal(c.dom.exitEncounter.hidden,true);
 c.campaign.combatActive=true;c.updateExitEncounterVisibility();assert.equal(c.dom.exitEncounter.textContent,'End Combat');assert.equal(c.dom.exitEncounter.hidden,false);
 c.dom.atbLive.hidden=false;c.updateExitEncounterVisibility();assert.equal(c.dom.exitEncounter.hidden,true);
 c.campaign=null;c.updateExitEncounterVisibility();assert.equal(c.dom.exitEncounter.hidden,true);assert.deepEqual(noticeStates,[false,false,true,true,false]);
});
