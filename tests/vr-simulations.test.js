const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const catalog=require('../skill-catalog'),vr=require('../vr-simulations'),rooms=require('../ship-crew-rooms'),fixture=require('./helpers/crew-room-fixture.cjs');
const command=(f,body)=>rooms.command(f.room,f.unit,{starshipId:f.ship.id,sicId:'vr',requestId:require('node:crypto').randomUUID(),...body},{campaign:f.campaign,outsideCombat:true});

test('shared skill catalog covers the character sheet and every skill has a distinct simulation',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../character-data.js'),'utf8');
 const data=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.deepEqual([...catalog.names].sort(),[...data.GENERAL_SKILLS,...data.SPACECRAFT_SKILLS].sort());
 assert.deepEqual(catalog.groups.map(g=>g.key),data.ATTRIBUTE_DEFS.map(g=>g.key));
 const titles=new Set();
 for(const skill of catalog.names){const s=vr.simulation(skill);assert.doesNotMatch(s.title,/Holodeck:|Practice Workshop$/);assert.ok(s.insight.length>20);assert.ok(catalog.groups.some(g=>g.key===catalog.attributes[skill]));titles.add(s.title);}
 assert.equal(titles.size,catalog.names.length);
});

test('VR includes unrecorded zero skills and retains custom skills without inventing attributes',()=>{
 const f=fixture();f.seat('vr');f.character.character.skills['Custom Skill']={tenths:5};
 const info=rooms.inspect(f.room,f.campaign,f.unit,'vr',false);
 const projectile=info.skills.find(s=>s.name==='Projectile');assert.equal(projectile.value,0);assert.equal(projectile.attribute,'dexterity');
 assert.equal(info.skills.find(s=>s.name==='Custom Skill').attribute,'other');assert.ok(info.attributes.some(a=>a.key==='other'));
 command(f,{kind:'train',skill:'Projectile',score:3});assert.equal(f.character.character.skills.Projectile.tenths,3);
 assert.throws(()=>command(f,{kind:'simulate',skill:'Invented Skill'}),/Choose a character skill/);
});

test('simulation status names the character and activity, persists, and spends no daily award',()=>{
 const f=fixture();f.seat('vr');command(f,{kind:'simulate',skill:'Projectile'});
 const report=rooms.roomData(f.ship,'vr').report.text;assert.match(report,/Tester enjoyed some time with target practice/);assert.match(report,/exhaling steadily/);
 assert.equal(f.character.character.vrTrainingDay,undefined);assert.equal(f.character.character.skills.Projectile,undefined);
 assert.equal(rooms.roomData(JSON.parse(JSON.stringify(f.ship)),'vr').report.text,report);
 command(f,{kind:'train',skill:'Melee',score:2});assert.equal(rooms.roomData(f.ship,'vr').simulation,'Tactical Range: Close-Quarters Sparring');
 assert.match(rooms.roomData(f.ship,'vr').report.text,/balanced footwork/);
 command(f,{kind:'simulate',skill:'Pilot/Helm',text:'Custom Docking Exercise',enabled:false});
 assert.match(rooms.roomData(f.ship,'vr').report.text,/Custom Docking Exercise/);assert.equal(rooms.roomData(f.ship,'vr').safety,false);
 assert.equal(f.character.character.vrTrainingDay,0);
});

test('legacy Holodeck titles upgrade while player-written simulation names are preserved',()=>{
 const f=fixture();f.seat('vr');Object.assign(rooms.roomData(f.ship,'vr'),{trainingSkill:'Projectile',simulation:'Holodeck: Projectile'});
 assert.equal(rooms.inspect(f.room,f.campaign,f.unit,'vr',false).details.simulation,'Tactical Range: Target Practice');
 assert.equal(vr.title('Projectile','My Custom Course'),'My Custom Course');
});
