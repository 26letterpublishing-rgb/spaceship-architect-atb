// Stable, unshielded combat laboratory. Do not bind timing/damage regressions
// to the changing Explore fleet's balance, concealment or automatic repairs.
const maps=require('../../ship-map-core');
function fleet(records){
  for(const r of records){
    const start=r.controlType==='pc'?146:148,id=r.id;
    const specs=[['engine-1','en-au-engine-4',61,{stationLayout:'corners-v1'}],['cockpit','bridge-1',3,{stationLayout:'corners-v1'}],['exhaust','exhaust-thruster-1',-20],['ionic','ionic-pulse-thruster-1',-16],['sensors','sensors-3',1],['laser','rapid-laser-5',-38],['lock','lock-on-10',85],['darkveil','darkveil-1',22],['beam','beam-laser-1',126,{rotation:90}],['ripple','ripple-cannon-1',66,{rotation:90}],['ion','ion-pulse-cannon-1',18,{rotation:270}],['missile-launcher','missile-launcher-1',80,{},79],['life','life-support',25],['nutrition','nutritional-supplement',6]];
    r.ship={...r.ship,zoneColumns:20,zoneRows:20,triangleCells:[],missileAmmo:{[id+'-missile-launcher']:{'missile-1':2,'missile-flares':1}},gridCells:maps.rectangleCells({},start,8,7),sicInventory:specs.map(([key,type,offset,extra])=>({id:`${id}-${key}`,type,status:'installed',...extra})),placements:specs.map(([key,type,offset,extra,ext])=>({sicId:`${id}-${key}`,cell:start+offset,...(ext==null?{}:{exteriorCell:start+ext})})),maximumHullHp:56,currentHullHp:56,maximumShieldHp:0,currentShieldHp:0};
    Object.assign(r,{maximumHullHp:56,currentHullHp:56,maximumShieldHp:0,currentShieldHp:0});
    delete r.ship.confirmed;
  }
}
module.exports=async function configureCombatDemo(base,room){
  const backup=await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  const campaign=backup.campaign,pcId=room.players[0].id;
  const pc=campaign.encounter.units.find(u=>u.characterId===pcId),npc=campaign.encounter.units.find(u=>u.team==='npc'&&!u.allyNpc);
  if(!pc||!npc)throw Error('The combat laboratory requires one PC and one hostile NPC');
  campaign.characters=campaign.characters.filter(c=>c.id===pcId);campaign.encounter.units=[pc,npc];campaign.npcTemplates=[];
  // Explicit test actors preserve the established timing/dice laboratory. They
  // are not the public Explore PCs and do not change their saved definitions.
  const attributes={strength:[0,0,-1,-1],health:[1,0,-1,-1],perception:[3,2,1,-1],dexterity:[3,2,1,-1],luck:[0,0,-1,-1],charisma:[1,0,-1,-1],intellect:[4,3,1,-1],willpower:[1,0,-1,-1]};
  const skills={Initiative:4,Awareness:4,Projectile:2.4,Dodge:3.5,Melee:.8,'Weapon Mechanics':1.2,'Computer Systems':5,Engineering:5,Hacking:4,Piloting:6,'Sensor Systems':5.5,'Weapon Systems':6,Mathematics:4};
  const character=campaign.characters[0].character;
  Object.assign(character,{attributes,skills:Object.fromEntries(Object.entries(skills).map(([name,rating])=>[name,{tenths:Math.round(rating*10),creationDecimal:Math.round(rating*10)%10}])),computed:{speed:15,commandWindow:120,maximumHp:30,moveSpeed:3,damageReduction:0,skills},health:{current:30,permanentBonus:0}});character.creation.manualInput=true;character.resources.exertionCurrent=1;character.resources.exertionMax=1;
  Object.assign(pc,{speed:15,commandWindow:120,maximumHp:30,currentHp:30,moveSpeed:3,damageReduction:0,dexterityDice:[10,8,6],intellectDice:[12,10,6],strengthDice:[4,4],exertionCurrent:1,exertionMax:1});
  const slug={physicalAttribute:6,mentalAttribute:2,physicalSkill:1,mentalSkill:0,maximumHp:28,speed:3,moveSpeed:2,strengthDiceOverride:[4,4],iconRace:'npc-space-slug',iconVariant:0}; // Historical laboratory actor, independent of public samples.
 Object.assign(npc,{...slug,id:npc.id,characterName:'Laboratory Hostile',allyNpc:false,team:'npc',currentHp:slug.maximumHp,exertionCurrent:2,exertionMax:2,exertionDerivedMax:2,weapons:[{inventoryId:npc.id+'-unarmed',weaponId:'unarmed'}],heldWeaponId:npc.id+'-unarmed'});delete npc.templateId;
  campaign.npcRoster=[structuredClone(npc)];
  fleet(backup.campaign.starships);fleet(backup.campaign.encounter.starships);
  for(const records of [campaign.starships,campaign.encounter.starships])for(const ship of records){ship.crewCharacterIds=ship.controlType==='pc'?[pcId]:[];ship.crewNpcUnitIds=ship.controlType==='pc'?[]:[npc.id];ship.characterLocations={};}
  for(const u of backup.campaign.encounter.units){const r=backup.campaign.encounter.starships.find(s=>s.id===u.location?.starshipId);if(r)u.location={starshipId:r.id,square:r.ship.gridCells[0],mesh:4,stationed:false};}
  // This fixture deliberately starts aboard in space, independently of Explore's surface start.
  delete backup.campaign.starmaps.party;backup.campaign.starmaps.localPositions={};
  for(const u of backup.campaign.encounter.units){if(!u.characterId)continue;const r=backup.campaign.starships.find(s=>s.id===u.location?.starshipId);if(r)r.characterLocations[u.characterId]={...u.location};}
  const response=await fetch(base+'/api/campaign/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:room.code,token:room.gmToken,backup})});
  if(!response.ok)throw Error('Could not prepare combat fixture: '+await response.text());
};
