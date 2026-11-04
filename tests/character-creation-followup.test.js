const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('../identity-presets');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
test('every race and subtype has three complete editable identity suggestions with supported genders',async()=>{
  const {RACE_DEFS}=await import('../character-data.js');
  assert.equal(Object.keys(identity.presets).length,RACE_DEFS.length);
  for(const race of RACE_DEFS){
    assert.equal(identity.presets[race.id].length,3);
    for(const type of race.types||[{id:''}])for(let i=0;i<3;i++){
      const p=identity.get(race.id,type.id,i);
      for(const field of ['characterName','sex','age','height','weight','hair','eyes','description','homePlanet'])assert.ok(p[field],race.id+' '+field);
      assert.ok(['Male','Female','Androgynous'].includes(p.sex));
      assert.equal(p.raceId,undefined);assert.equal(p.classId,undefined);assert.equal(p.playerName,undefined);
      p.characterName='Edited';assert.notEqual(identity.get(race.id,type.id,i).characterName,'Edited');
    }
  }
  assert.equal(identity.get('', '',0),null);
  assert.equal(identity.get('android','perfect-robot',0).hair,'None');
  assert.equal(identity.get('antropic','fins',0).hair,'None');
  assert.match(identity.get('yuhorn-symitron','rock',0).description,/stone/);
});
test('Auto Fill fills only blank identity fields and preserves color and existing choices',()=>{
  const character={phase:'draft',identity:{raceId:'human',raceType:'',classId:'pilot',playerName:'Real Player'},creation:{},presentation:{atbColor:'#ff678e'}};
  let saves=0,renders=0;
  const c=vm.createContext({character,CAMPAIGN_READ_ONLY_VIEW:false,window:{SAIdentityPresets:identity},HOME_PLANETS:['Earth'],Math:Object.assign(Object.create(Math),{random:()=>0}),queueSave:()=>saves++,renderAll:()=>renders++});
  vm.runInContext(source.slice(source.indexOf('function autoFillIdentity('),source.indexOf('function highlightSkillGuidance(')),c);
  c.autoFillIdentity();assert.equal(character.identity.raceId,'human');assert.equal(character.identity.classId,'pilot');assert.equal(character.identity.playerName,'Real Player');
  assert.equal(character.identity.characterName,'Mara Solis');assert.equal(character.presentation.atbColor,'#ff678e');
  character.identity.homePlanet='My Planet';character.identity.homePlanetKind='other';character.identity.age=0;character.identity.hair='   ';
  c.autoFillIdentity();assert.equal(character.identity.characterName,'Mara Solis');assert.equal(character.identity.homePlanet,'My Planet');assert.equal(character.identity.homePlanetKind,'other');assert.equal(character.identity.age,0);assert.ok(character.identity.hair.trim());assert.equal(saves,2);assert.equal(renders,2);
  character.identity.raceId='';c.autoFillIdentity();assert.equal(saves,2);
});
test('Finish Now animates the saved remaining batch before updating skills or finishing',async()=>{
 for(const raceId of ['human','pattanilia']){
  const skills={a:{tenths:20},b:{tenths:0},c:{tenths:10}},character={phase:'finalizing',identity:{raceId},creation:{finalizationQueue:['a','b','c']},pendingRoll:{skillKey:'a',resolvedResult:6}};
  let finishes=0,rolls=0,animation;
  const c=vm.createContext({character,resolveSkill:(_,key)=>({skill:skills[key]}),skillCreationLevel:s=>Math.floor(s.tenths/10),diceRoller:{stop(){},rollPool:async options=>{animation=options;}},Math:Object.assign(Object.create(Math),{random:()=>{rolls++;return .99;}}),document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null},CSS:{escape:s=>s},saveLibrary(){},renderWorkflow(){},notice:()=>assert.fail('unexpected error'),finishFinalization:()=>{finishes++;character.phase='finalized';assert.deepEqual([skills.a.tenths,skills.b.tenths,skills.c.tenths],[26,raceId==='pattanilia'?10:0,10]);}});
  vm.runInContext(source.slice(source.indexOf('async function rollFinalizationBatch('),source.indexOf('function startSkillAdvancement(')),c);
  vm.runInContext(source.slice(source.indexOf('function finishRemainingDecimals('),source.indexOf('function showDecimalSkip(')),c);
  c.finishRemainingDecimals();c.finishRemainingDecimals();assert.equal(finishes,0);assert.equal(rolls,2);assert.deepEqual([skills.a.tenths,skills.b.tenths,skills.c.tenths],[20,0,10]);assert.deepEqual(Array.from(animation.values),[6,10,10]);assert.equal(animation.presentation,'normal');
  animation.onResolved();assert.equal(finishes,0);animation.onSettled();animation.onSettled();assert.equal(finishes,1);assert.equal(character.creation.finalizationQueue.length,0);
 }
});

test('fanfare honors mute and schedules its musical resolution when enabled',()=>{
  const notes=[],c=vm.createContext({ensureCharacterAudio:()=>null,scheduleTone:(...a)=>notes.push(a),scheduleSweep:(...a)=>notes.push(a)});
  vm.runInContext(source.slice(source.indexOf('function playFinalizationFanfare('),source.indexOf('let identityRevealToken')),c);
  c.playFinalizationFanfare();assert.equal(notes.length,0);c.ensureCharacterAudio=()=>({});c.playFinalizationFanfare();assert.equal(notes.length,18);
});

test('celebration owns its roll: normal completion stops it, replacement and cancelled rolls survive stale callbacks',async()=>{
 const dice=fs.readFileSync(require.resolve('../dice-roller.js'),'utf8');const method=dice.slice(dice.indexOf('  celebrate(duration'),dice.indexOf('  stop() {',dice.indexOf('  celebrate(duration')));
 for(const mode of ['normal','replacement','cancelled']){
  let timeout,stops=0;const c=vm.createContext({window:{setTimeout:fn=>{timeout=fn;}},Promise});vm.runInContext('class Probe {'+method+'};this.Probe=Probe;',c);
  const roller=new c.Probe(),old={id:'old'},next={id:'batch'};roller.active=old;roller.shell={style:{setProperty(){}},classList:{add(){}},hidden:false};roller.stop=()=>{stops++;roller.active=null;};
  const done=roller.celebrate(420);if(mode==='replacement')roller.active=next;if(mode==='cancelled')roller.active=null;timeout();await done;
  assert.equal(stops,mode==='normal'?1:0);assert.equal(roller.active,mode==='replacement'?next:null);assert.equal(roller.shell.hidden,mode==='normal');
 }
});

test('local saved-batch resume is once-only and excludes unrelated or read-only views',()=>{
 const c=vm.createContext({CAMPAIGN_READ_ONLY_VIEW:false,GM_SHIP_VIEW:false,PAGE_PARAMS:new URLSearchParams(),campaignCode:'',activeRecovery:{character:{id:'saved'}},character:{id:'saved',phase:'finalizing',creation:{decimalBatch:[{key:'base:Piloting',value:7}]}},diceRoller:{isActive:()=>false},processFinalization(){c.calls++;c.character.creation.batchAnimating=true;},calls:0});
 vm.runInContext(source.slice(source.indexOf('function resumeSavedFinalization('),source.indexOf('function processFinalization(')),c);c.resumeSavedFinalization();c.resumeSavedFinalization();assert.equal(c.calls,1);assert.equal(c.character.creation.decimalBatch[0].value,7);
 for(const key of ['CAMPAIGN_READ_ONLY_VIEW','GM_SHIP_VIEW','campaignCode']){c.character.creation.batchAnimating=false;c[key]=true;c.resumeSavedFinalization();assert.equal(c.calls,1);c[key]=key==='campaignCode'?'':false;}
 c.PAGE_PARAMS.set('shipRoll','1');c.resumeSavedFinalization();assert.equal(c.calls,1);c.PAGE_PARAMS.delete('shipRoll');c.activeRecovery.character.id='other';c.resumeSavedFinalization();assert.equal(c.calls,1);
});
