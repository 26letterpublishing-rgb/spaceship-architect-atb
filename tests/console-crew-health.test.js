const test=require('node:test'),assert=require('node:assert/strict'),health=require('../health-display');
const unit=(id,hp=10,max=10)=>({id,characterName:id,currentHp:hp,maximumHp:max,location:{starshipId:'home',square:1}});
test('Brig assigned-only mode excludes noncrew and other ships without changing default occupants',()=>{
 const campaign={starships:[{id:'home',crewCharacterIds:['pc'],crewNpcUnitIds:['npc'],interiorOccupants:[{...unit('prisoner'),name:'Prisoner'}]},{id:'other',crewCharacterIds:['foreign']}]};
 const people=[{...unit('live-pc'),characterId:'pc'},unit('npc'),unit('passenger'),unit('foreign'),{...unit('absent'),location:{starshipId:'other',square:1}}];
 const before=JSON.stringify({campaign,people}),html=health.crewHealth(people,'home',campaign,{assignedCrewOnly:true});
 for(const id of ['live-pc','npc'])assert(html.includes('data-crew-health="'+id+'"'));
 for(const id of ['passenger','prisoner','foreign','absent'])assert(!html.includes('data-crew-health="'+id+'"'));
 assert.match(health.crewHealth(people,'home',campaign),/data-crew-health="passenger"/);
 assert.match(health.crewHealth(people,'home',campaign),/data-crew-health="prisoner"/);
 assert.equal(JSON.stringify({campaign,people}),before);
 assert.match(health.crewHealth(people,'home',undefined,{assignedCrewOnly:true}),/No visible crew/);
});
test('Brig membership retains live departures, unknown health and saved assigned PC/NPC records',()=>{
 const campaign={starships:[{id:'home',crewCharacterIds:['pc'],crewNpcUnitIds:['npc'],characterLocations:{pc:{square:1}}}],characters:[{id:'pc',character:{identity:{characterName:'Saved PC'}}}],npcRoster:[unit('npc')]};
 const opts={assignedCrewOnly:true};
 assert.match(health.crewHealth([],'home',campaign,opts),/Saved PC/);
 assert.match(health.crewHealth([],'home',campaign,opts),/Health unknown/);
 const html=health.crewHealth([{...unit('live-pc'),characterId:'pc',location:{starshipId:'other',square:1}}],'home',campaign,opts);
 assert(!html.includes('Saved PC'));assert(!html.includes('data-crew-health="live-pc"'));assert.match(html,/data-crew-health="npc"/);
});
test('crew hearts use current onboard visible characters, not external actors or hardware',()=>{
 const html=health.crewHealth([unit('crew'),{...unit('other'),location:{starshipId:'other',square:1}},{...unit('outside'),location:{starshipId:'home'}},{...unit('ai'),shipAi:true},{...unit('droid'),securityDroid:{} }],'home');
 assert.match(html,/data-crew-health="crew"/);for(const id of ['other','outside','ai','droid'])assert(!html.includes('data-crew-health="'+id+'"'));
 assert.equal((html.match(/npc-heart full/g)||[]).length,3);
});
test('crew heart thresholds match combat hearts; missing health remains unknown and names escaped',()=>{
 assert.equal((health.crewHealth([unit('hurt',1,100)],'home').match(/npc-heart half/g)||[]).length,1);
 assert.equal((health.crewHealth([unit('dead',0)],'home').match(/npc-heart empty/g)||[]).length,3);
 assert.match(health.crewHealth([unit('unknown',null)],'home'),/Health unknown/);
 assert.match(health.crewHealth([unit('<img>')],'home'),/&lt;img&gt;/);
 assert.match(health.crewHealth([],'home'),/No visible crew/);
});
test('accessible heart labels expose only the same six-segment condition',()=>{
 for(const [hp,segments]of [[0,0],[1,1],[49,3],[100,6]])assert.match(health.crewHealth([unit('crew',hp,100)],'home'),new RegExp('aria-label="Crew health: '+segments+' of 6 heart segments"'));
 assert(!health.crewHealth([unit('crew',49,100)],'home').includes('49/100'));
});
test('saved crew fills only explicitly onboard filtered records; live identity and location win',()=>{
 const saved={id:'pc',character:{identity:{characterName:'Saved PC'},health:{current:100},computed:{maximumHp:100}}},ship={id:'home',crewCharacterIds:['pc','unknown','missing'],characterLocations:{pc:{square:2},unknown:{square:3},missing:{square:4}},crewNpcUnitIds:['saved-npc']};
 const campaign={starships:[ship],characters:[saved,{id:'unknown',character:{identity:{characterName:'Unknown'}}}],npcRoster:[unit('saved-npc',5,10)]};
 const before=JSON.stringify(campaign);let html=health.crewHealth([],'home',campaign);assert.match(html,/Saved PC/);assert.match(html,/Health unknown/);assert.match(html,/saved-npc/);assert(!html.includes('data-crew-health="missing"'));
 html=health.crewHealth([{...unit('live',1,100),characterId:'pc'}],'home',campaign);assert(!html.includes('Saved PC'));assert.match(html,/Crew health: 1 of 6/);
 html=health.crewHealth([{...unit('live'),characterId:'pc',location:{starshipId:'other',square:2}}],'home',campaign);assert(!html.includes('Saved PC'));
 assert.equal(JSON.stringify(campaign),before);
});
test('saved off-ship environments, hidden records, duplicate assignments and stale HP are not invented',()=>{
 for(const environment of ['surface','exterior','boarding','escape-pod']){const campaign={starships:[{id:'home',crewCharacterIds:['pc'],characterLocations:{pc:{square:2,environment}}}],characters:[{id:'pc',character:{identity:{characterName:'Absent'}}}]};assert(!health.crewHealth([],'home',campaign).includes('Absent'));}
 const campaign={starships:[{id:'home',crewCharacterIds:['pc','pc'],characterLocations:{pc:{square:2}}}],characters:[{id:'pc',character:{identity:{characterName:'Only once'}}}]};assert.equal((health.crewHealth([],'home',campaign).match(/data-crew-health="pc"/g)||[]).length,1);
 assert(!health.crewHealth([],'home',{starships:[],characters:campaign.characters}).includes('Only once'));
});
test('player-visible interior occupants render without inventing a withheld maximum',()=>{
 const campaign={starships:[{id:'home',interiorOccupants:[{id:'seen',name:'Visible NPC',currentHp:10,location:{starshipId:'home',square:1}}]}]};
 const html=health.crewHealth([],'home',campaign);assert.match(html,/Visible NPC/);assert.match(html,/Health unknown/);assert(!html.includes('npc-heart full'));
 assert(!health.crewHealth([{...unit('seen'),location:{starshipId:'away',square:1}}],'home',campaign).includes('Visible NPC'));
});
test('Life Support and Nutrition use assigned-only routing while other room rosters keep their defaults',()=>{
 const fs=require('fs'),source=fs.readFileSync(require.resolve('../console-common.js'),'utf8');
 assert.match(source,/assignedCrewOnly:\['brig','life-support','nutrition'\]\.includes\(access\?\.definition\?\.utility\)/);
 const campaign={starships:[{id:'home',crewCharacterIds:['pc'],crewNpcUnitIds:['unknown','departed'],interiorOccupants:[unit('passenger')]}]};
 const people=[{...unit('live'),characterId:'pc'},unit('unknown',null,null),{...unit('departed'),location:{starshipId:'other',square:2}}];
 const before=JSON.stringify({campaign,people}),html=health.crewHealth(people,'home',campaign,{assignedCrewOnly:true});
 assert.match(html,/data-crew-health="live"/);assert.match(html,/data-crew-health="unknown"/);assert.match(html,/Health unknown/);
 assert(!html.includes('data-crew-health="departed"'));assert(!html.includes('data-crew-health="passenger"'));
 assert.equal(JSON.stringify({campaign,people}),before);
});
