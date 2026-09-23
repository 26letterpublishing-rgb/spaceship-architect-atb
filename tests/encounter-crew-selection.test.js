const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../gm.js'),'utf8');
function fixture(){
 const listeners={},pc={id:'nova',approved:true},npc={id:'slug',characterName:'Space Slug',team:'npc',weapons:[]};
 const c=vm.createContext({campaign:{characters:[pc],starships:['original','ai','sensors'].map(id=>({id,crewCharacterIds:['nova'],crewNpcUnitIds:['slug']}))},selectedEncounterStarships:new Set(),selectedEncounterCharacters:new Set(),encounterLocations:new Map(),stagedNpcs:[],encounterMode:'starship',encounterPreparing:false,encounterDistances:[],encounterPositions:[],encounterObjects:[],messages:[],confirmGm:async()=>true,code:'TEST',structuredClone,crypto:{randomUUID:()=> 'preparation-test'},sessionStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},campaignNpcRoster:()=>[npc],stagedNpc:u=>({id:'stage-'+u.id}),renderEncounterBuilder:()=>{},showMessage:(_node,text)=>c.messages.push(text),dom:{message:{},encounterCharacterList:{addEventListener:(type,fn)=>listeners.roster=fn},encounterNpcList:{addEventListener:(type,fn)=>listeners.location=fn},beginEncounter:{},atbFrame:{scrollIntoView:()=>{}}},characterName:r=>r.id,playerName:()=> 'Player',characterSpeed:()=>5,commandWindow:()=>120,encounterRuleFields:()=>({}),combatLocation:id=>({starshipId:id}),defaultDeployment:()=> 'original',weaponById:()=>({id:'unarmed'}),showEncounterLive:()=>{},encounterAction:async(action,setup)=>{c.prepared=setup;return {};}});
 const block=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 vm.runInContext(block('function stageCrewNpc(', 'function renderEncounterBuilder('),c);
 vm.runInContext(block('dom.encounterCharacterList.addEventListener("change"','document.querySelector("#encounterBuilder")'),c);
 vm.runInContext(block('dom.encounterNpcList.addEventListener("change"','window.addEventListener("storage"'),c);
 vm.runInContext(block('async function beginEncounter()', 'function renderScriptEditor('),c);
 c.change=(kind,id,ship,checked=true)=>{const key={npc:'encounterNpc',pc:'encounterCharacter',ship:'encounterStarship'}[kind],selector={npc:'[data-encounter-npc]',pc:'[data-encounter-character]',ship:'[data-encounter-starship]'}[kind],input={checked,dataset:{[key]:id,crewShip:ship}};listeners.roster({target:{closest:s=>s===selector?input:null}});};
 c.relocate=(id,ship)=>listeners.location({target:{closest:()=>({value:ship,dataset:{stagedLocation:id}})}});return c;
}
test('same roster NPC moves to the chosen ship without duplicate staging or mirrored checkboxes; combat prepares aboard it',async()=>{
 const c=fixture();c.change('ship','original');c.change('ship','ai');assert.equal(c.stagedNpcs.length,1);assert.equal(c.stagedNpcs[0].locationStarshipId,'ai');
 assert.equal(c.crewSelectedForShip('npc','slug','original'),false);assert.equal(c.crewSelectedForShip('npc','slug','ai'),true);
 c.change('ship','original',null,false);assert.equal(c.stagedNpcs.length,1);assert.equal(c.selectedEncounterCharacters.has('nova'),true);
 c.change('npc','slug','ai',false);assert.equal(c.stagedNpcs.length,0);c.change('npc','slug','ai');
 await c.beginEncounter();assert.ok(c.prepared,JSON.stringify(c.messages));assert.equal(c.prepared.units.filter(u=>u.npcRosterId==='slug').length,1);assert.equal(c.prepared.units.find(u=>u.npcRosterId==='slug').location.starshipId,'ai');
});
test('PC crew checkbox selects only that ship, moves location, and ignores unchecking another membership',async()=>{
 const c=fixture();c.change('pc','nova','original');c.change('pc','nova','ai');assert.equal(c.selectedEncounterCharacters.size,1);assert.equal(c.encounterLocations.get('nova'),'ai');
 assert.equal(c.crewSelectedForShip('pc','nova','original'),false);assert.equal(c.crewSelectedForShip('pc','nova','ai'),true);
 c.change('pc','nova','original',false);c.change('ship','original',null,false);assert.equal(c.selectedEncounterCharacters.has('nova'),true);
 await c.beginEncounter();assert.equal(c.prepared.units[0].location.starshipId,'ai');
 c.change('ship','ai',null,false);assert.equal(c.selectedEncounterCharacters.size,0);
});
test('checking crew includes its ship, changing NPC dropdown follows that ship, and removing it clears only its occupants',()=>{
 const c=fixture();c.change('npc','slug','ai');assert.equal(c.selectedEncounterStarships.has('ai'),true);c.relocate(c.stagedNpcs[0].id,'sensors');assert.equal(c.crewSelectedForShip('npc','slug','ai'),false);assert.equal(c.crewSelectedForShip('npc','slug','sensors'),true);
 c.change('ship','ai',null,false);assert.equal(c.stagedNpcs.length,1);c.change('ship','sensors',null,false);assert.equal(c.stagedNpcs.length,0);
 c.stagedNpcs.push({id:'custom',locationStarshipId:'ai'});c.change('ship','ai',null,false);assert.equal(c.stagedNpcs.length,0);
});
test('crew and dropdown selections cannot bypass the six-ship limit',()=>{
 const c=fixture();for(let n=0;n<6;n++)c.selectedEncounterStarships.add('ship-'+n);c.change('pc','nova','ai');c.change('npc','slug','ai');assert.equal(c.selectedEncounterCharacters.size,0);assert.equal(c.stagedNpcs.length,0);
 c.stagedNpcs.push({id:'custom',locationStarshipId:'ship-0'});c.relocate('custom','ai');assert.equal(c.stagedNpcs[0].locationStarshipId,'ship-0');assert.equal(c.selectedEncounterStarships.size,6);
});
test('Explore variant names are distinct role names while SIC descriptions and original flagship names remain available',()=>{
 const variants=require('../showcase-variants')();assert.equal(new Set(variants.map(s=>s.title.split(' — ')[0])).size,11);
 for(const s of variants){assert.doesNotMatch(s.title,/^(Red Horizon|Wayfinder)/);assert.equal(s.title,s.ship.title);assert.match(s.title,/ — (Ship AI|VR Training|Warp Drive|Sensors|Probe Launcher|Planetary Cleanser)/);}
 const make=require('../showcase-ships');assert.equal(make('a','Wayfinder','pc',[],146).title,'Wayfinder');assert.equal(make('b','Red Horizon','gm',[],148).title,'Red Horizon');
});

test('solo exploration warns before preparation and cancellation preserves selections',async()=>{
 const c=fixture();c.change('pc','nova','ai');let warning;c.confirmGm=async options=>{warning=options;return false;};await c.beginEncounter();assert.match(warning.message,/No NPC starships or NPCs/);assert.equal(c.prepared,undefined);assert.equal(c.selectedEncounterCharacters.has('nova'),true);c.confirmGm=async()=>true;await c.beginEncounter();assert.equal(c.prepared.units.length,1);assert.equal(c.prepared.units[0].team,'pc');
});
