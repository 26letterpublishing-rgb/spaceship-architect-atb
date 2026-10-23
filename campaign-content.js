'use strict';
// Portable content uses the existing story, roster, shop, map and arena models.
// Loads operate on a draft at the API boundary and record their imported IDs.
const crypto=require('node:crypto'),types=require('./save-file-types'),terrain=require('./planet-terrain');
const copy=structuredClone,uid=()=>crypto.randomUUID(),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const state=c=>c.contentState||={loads:{},reminders:{}};
function freshArrivals(value){if(!value||typeof value!=='object')return value;if(Array.isArray(value.arrivalContent))for(const entry of value.arrivalContent)entry.id=uid();for(const [k,v]of Object.entries(value))if(k!=='arrivalContent'&&v&&typeof v==='object')freshArrivals(v);return value;}
function shipLocation(s,id){const p=s.localPositions?.[id]||s.positions?.[id];if(!p||p.starId)return p;const star=s.maps.find(m=>m.id===p.mapId)?.stars.find(x=>x.q===p.q&&x.r===p.r);return {...p,starId:star?.id};}
function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['legacyGrid','resizeBackup','access','campaignLink','runtimeSessions'].includes(k)).map(([k,v])=>[k,clean(v)]));return value;}
function validate(file){
 const kind=types.identify(file).id;if(file.moduleVariant){const v=require('./module-conditions').variant(file.moduleVariant);if(types.filename(v.baseFile,kind).type!==kind)throw Error('The default file must use the same save type.');}if(JSON.stringify(file).length>16*1024*1024)throw Error('Content files must be smaller than 16 MB.');
 if(kind==='story')require('./story-files').parse(file);
 if(kind==='shop')require('./campaign-shops').normalize(file.shop);
 if(kind==='arena')require('./arena-files').parse(file);
 if(kind==='galaxy')require('./campaign-navigation').normalizeFile(file);
 if(kind==='system')systemMap(file);
 if(kind==='planet'){if(file.planet?.kind!=='planet')throw Error('Choose a saved Planet.');require('./space-objects').normalize([file.planet]);require('./campaign-planets').normalizeWorld(file.world||{gridVersion:2,size:file.planet.size||'large'},file.planet.id,file.planet.size,file.planet.variant);}
 if(kind==='region'){if(!file.region||typeof file.region.name!=='string'||!file.region.hexes)throw Error('Choose a saved Region.');regionData(file.region);}
 if(kind==='roster'){if(!Array.isArray(file.characters)||!Array.isArray(file.npcs)||file.characters.length+file.npcs.length<1||file.characters.length+file.npcs.length>100)throw Error('A roster must contain 1–100 characters or NPCs.');if(file.npcs.some(n=>!String(n?.name||'').trim()))throw Error('An NPC has no name.');for(const c of file.characters)characterData(c);}
 if(kind==='character')characterData(file.character);
 if(kind==='ship'&&(!file.starship?.confirmedOnce||!Array.isArray(file.starship.gridCells)||!file.starship.gridCells.length))throw Error('Choose a confirmed Starship file.');
 return kind;
}
function characterData(source){const c=clean(source);if(!c?.identity?.characterName||!c.attributes)throw Error('Choose a character with a name and attributes.');return c;}
function systemMap(file){if(!file.star||!Array.isArray(file.star.system))throw Error('Choose a saved Star System.');return require('./campaign-navigation').normalizeFile({format:'sa2-galaxy',version:1,map:{name:'System import',lightYearsPerHex:3.31,stars:[{...file.star,q:0,r:0}]}}).stars[0];}
function regionData(raw){return require('./campaign-planets').normalizeWorld({gridVersion:2,size:'large',hexes:{},regions:{'0':raw}},'region-import').regions['0'];}
function find(items,id,name,label){let matches=items.filter(x=>id?x.id===id:name?String(x.name).toLowerCase()===String(name).toLowerCase():false);if(matches.length!==1)throw Error('Choose one destination '+label+'.');return matches[0];}
function destination(c,options={},kind){const s=require('./campaign-navigation').state(c),d=options.destination||{},t=options.target||{},map=find(s.maps,t.mapId,d.galaxy,'galaxy');if(kind==='galaxy')return {s,map};const star=find(map.stars,t.starId,d.star,'star');if(kind==='system')return {s,map,star};const planet=find((star.system||[]).filter(p=>p.kind==='planet'),t.planetId,d.planet,'planet');const world=require('./campaign-planets').surface(star,planet);return {s,map,star,planet,world,hex:String(t.hex??d.hex??'')};}
function locationReferences(s){return [s.party,s.startingSurface,s.navigation,s.surfaceReturnPolicy,...Object.values(s.localPositions||{}),...Object.values(s.characterWorldLocations||{}),s.partyJourney?.from,s.partyJourney?.to,...(s.travelRequests||[]).flatMap(r=>[r.from,r.to])].filter(Boolean);}
function matches(p,target){return p.mapId===target.mapId&&(!target.starId||p.starId===target.starId)&&(!target.planetId||p.planetId===target.planetId)&&(!target.regionId||p.regionId===target.regionId);}
function guardReplacement(c,target,options){
 const s=require('./campaign-navigation').state(c);if(options.combatActive)throw Error('End the encounter before replacing maps.');
 if(Object.values(s.journeys||{}).some(j=>matches(j,target))||Object.entries(s.localJourneys||{}).some(([id])=>matches(s.localPositions[id]||{},target))||[s.partyJourney?.from,s.partyJourney?.to].some(p=>p&&matches(p,target)))throw Error('Finish or cancel journeys through this location before changing it.');
 const occupied=[s.party,...(c.starships||[]).map(ship=>shipLocation(s,ship.id)),...Object.values(s.characterWorldLocations||{})].some(p=>p&&matches(p,target));
 if(occupied&&!options.relocate)throw Error('This location has travelers. Choose an arrival star and confirm their relocation before replacing it.');
 return occupied;
}
function relocate(c,oldTarget,map,star,options){
 const s=c.starmaps,ships=(c.starships||[]).filter(ship=>matches(shipLocation(s,ship.id)||{},oldTarget));
 const partyAffected=s.party&&matches(s.party,oldTarget),carrier=(c.starships||[]).find(x=>x.id===(options.carrierId||s.party?.shipId))||ships.find(x=>x.controlType==='pc');
 const loose=Object.values(s.characterWorldLocations||{}).some(p=>matches(p,oldTarget)&&p.environment==='surface');
 if(loose&&!partyAffected)throw Error('Move the remaining ashore characters aboard before replacing this location.');
 if((partyAffected||loose)&&(!carrier||carrier.controlType!=='pc'))throw Error('Choose a ship to carry the party from the replaced location.');
 if(partyAffected)require('./planet-travel').forceAboard(c,carrier,true);
 if(carrier&&(partyAffected||loose)&&!ships.includes(carrier))ships.push(carrier);
 for(const ship of ships){require('./campaign-navigation').cancel(c,ship);s.positions[ship.id]={mapId:map.id,q:star.q,r:star.r};s.localPositions[ship.id]={mapId:map.id,starId:star.id,phase:'system',q:0,r:4};}
 for(const [id,p]of Object.entries(s.characterWorldLocations||{}))if(matches(p,oldTarget)){if(p.environment==='surface')s.characterWorldLocations[id]={environment:'ship',starshipId:carrier.id};else {p.mapId=map.id;p.starId=star.id;for(const k of ['planetId','hex','surfaceHex','regionId','regionHex'])delete p[k];}}
 if(s.startingSurface&&matches(s.startingSurface,oldTarget))delete s.startingSurface;
 if(s.surfaceReturnPolicy&&matches(s.surfaceReturnPolicy,oldTarget))delete s.surfaceReturnPolicy;
 s.travelRequests=(s.travelRequests||[]).filter(r=>![r.from,r.to].some(p=>p&&matches(p,oldTarget)));
 if(matches(s.navigation||{},oldTarget)||partyAffected)s.navigation={...s.navigation,mode:'system',mapId:map.id,starId:star.id,planetId:'',regionId:'',allowed:{surface:true,orbit:true,system:true,galaxy:true}};
 delete s.shopArrival;
}
function saveRecovery(c,file,target){c.mapRecovery={savedAt:new Date().toISOString(),file:clean(file),target:copy(target)};}
function exportFile(c,kind,target={},options={}){
 if(kind==='galaxy'){const {map}=destination(c,{target},kind),result=clean(map);if(options.overview)for(const star of result.stars){delete star.system;delete star.surfaces;delete star.systemScars;star.planets=[];}return {format:'sa2-galaxy',version:1,map:result};}
 if(kind==='system'){const {star}=destination(c,{target},kind);const result=clean(star);result.system=require('./campaign-navigation').objects(star).map(clean);delete result.arrivalContent;return {format:'sa2-system',version:1,star:result};}
 if(kind==='planet'){const {planet,world}=destination(c,{target},kind);return {format:'sa2-planet',version:1,planet:clean(planet),world:clean(world)};}
 if(kind==='region'){const {world,hex}=destination(c,{target},kind),region=world.regions[hex||target.regionId];if(!region)throw Error('Choose a region to save.');return {format:'sa2-region',version:1,region:clean(region)};}
 if(kind==='roster'){const wanted=new Set(options.ids||[]),npcs=[...(c.npcTemplates||[]),...(c.npcRoster||[]).filter(n=>!(c.npcTemplates||[]).some(t=>t.id===n.templateId))].filter(n=>wanted.has(n.id)).map(n=>({...clean(n),name:n.characterName||n.name,heldWeaponId:(n.weapons||[]).find(w=>w.inventoryId===n.heldWeaponId)?.weaponId||n.heldWeaponId||'unarmed'}));if(!npcs.length)throw Error('Select at least one NPC.');return {format:'sa2roster',version:1,characters:[],npcs};}
 throw Error('Choose a supported export.');
}
function importStory(c,file,helpers,append=true){const files=require('./story-files'),imported=append?files.append(c,file,uid):files.parse(file),shops=require('./campaign-shops');for(const shop of imported.shops)shops.manage(c,{operation:'load',file:{format:'sa2shop',version:1,shop},script:true});c.scriptChapters=imported.chapters;c.script=imported.chapters[0].script;c.conditionalActions=helpers.normalizeCampaign({...c,conditionalActions:imported.actions}).conditionalActions;return {chapterId:imported.chapterId||imported.chapters[0].id};}
function importRoster(c,file,helpers){const pcs=file.format==='sa2roster'?file.characters:[file.character],npcs=file.format==='sa2roster'?file.npcs:[];if((c.npcTemplates||[]).length+npcs.length>100)throw Error('A campaign supports at most 100 NPC templates.');const records=pcs.map(source=>{const character=characterData(source),id=uid();character.id=id;return {id,pcCode:uid().slice(-12),approved:true,imported:true,createdAt:new Date().toISOString(),character};}),templates=npcs.map(n=>({...clean(n),id:uid()}));const normalized=helpers.normalizeCampaign({...c,characters:[...(c.characters||[]),...records],npcTemplates:[...(c.npcTemplates||[]),...templates],npcRoster:copy(c.npcRoster||[])});c.characters=normalized.characters;c.npcTemplates=normalized.npcTemplates;c.npcRoster=normalized.npcRoster;return {characterIds:records.map(r=>r.id),npcIds:templates.map(n=>n.id),added:records.length+templates.length};}
function importShip(c,source,helpers){const ship=clean(source.ship||source),id=uid();ship.id=id;ship.confirmedOnce=true;const record=helpers.normalizeStarshipRecord({id,title:source.title||ship.title,ship,controlType:source.controlType==='gm'?'gm':'pc',crewCharacterIds:[],crewNpcUnitIds:[],characterLocations:{}});const map=require('./ship-map-core'),error=map.exteriorError(ship)||require('./ship-power').constructionError(record)||map.ensureAirlocks(record.ship);if(error)throw Error(error);if(!record.ship.gridCells.length)throw Error('A saved ship has no hull.');record.accessKey=crypto.randomBytes(24).toString('base64url');c.starships.push(record);return record;}
function importArena(c,file,options,helpers){
 if(options.combatActive)throw Error('End the encounter before loading another arena.');const parsed=require('./arena-files').parse(file),pcMap=new Map(options.assignments||[]),selected=[...pcMap.values()].filter(Boolean);if(new Set(selected).size!==selected.length||selected.some(id=>!c.characters.some(r=>r.id===id)))throw Error('Assign each starting slot to a different current PC.');if(!options.starting&&!options.confirmPreparation&&c.preparationDraft)throw Error('Confirm replacing the current combat preparation.');
 const shipMap=new Map(parsed.ships.map(saved=>[saved.sourceId,importShip(c,saved,helpers).id])),npcMap=new Map(parsed.npcs.map(n=>[n.id,uid()])),key=id=>pcMap.get(id)||npcMap.get(id),arena=require('./combat-arena').normalize(parsed.arena||{});arena.spawns=Object.fromEntries(Object.entries(arena.spawns).map(([id,n])=>[key(id),n]).filter(([id])=>id));
 c.preparationDraft={version:1,savedAt:Date.now(),mode:parsed.mode,objects:parsed.objects,baseline:[],positions:parsed.positions.filter(p=>shipMap.has(p.id)).map(p=>({...p,id:shipMap.get(p.id)})),characters:selected,ships:[...shipMap.values()],npcs:parsed.npcs.map(n=>({...n,id:npcMap.get(n.id),rosterId:undefined,locationStarshipId:shipMap.get(n.locationStarshipId)||''})),locations:parsed.pcs.filter(p=>pcMap.get(p.sourceId)&&shipMap.get(p.shipId)).map(p=>[pcMap.get(p.sourceId),shipMap.get(p.shipId)]),arena,fog:{enabled:!!parsed.fog.enabled,forced:Object.fromEntries(Object.entries(parsed.fog.forced||{}).map(([id,v])=>[id==='surface'?id:shipMap.get(id),v]).filter(([id])=>id))},startingLocations:parsed.startingLocations.map(([id,loc])=>[key(id),{...loc,starshipId:shipMap.get(loc.starshipId)||''}]).filter(([id])=>id)};
 return {preparation:true,shipIds:[...shipMap.values()]};
}
function load(c,options,helpers){
 const file=options.file,kind=validate(file),fingerprint=hash(file),baseKey=String(options.key||fingerprint).slice(0,250),key=options.newCopy?baseKey+'/'+String(options.receipt||uid()):baseKey,loads=state(c).loads;
 const existing=(Object.hasOwn(loads,key)?loads[key]:null)||(!options.newCopy&&Object.values(loads).find(r=>r.fingerprint===fingerprint));
 if(existing){loads[key]={...existing,key};return {alreadyLoaded:true,...loads[key]};}
 let result={type:kind};
 if(kind==='story')Object.assign(result,importStory(c,file,helpers));
 if(kind==='roster'||kind==='character')Object.assign(result,importRoster(c,file,helpers));
 if(kind==='shop'){const shops=require('./campaign-shops'),shop={...copy(file.shop),id:uid(),active:false};shops.manage(c,{operation:'load',file:{...file,shop},script:!!options.scriptShop});if(options.openShop)shops.manage(c,{operation:'activate',shopId:shop.id,active:true});result.shopId=shop.id;}
 if(kind==='ship')result.shipIds=[importShip(c,file.starship,helpers).id];
 if(kind==='arena')Object.assign(result,importArena(c,file,options,helpers));
 if(kind==='galaxy'){
  const s=require('./campaign-navigation').state(c),incoming=freshArrivals(require('./campaign-navigation').normalizeFile(file));
  if(options.replace){const {map}=destination(c,options,'galaxy'),target={mapId:map.id};guardReplacement(c,target,options);if(!options.confirmReplace)throw Error('Confirm replacing '+map.name+' and its '+map.stars.length+' stars.');const arrival=find(incoming.stars,null,options.arrivalStar,'arrival star');saveRecovery(c,exportFile(c,'galaxy',target),target);relocate(c,target,incoming,arrival,options);s.maps[s.maps.indexOf(map)]=incoming;c.mapRecovery.target={mapId:incoming.id};}else{if(s.maps.length>=30)throw Error('Maximum 30 Galaxy Maps.');s.maps.push(incoming);}result.mapId=incoming.id;
 }
 if(kind==='system'){
  const {map,star}=destination(c,options,kind),incoming=freshArrivals(systemMap(file)),target={mapId:map.id,starId:star.id};guardReplacement(c,target,options);
  if((star.system||[]).some(o=>o.kind!=='sun')&&!options.confirmReplace)throw Error('Confirm replacing the planets and locations in '+star.name+'. Other stars are unchanged.');
  saveRecovery(c,exportFile(c,'system',target),target);if(options.relocate)relocate(c,target,map,star,options);
  const sun=incoming.system.find(o=>o.kind==='sun');if(sun){sun.id='object-star-'+star.id;sun.name=star.name;}star.system=incoming.system;star.surfaces=incoming.surfaces;delete star.systemScars;star.planets=star.system.filter(p=>p.kind==='planet').map(p=>({name:p.name,hidden:!!p.hidden}));result.target=target;
 }
 if(kind==='planet'){
  const {map,star,planet,world}=destination(c,options,kind),target={mapId:map.id,starId:star.id,planetId:planet.id};guardReplacement(c,target,options);if(!options.confirmReplace)throw Error('Confirm replacing '+planet.name+' and its surface.');saveRecovery(c,exportFile(c,'planet',target),target);if(options.relocate)relocate(c,target,map,star,options);
  const incoming=require('./space-objects').normalize([{...file.planet,id:planet.id,q:planet.q,r:planet.r}])[0];star.system[star.system.indexOf(planet)]=incoming;star.surfaces[planet.id]=require('./campaign-planets').normalizeWorld(freshArrivals(clean(file.world||{gridVersion:2,size:incoming.size})),planet.id,incoming.size,incoming.variant);result.target=target;
 }
 if(kind==='region'){
  const {map,star,planet,world,hex}=destination(c,options,kind);if(!terrain.validHex(hex,false,planet.size))throw Error('Choose a destination hex on this planet.');const target={mapId:map.id,starId:star.id,planetId:planet.id,regionId:hex};guardReplacement(c,target,options);if(world.regions[hex]&&!options.confirmReplace)throw Error('Confirm replacing this region.');if(world.regions[hex])saveRecovery(c,exportFile(c,'region',{...target,hex}),{...target,hex});if(options.relocate)relocate(c,target,map,star,options);world.regions[hex]=freshArrivals(regionData(file.region));result.target=target;
 }
 loads[key]={...result,key,fingerprint,fileName:String(options.fileName||'').slice(0,180),loadedAt:new Date().toISOString(),status:'loaded'};return loads[key];
}
function transfer(c,options){
 if(options.combatActive)throw Error('End the encounter before transferring the party.');const {s,map,star}=destination(c,options,'system'),ships=(c.starships||[]).filter(x=>(options.shipIds||[]).includes(x.id));if(!ships.length)throw Error('Select at least one traveling ship.');if(ships.some(ship=>s.journeys?.[ship.id]||s.localJourneys?.[ship.id])||s.partyJourney)throw Error('Finish or cancel travel first.');const carrier=ships.find(s=>s.id===options.carrierId)||ships.find(s=>s.controlType==='pc');if(s.party){if(!carrier)throw Error('Select a PC ship to carry the party.');require('./planet-travel').forceAboard(c,carrier,true);}for(const ship of ships){require('./campaign-navigation').cancel(c,ship);s.positions[ship.id]={mapId:map.id,q:star.q,r:star.r};s.localPositions[ship.id]={mapId:map.id,starId:star.id,phase:'system',q:0,r:4};require('./campaign-navigation').follow(c,ship);}s.navigation={...s.navigation,mode:'system',mapId:map.id,starId:star.id,planetId:'',regionId:'',allowed:{galaxy:true,system:true,orbit:true,surface:true}};
}
module.exports={validate,load,exportFile,destination,clean,hash,state,importStory,importRoster,importShip,transfer,guardReplacement,locationReferences,matches};
