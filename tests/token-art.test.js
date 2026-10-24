const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const art=require('../token-art'),maps=require('../ship-map-core'),sensors=require('../ship-sensors'),engine=require('../combat-engine');
test('every playable race has exactly two safe selectable variants',async()=>{
 const {RACE_DEFS}=await import('../character-data.js');assert.deepEqual([...art.races].sort(),RACE_DEFS.map(r=>r.id).sort());
 for(const race of RACE_DEFS){assert.equal(art.options(race.id).length,2);assert.match(art.figure(race.id,1),/data-sprite-row="1"/);}
 assert.match(art.figure('draco-prime'),/width="493" height="512"/);assert.match(art.figure('epoc',1),/viewBox="0 246 256 254"/);
 assert.deepEqual(art.options(''),[]);assert.deepEqual(art.options('<img onerror=bad>'),[]);assert.equal(art.figure('unknown'), '');
 assert.deepEqual(art.character({character:{identity:{raceId:'human'},presentation:{iconVariant:1}}}),{race:'human',variant:1});
 assert.equal(art.attributes({raceId:'"><script>',iconVariant:'bad'}),'data-token-race="" data-token-variant="0"');
});
test('ship choice survives every scale without changing hull geometry',()=>{
 for(let icon=1;icon<=8;icon++)for(const hull of [4,25,100,225,400]){const s={ship:{mapIcon:icon,gridCells:Array.from({length:hull},(_,i)=>i)}};const rank=maps.scaleRank(s);assert.equal(maps.shipIcon(s),art.shipImage(s));assert.match(maps.shipIcon(s),new RegExp(`ship-token-${icon}-`));assert.equal(maps.scaleRank(s),rank);}
 assert.equal(art.shipImage({mapIcon:'../bad'}),'ship-token-1-v1.webp');assert.equal(maps.shipIcon({mapIcon:9}),'ship-token-1-v1.webp');
});
test('combat migration and synchronization preserve race artwork choice',()=>{
 const u={};engine.syncUnitCombat(u,{raceId:'human',iconVariant:1});assert.equal(u.iconVariant,1);engine.migrateUnitCombat(u);assert.equal(u.iconVariant,1);engine.syncUnitCombat(u,{raceId:'human',iconVariant:0});assert.equal(u.iconVariant,0);
});
test('detected contacts expose chosen design but uncertain vessel renderer conceals it',()=>{
 const f=require('./helpers/field-utility-fixture.cjs')();f.target.ship.mapIcon=7;sensors.detect(f.room,f.ship,f.target);const contact=sensors.view(f.room,f.ship.id).starships.find(s=>s.id===f.target.id);assert.equal(contact.mapIcon,7);
 const source=fs.readFileSync(require.resolve('../space-map'),'utf8');const context=vm.createContext({window:{SAShipMap:maps},String});vm.runInContext(source.slice(source.indexOf('  function vesselMarkup('),source.indexOf('  function missileMarkup(')),context);
 assert.match(context.vesselMarkup(contact),/ship-token-7/);
 for(const hidden of [{uncertainty:1},{contactLevel:'last-known'},{contactLevel:'unknown',uncertainty:0},{gmContactMarker:true}])assert.doesNotMatch(context.vesselMarkup({...contact,...hidden}),/ship-token/);
});
test('walking uses standing and two mirrored steps within the existing 840ms cycle',()=>{
 const css=fs.readFileSync(require.resolve('../token-art.css'),'utf8');assert.equal(art.walkCycleMs,840);assert.match(css,/spriteStand \.84s/);assert.match(css,/spriteLeft \.84s/);assert.match(css,/spriteRight \.84s/);assert.match(art.figure('human'),/translate\(32 0\) scale\(-1 1\)/);assert.match(css,/prefers-reduced-motion/);
});

test('Draco Prime appearance accepts humanoid races only without changing identity',()=>{
 for(const race of art.races){const c={identity:{raceId:'draco-prime'},presentation:{iconRace:race,iconVariant:1}};assert.equal(art.character(c).race,['spiddix','kabuto','skeder','xithx'].includes(race)?'draco-prime':race);assert.equal(c.identity.raceId,'draco-prime');}
 assert.equal(art.character({identity:{raceId:'human'},presentation:{iconRace:'android'}}).race,'human');
});

test('each subtype resolves its own existing atlas through the shared walk renderer',async()=>{const {RACE_DEFS}=await import('../character-data.js');for(const race of RACE_DEFS)for(const subtype of race.types||[]){const resolved=art.character({identity:{raceId:race.id,raceType:subtype.id}}).race;assert.equal(resolved,race.id+'-'+subtype.id);assert.ok(fs.existsSync(require('path').join(__dirname,'..',art.atlas(resolved))));assert.equal(art.options(resolved).length,2);assert.match(art.figure(resolved),/crew-sprite-step/);}});


test('all twenty-one NPC appearances have safe atlas files and preserve PC identity rules',()=>{assert.equal(art.npcIcons.length,21);const defaults=JSON.parse(fs.readFileSync(require.resolve('../data/npc-templates.json'),'utf8'));for(const id of art.npcIcons){assert.ok(fs.existsSync(require('path').join(__dirname,'..',art.atlas(id))));assert.deepEqual(art.character({team:'npc',iconRace:id}),{race:id,variant:0});assert.equal(art.options(id).length,1);assert.match(art.figure(id),/width="512" height="256"/);assert.equal(art.character({identity:{raceId:'draco-prime'},presentation:{iconRace:id}}).race,'draco-prime');}for(const row of defaults)assert.ok(art.npcIcons.includes(row.iconRace));});

test('map markers clip a single standing frame without nested SVG sizing',()=>{for(const id of [...art.npcIcons,...art.allRaces])for(const {value} of art.options(id)){const marker=art.marker(id,value,'sample');assert.match(marker,/clip-path="url\(#sample\)"/);assert.match(marker,/<image /);assert.doesNotMatch(marker,/<svg/);assert.match(marker,/width="32" height="32"/);}});
