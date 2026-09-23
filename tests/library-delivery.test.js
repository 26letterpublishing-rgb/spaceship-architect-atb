const test=require('node:test'),assert=require('node:assert/strict'),rooms=require('../ship-crew-rooms'),fixture=require('./helpers/crew-room-fixture.cjs');
const body={starshipId:'crew-ship',sicId:'library',requestId:'library-delivery-001',title:'Lost Colony',text:'A survey crew found an abandoned colony.\n\nThe Library now contains their final transmission.'};

test('GM Library delivery archives paragraphs and notifies only assigned PCs, once per receipt',()=>{
 const f=fixture();f.campaign.characters.push({...structuredClone(f.character),id:'offline'},{...structuredClone(f.character),id:'outsider'});f.ship.crewCharacterIds.push('offline','offline');
 const first=rooms.deliverLibrary(f.campaign,null,body);assert.equal(first.notified,2);
 const notes=rooms.roomData(f.ship,'library').notes;assert.equal(notes.length,1);assert.equal(notes[0].text,body.text);assert.equal(notes[0].author,'GM');
 assert.deepEqual(f.campaign.privateNotes.map(n=>n.characterId),['pc','offline']);assert.ok(f.campaign.privateNotes.every(n=>n.message.startsWith('Library has been updated:')&&!n.message.includes('final transmission')));
 const restored=JSON.parse(JSON.stringify(f.campaign));assert.equal(rooms.deliverLibrary(restored,null,body).duplicate,true);assert.equal(restored.privateNotes.length,2);
 assert.throws(()=>rooms.deliverLibrary(f.campaign,null,{...body,text:'Different'}),/receipt/);
});

test('only installed, online, undamaged Libraries on powered surviving ships are destinations',()=>{
 for(const change of [f=>f.ship.ship.placements=f.ship.ship.placements.filter(p=>p.sicId!=='library'),f=>f.ship.ship.sicInventory.find(i=>i.id==='library').impaired=true,f=>f.ship.ship.sicInventory.find(i=>i.id==='library').disabled=true,f=>f.ship.ship.sicInventory.find(i=>i.id==='engine').disabled=true,f=>f.ship.destroyed=true]){
  const f=fixture();assert.equal(rooms.libraryTargets(f.campaign,null).length,1);change(f);assert.deepEqual(rooms.libraryTargets(f.campaign,null),[]);assert.throws(()=>rooms.deliverLibrary(f.campaign,null,body),/Library/);assert.equal(f.campaign.privateNotes.length,0);
 }
});

test('live Library damage wins over stale campaign data and deliveries use the live archive',()=>{
 const f=fixture(),live=structuredClone(f.room);live.starships[0].ship.sicInventory.find(i=>i.id==='library').impairmentPoints=1;
 assert.deepEqual(rooms.libraryTargets(f.campaign,live),[]);assert.throws(()=>rooms.deliverLibrary(f.campaign,live,body),/Library/);
 live.starships[0].ship.sicInventory.find(i=>i.id==='library').impairmentPoints=0;rooms.deliverLibrary(f.campaign,live,body);
 assert.equal(rooms.roomData(live.starships[0],'library').notes.length,1);assert.equal(rooms.roomData(f.ship,'library').notes.length,0);
});

test('invalid or overfull deliveries preserve the archive and do not notify anyone',()=>{
 for(const invalid of [{title:' '},{text:' '},{text:'x'.repeat(4001)},{title:'x'.repeat(101)},{sicId:'vr'}]){const f=fixture();assert.throws(()=>rooms.deliverLibrary(f.campaign,null,{...body,...invalid}));assert.equal(rooms.roomData(f.ship,'library').notes.length,0);assert.equal(f.campaign.privateNotes.length,0);}
 const f=fixture();rooms.roomData(f.ship,'library').notes=Array.from({length:100},(_,i)=>({id:String(i)}));assert.throws(()=>rooms.deliverLibrary(f.campaign,null,body),/100 entries/);assert.equal(f.campaign.privateNotes.length,0);
});

test('GM archives are readable at the Library station and PCs cannot delete GM entries',()=>{
 const f=fixture();rooms.deliverLibrary(f.campaign,null,body);assert.throws(()=>rooms.inspect(f.room,f.campaign,f.unit,'library',false),/station/);f.seat('library');
 const note=rooms.inspect(f.room,f.campaign,f.unit,'library',false).details.notes[0];assert.equal(note.title,body.title);
 assert.throws(()=>rooms.command(f.room,f.unit,{starshipId:f.ship.id,sicId:'library',requestId:'remove-gm-library',kind:'remove',noteId:note.id},{campaign:f.campaign,outsideCombat:true}),/author or GM/);
});
