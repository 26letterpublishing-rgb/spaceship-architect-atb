const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../combat-actions'),'utf8').replace(/\r\n/g,'\n');
function fixture(action=async()=>{}){
 const submit={disabled:false},unit={id:'pc',turnSerial:1},state={activeId:'pc',roomCode:'R',stateEpoch:3};
 const c={currentUnit:unit,currentState:state,pendingKind:'charge',pendingTurn:{id:'pc',serial:1,room:'R',epoch:3},actionSubmitting:false,error:{textContent:''},actionButtons:[],form:{querySelector:()=>submit,querySelectorAll:()=>[submit]},action,window:{alert(){}},refreshFormAvailability(){},renderControls(){c.refreshSubmitAvailability();}};
 const start=source.indexOf('  function matchesTurn('),end=source.indexOf('\n  actionButtons.forEach((button) => {\n    button.addEventListener',start);
 assert.ok(start>=0&&end>start);vm.runInNewContext(source.slice(start,end),c);return {c,submit};
}
test('new legal turn recomputes Confirm after old successful turn cleanup disabled it',async()=>{
 const {c,submit}=fixture(async()=>{c.currentState.activeId=null;});assert.equal(await c.send('charge',{},c.pendingTurn),true);assert.equal(submit.disabled,true);
 c.pendingKind='';c.pendingTurn=null;c.refreshSubmitAvailability();assert.equal(submit.disabled,true);
 c.currentState.activeId='pc';c.currentUnit.turnSerial=2;c.pendingKind='charge';c.pendingTurn={id:'pc',serial:2,room:'R',epoch:3};c.refreshSubmitAvailability();assert.equal(submit.disabled,false);
});
test('actor, serial, room, epoch and absent action independently block submission',async()=>{
 for(const mutate of [c=>c.currentState.activeId='other',c=>c.currentUnit={id:'other',turnSerial:1},c=>c.currentUnit.turnSerial++,c=>c.currentState.roomCode='S',c=>c.currentState.stateEpoch++,c=>c.pendingTurn=null]){let calls=0;const {c,submit}=fixture(async()=>calls++);mutate(c);c.refreshSubmitAvailability();assert.equal(submit.disabled,true);if(c.pendingTurn)assert.equal(await c.send('charge',{},c.pendingTurn),false);assert.equal(calls,0);}
 const {c,submit}=fixture();c.pendingKind='';c.refreshSubmitAvailability();assert.equal(submit.disabled,true);
});
test('in-flight duplicate is blocked, rejected request restores eligible retry without stale override',async()=>{
 let reject,calls=0;const {c,submit}=fixture(()=>{calls++;return new Promise((_,r)=>reject=r);});const first=c.send('charge',{},c.pendingTurn);assert.equal(submit.disabled,true);assert.equal(await c.send('charge',{},c.pendingTurn),false);assert.equal(calls,1);reject(Error('Rejected for test'));assert.equal(await first,false);assert.equal(submit.disabled,false);assert.match(c.error.textContent,/Rejected/);
});
test('late rejection cannot re-enable a stale turn',async()=>{
 let reject;const {c,submit}=fixture(()=>new Promise((_,r)=>reject=r));const request=c.send('charge',{},c.pendingTurn);c.currentState.stateEpoch++;reject(Error('Rejected'));await request;assert.equal(submit.disabled,true);assert.equal(c.actionSubmitting,false);
});
test('open, close and authoritative render all invoke the same current eligibility calculation',()=>{
 for(const [a,b]of [['function closeDialog()','window.addEventListener(\'sa-combat-reset\''],['function openDialog(kind)','function matchesTurn('],['function renderControls(','const current = held(mine);']]){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(end>start);assert.match(source.slice(start,end),/refreshSubmitAvailability\(\)/);}
 assert.match(source,/control\.disabled=Boolean\(control\.closest\('\[hidden\]'\)\)/,'native invalid hidden inputs remain excluded');
 assert.match(source,/if \(!matchesTurn\(pendingTurn\)\)/,'submit retains stale-turn guard');
});