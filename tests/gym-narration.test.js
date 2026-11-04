const test=require('node:test'),assert=require('node:assert/strict');
const rooms=require('../ship-crew-rooms'),fixture=require('./helpers/crew-room-fixture.cjs');
function gym(){const f=fixture();f.ship.ship.sicInventory.find(i=>i.id==='vr').type='gym';f.seat('vr');return f;}
const body={starshipId:'crew-ship',sicId:'vr',kind:'exercise',text:'Strength circuit',requestId:'gym-completed-001'};
test('eight Gym narrations appear only after accepted workouts and leave stats unchanged',()=>{
 assert.equal(rooms.GYM_NARRATIONS.length,8);assert.equal(new Set(rooms.GYM_NARRATIONS).size,8);
 const f=gym(),before=JSON.stringify(f.character);assert.equal(rooms.inspect(f.room,f.campaign,f.unit,'vr',false).details.report,undefined);
 const result=rooms.command(f.room,f.unit,body,{campaign:f.campaign,outsideCombat:true});const report=rooms.roomData(f.ship,'vr').report;
 assert(rooms.GYM_NARRATIONS.some(s=>s.replaceAll('{character}',f.unit.characterName)===report.narration));assert.match(result.text,/completed strength circuit/);assert(result.text.includes(report.narration));assert.match(result.text,/No automatic skill or attribute award/);assert.equal(JSON.stringify(f.character),before);
 const saved=JSON.stringify(report);for(let i=0;i<3;i++)rooms.inspect(f.room,f.campaign,f.unit,'vr',false);assert.equal(JSON.stringify(rooms.roomData(f.ship,'vr').report),saved);
 assert.equal(rooms.command(f.room,f.unit,body,{campaign:f.campaign,outsideCombat:true}).duplicate,true);assert.equal(JSON.stringify(rooms.roomData(f.ship,'vr').report),saved);
 const room=JSON.parse(JSON.stringify(f.room)),campaign=JSON.parse(JSON.stringify(f.campaign));assert.equal(rooms.command(room,room.units[0],body,{campaign,outsideCombat:true}).text,result.text);assert.equal(JSON.stringify(rooms.roomData(room.starships[0],'vr').report),saved);
});
test('rejected, impaired and combat workouts do not create narration; changed receipts stay rejected',()=>{
 for(const mode of ['combat','impaired','wrong-kind','wrong-station']){const f=gym();if(mode==='impaired')f.ship.ship.sicInventory.find(i=>i.id==='vr').impairmentPoints=1;if(mode==='wrong-station')f.seat('med');assert.throws(()=>rooms.command(f.room,f.unit,{...body,...(mode==='wrong-kind'?{kind:'simulate'}:{})},{campaign:f.campaign,outsideCombat:mode!=='combat'}));assert.equal(rooms.roomData(f.ship,'vr').report,undefined);}
 const f=gym();rooms.command(f.room,f.unit,body,{campaign:f.campaign,outsideCombat:true});const before=JSON.stringify(rooms.roomData(f.ship,'vr').report);assert.throws(()=>rooms.command(f.room,f.unit,{...body,text:'Stretching'},{campaign:f.campaign,outsideCombat:true}),/receipt/);assert.equal(JSON.stringify(rooms.roomData(f.ship,'vr').report),before);
});
