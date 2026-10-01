// Stable, unshielded combat laboratory. Do not bind timing/damage regressions
// to the changing Explore fleet's balance, concealment or automatic repairs.
const maps=require('../../ship-map-core');
function fleet(records){
  for(const r of records){
    const start=r.controlType==='pc'?146:148,id=r.id;
    const specs=[['engine-1','en-au-engine-4',61,{stationLayout:'corners-v1'}],['cockpit','bridge-1',3,{stationLayout:'corners-v1'}],['exhaust','exhaust-thruster-1',-20],['ionic','ionic-pulse-thruster-1',-16],['sensors','sensors-3',1],['laser','rapid-laser-5',-38],['lock','lock-on-10',85],['darkveil','darkveil-1',22],['beam','beam-laser-1',126,{rotation:90}],['ripple','ripple-cannon-1',66,{rotation:90}],['ion','ion-pulse-cannon-1',18,{rotation:270}],['missile-launcher','missile-launcher-1',80,{},79],['life','life-support',25],['nutrition','nutritional-supplement',6]];
    r.ship={...r.ship,zoneColumns:20,zoneRows:20,missileAmmo:{[id+'-missile-launcher']:{'missile-1':2,'missile-flares':1}},gridCells:maps.rectangleCells({},start,8,7),sicInventory:specs.map(([key,type,offset,extra])=>({id:`${id}-${key}`,type,status:'installed',...extra})),placements:specs.map(([key,type,offset,extra,ext])=>({sicId:`${id}-${key}`,cell:start+offset,...(ext==null?{}:{exteriorCell:start+ext})})),maximumHullHp:56,currentHullHp:56,maximumShieldHp:0,currentShieldHp:0};
    Object.assign(r,{maximumHullHp:56,currentHullHp:56,maximumShieldHp:0,currentShieldHp:0});
    delete r.ship.confirmed;
  }
}
module.exports=async function configureCombatDemo(base,room){
  const backup=await fetch(`${base}/api/campaign/backup?code=${room.code}&token=${room.gmToken}`).then(r=>r.json());
  backup.campaign.characters=backup.campaign.characters.filter(c=>c.id==='showcase-nova');backup.campaign.encounter.units=backup.campaign.encounter.units.filter(u=>u.id==='unit-showcase-nova'||u.id==='unit-showcase-npc-0');backup.campaign.npcRoster=(backup.campaign.npcRoster||[]).filter(u=>u.id==='unit-showcase-npc-0');
  fleet(backup.campaign.starships);fleet(backup.campaign.encounter.starships);
  for(const u of backup.campaign.encounter.units){const r=backup.campaign.encounter.starships.find(s=>s.id===u.location?.starshipId);if(r)u.location={starshipId:r.id,square:r.ship.gridCells[0],mesh:4,stationed:false};}
  const response=await fetch(base+'/api/campaign/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:room.code,token:room.gmToken,backup})});
  if(!response.ok)throw Error('Could not prepare combat fixture: '+await response.text());
};
