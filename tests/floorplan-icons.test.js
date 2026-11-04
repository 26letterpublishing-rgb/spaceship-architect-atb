const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),art=require('../token-art');

test('removed occupants and AI clear from every retained grid even outside the original document',()=>{
 const source=fs.readFileSync(require.resolve('../starship.js'),'utf8'),start=source.indexOf('function drawDetailsCrew(){'),end=source.indexOf("window.addEventListener('message',event=>{",start);
 const grids=[0,1].map(()=>{const markers=[{dataset:{crewId:'gone'},kind:'crew'},{dataset:{aiUnitId:'gone-ai'},kind:'ai'}];for(const m of markers)m.remove=()=>markers.splice(markers.indexOf(m),1);return {markers,closest:()=>({classList:{toggle(){}},style:{removeProperty(){}}}),querySelectorAll:s=>s==='.ship-detail-crew[data-crew-id]'?markers.filter(m=>m.kind==='crew'):s==='.ship-detail-ai'?markers.filter(m=>m.kind==='ai'):[]};});
 const context={URLSearchParams,location:{search:'?embeddedRecord=1'},pageParameters:new URLSearchParams(),draft:{id:'ship'},linkedCampaignState:{starships:[{id:'ship',ship:{},characterLocations:{},aiStations:[]}]},shipGrids:grids,window:{SACrewTokens:{decorate(){}}},document:{querySelectorAll:()=>[]}};vm.createContext(context);vm.runInContext(source.slice(start,end)+';drawDetailsCrew();drawDetailsCrew();',context);
 for(const grid of grids)assert.equal(grid.markers.length,0);
});

test('visible campaign interior occupants retain NPC artwork classification without exposing enemy interiors to PCs',async()=>{
 const {CampaignApi}=require('../campaign-api'),api=new CampaignApi({store:{get:async()=>null}});let credentials;
 await api.handle({method:'POST'},{},new URL('http://test/api/campaign/showcase/start'),async()=>({}),(_,status,payload)=>{assert.equal(status,200);credentials=payload});
 const c=api.showcases.get(credentials.code).campaign,gm=api.state(c,credentials.gmToken),enemy=gm.starships.find(s=>s.controlType==='gm');
 assert.ok(enemy.interiorOccupants.length);for(const occupant of enemy.interiorOccupants){assert.equal(occupant.team,'npc');assert.equal(art.character(occupant).race,occupant.iconRace);}
 const pc=api.state(c,credentials.players[0].token);assert.ok(!pc.starships.some(s=>s.id===enemy.id));
});

test('active Character Starships projection preserves NPC identity and appearance without changing positions',()=>{
 const source=fs.readFileSync(require.resolve('../character.js'),'utf8'),body=source.slice(source.indexOf('function livePlayerShipRecord('),source.indexOf('let playerShipEditingId='));
 const unit={id:'npc-test',team:'npc',characterName:'Kettle',iconRace:'npc-flying-robot-head',iconVariant:0,currentHp:4,location:{starshipId:'enemy',square:321,mesh:4}};
 const record={id:'enemy',ship:{gridCells:[321]},characterLocations:{},crewCharacterIds:[]},before=JSON.stringify({unit,record});
 const context={campaignState:{combatActive:true,starships:[]},playerEncounterView:{units:[unit]},dom:{},record};vm.createContext(context);vm.runInContext(body+';result=livePlayerShipRecord(record)',context);
 const occupant=context.result.interiorOccupants[0];assert.equal(art.character(occupant).race,unit.iconRace);assert.equal(occupant.name,'Kettle');assert.deepEqual(context.result.characterLocations[unit.id],unit.location);assert.equal(JSON.stringify({unit,record}),before);
});

test('every shared floorplan character selector uses canonical artwork and approved missing-appearance fallback',()=>{
 const selectors=['combat-token','player-ship-token','ship-detail-crew','player-ship-station occupied','combat-station-marker occupied'];
 for(const classes of selectors)for(const race of ['npc-space-slug','kabuto','unknown','']){
  let figure=false,html='',frames=[];const set=new Set(classes.split(' '));
  const token={dataset:{tokenRace:race,tokenVariant:'1'},title:'Visible character',textContent:'X',style:{left:'0',top:'0'},matches:()=>false,
   classList:{contains:n=>set.has(n),add:n=>set.add(n),toggle(n,on){on?set.add(n):set.delete(n)}},querySelector:()=>figure?{remove(){figure=false}}:null,setAttribute(k,v){this[k]=v},set innerHTML(value){html=value;figure=value.includes('crew-figure')}};
  const window={SATokenArt:art,addEventListener(){}},document={body:{},querySelectorAll:s=>s==='.sa-room-oxygen'?[]:[token]};
  vm.runInNewContext(fs.readFileSync(require.resolve('../crew-tokens.js'),'utf8'),{window,document,MutationObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>frames.push(fn)});
  const expected=art.atlas(race)?race:'human';assert.ok(html.includes(art.atlas(expected)),classes+' '+race);assert.ok(!html.includes('crew-body'));assert.equal(token['aria-label'],'Visible character');
  token.dataset.fallen='true';window.SACrewTokens.decorate();assert.ok(html.includes(art.atlas(expected)));assert.ok(set.has('crew-is-fallen'));assert.equal(frames.length,0);
 }
});
