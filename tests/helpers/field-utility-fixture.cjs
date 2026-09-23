const maps=require('../../ship-map-core'),power=require('../../ship-power');
module.exports=function(){
  const base=require('./crew-room-fixture.cjs')(),ship=base.ship;
  const specs=[['bridge','cockpit-1',81],['engine','en-engine-4',261],['tractor','tractor-beam',24],['arm','manipulation-arm',26],['bay','docking-bay',89],['pod','escape-pods',131],['reflector','ripple-reflector',93],['sensor','sensors-3',151],['gun','ripple-cannon-4',48],['au','au-engine-2',82]];
  ship.ship.gridCells=maps.rectangleCells({},81,14,14);ship.ship.sicInventory=specs.map(([id,type])=>({id,type,status:'installed'}));ship.ship.placements=specs.map(([sicId,type,cell])=>({sicId,cell}));
  const target={id:'target',title:'Red Horizon',controlType:'npc',crewCharacterIds:[],crewNpcUnitIds:['npc'],characterLocations:{},currentHullHp:100,maximumHullHp:100,ship:{id:'target',title:'Red Horizon',confirmedOnce:true,gridCells:maps.rectangleCells({},42,5,5),sicInventory:[],placements:[],doorStates:{}}};
  base.room.starships.push(target);base.room.shipPositions=[{id:ship.id,q:0,r:0},{id:target.id,q:1,r:0}];base.room.units.push({id:'npc',team:'npc',characterName:'Guest',currentHp:20,atb:0,speed:2,location:{starshipId:target.id,square:42,mesh:4}});base.campaign.starships=base.room.starships;base.campaign.npcRoster=[structuredClone(base.room.units[1])];
  base.seat('bridge');base.unit.weaponSystemsSkill=6;base.unit.dexterityDice=[8,6];ship.sensorState={contacts:{target:{level:'detected',defenseScore:0}},reports:[]};power.refresh(base.room,{reset:true});return {...base,target};
};
