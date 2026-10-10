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
test('Auto Fill preserves race, class and player name while replacing editable identity and color',()=>{
  const character={phase:'draft',identity:{raceId:'human',raceType:'',classId:'pilot',playerName:'Real Player'},creation:{},presentation:{atbColor:'#ff678e'}};
  let saves=0,renders=0;
  const c=vm.createContext({character,CAMPAIGN_READ_ONLY_VIEW:false,window:{SAIdentityPresets:identity},HOME_PLANETS:['Earth'],Math:Object.assign(Object.create(Math),{random:()=>0}),queueSave:()=>saves++,renderAll:()=>renders++});
  vm.runInContext(source.slice(source.indexOf('function autoFillIdentity('),source.indexOf('function highlightSkillGuidance(')),c);
  c.autoFillIdentity();assert.equal(character.identity.raceId,'human');assert.equal(character.identity.classId,'pilot');assert.equal(character.identity.playerName,'Real Player');
  assert.equal(character.identity.characterName,'Mara Solis');assert.notEqual(character.presentation.atbColor,'#ff678e');
  c.autoFillIdentity();assert.equal(character.identity.characterName,'Elias Okoro');assert.equal(saves,2);assert.equal(renders,2);
  character.identity.raceId='';c.autoFillIdentity();assert.equal(saves,2);
});
test('Finish Now animates the saved remaining batch before updating skills or finishing',async()=>{
 for(const raceId of ['human','pattanilia']){
  const skills={a:{tenths:20},b:{tenths:0},c:{tenths:10}},character={phase:'finalizing',identity:{raceId},creation:{finalizationQueue:['a','b','c']},pendingRoll:{skillKey:'a',resolvedResult:6}};
  let finishes=0,rolls=0,animation;
  const c=vm.createContext({character,resolveSkill:(_,key)=>({skill:skills[key]}),skillCreationLevel:s=>Math.floor(s.tenths/10),diceRoller:{stop(){},rollPool:async options=>{animation=options;}},Math:Object.assign(Object.create(Math),{random:()=>{rolls++;return .99;}}),document:{getElementById:()=>null},saveLibrary(){},renderWorkflow(){},notice:()=>assert.fail('unexpected error'),finishFinalization:()=>{finishes++;character.phase='finalized';assert.deepEqual([skills.a.tenths,skills.b.tenths,skills.c.tenths],[26,raceId==='pattanilia'?10:0,10]);}});
  vm.runInContext(source.slice(source.indexOf('async function rollFinalizationBatch('),source.indexOf('function startSkillAdvancement(')),c);
  vm.runInContext(source.slice(source.indexOf('function finishRemainingDecimals('),source.indexOf('function showDecimalSkip(')),c);
  c.finishRemainingDecimals();c.finishRemainingDecimals();assert.equal(finishes,0);assert.equal(rolls,2);assert.deepEqual([skills.a.tenths,skills.b.tenths,skills.c.tenths],[20,0,10]);assert.deepEqual(Array.from(animation.values),[6,10,10]);assert.equal(animation.presentation,'avalanche');
  animation.onResolved();assert.equal(finishes,0);animation.onSettled();animation.onSettled();assert.equal(finishes,1);assert.equal(character.creation.finalizationQueue.length,0);
 }
});

test('fanfare honors mute and schedules its musical resolution when enabled',()=>{
  const notes=[],c=vm.createContext({ensureCharacterAudio:()=>null,scheduleTone:(...a)=>notes.push(a),scheduleSweep:(...a)=>notes.push(a)});
  vm.runInContext(source.slice(source.indexOf('function playFinalizationFanfare('),source.indexOf('let identityRevealToken')),c);
  c.playFinalizationFanfare();assert.equal(notes.length,0);c.ensureCharacterAudio=()=>({});c.playFinalizationFanfare();assert.equal(notes.length,18);
});
