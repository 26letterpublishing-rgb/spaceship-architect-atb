const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../character.js'),'utf8');
const select=vm.runInNewContext('('+source.match(/function pendingCharacterForReview[\s\S]*?\n}/)[0]+')');
test('submission review requires GM authorization and an exact pending character request',()=>{
 const data={identity:{characterName:'Submitted'},phase:'finalizing'},state={role:'gm',imports:[{id:'a',kind:'character',status:'pending',data}]};
 assert.equal(select(state,'a'),data);
 for(const role of ['player','character','spectator',undefined])assert.throws(()=>select({...state,role},'a'),/GM authorization/);
 for(const patch of [{id:'b'},{kind:'ship'},{status:'approved'},{status:'rejected'}])assert.throws(()=>select({...state,imports:[{...state.imports[0],...patch}]},'a'),/no longer pending/);
 assert.equal(data.phase,'finalizing');
});
test('submission initialization reuses real sheet without local imports, saves, rolls or live editor',()=>{
 const body=source.match(/async function initializeSubmissionReview[\s\S]*?\n}/)[0];
 assert.match(body,/normalizeCharacter\(deepCopy\(submitted\)\)/);assert.match(body,/renderAll\(\)/);assert.match(body,/applyCampaignPermissions\(\)/);
 assert.match(body,/campaignEditable = false/);assert.match(body,/campaignCharacterId = ""/);
 assert.doesNotMatch(body,/saveLibrary|loadCampaign\(|showCampaignCharacter|connectCampaignState|rollPending|processFinalization|library\.push|import\/respond/);
 assert.match(source,/const CAMPAIGN_READ_ONLY_VIEW = .*\|\| SUBMISSION_REVIEW/);
 const room=fs.readFileSync(require.resolve('../room-v03.js'),'utf8');assert.match(room,/request.kind==='character'.*showReference\('character.html\?campaign='/);
});
