// Core rulebook pp. 162–163 (Protos) and p. 172 (White Dwarf).
// Rulebook edge-touching exterior mounts; shared power and placement validation.
const maps=require('./ship-map-core'),power=require('./ship-power');
module.exports=function(id,side,crew=[],npcs=[]){
 const pc=side==='pc',title=pc?'Protos':'White Dwarf',columns=24,cell=(x,y)=>(y+5)*columns+x+5;
 const ship={id,title,zoneColumns:columns,zoneRows:22,confirmedOnce:true,thrusterDirection:270,gridCells:[],triangleCells:[],sicInventory:[],placements:[],doorStates:{},mapColor:pc?'#58caff':'#f4b49a',mapIcon:pc?1:2,groupCredits:999999,minerals:{},warpFuel:{F:1,D:1,C:2,B:1,A:0,S:0},missileAmmo:{},missileStorage:{}};
 const rect=(x,y,w,h)=>ship.gridCells.push(...maps.rectangleCells(ship,cell(x,y),w,h));
 const add=(type,x,y,extra={})=>{const item={id:id+'-'+type+'-'+ship.sicInventory.filter(i=>i.type===type).length,type,status:'installed',stationLayout:'corners-v1',...extra.item};ship.sicInventory.push(item);ship.placements.push({sicId:item.id,cell:cell(x,y),...extra.placement});};
 if(pc){
  rect(0,0,4,4);rect(7,0,4,4);rect(4,1,3,2);
  add('en-au-engine-2',0,0);add('en-au-engine-4',7,0);add('bridge-2',0,2);
  add('beam-laser-6',2,0,{item:{rotation:90,exteriorRotation:90,weaponFacing:270},placement:{exteriorCell:cell(2,-1)}});
  add('warp-drive-1',2,1);add('darkveil-1',3,1);add('sensors-2',2,3);add('lock-on-3',3,3);
  add('shield-1',4,1);add('nutritional-supplement',4,2);add('life-support',5,1);
  add('antenna-2',2,4,{item:{rotation:90}});
  add('exhaust-thruster-3',11,-1);add('exhaust-thruster-3',11,3);
  add('decent-hover',1,-1,{placement:{mountCells:[[1,-1],[1,4],[9,-1],[9,4]].map(([x,y])=>cell(x,y))}});
 }else{
  rect(2,2,4,4);rect(0,3,2,2);rect(3,0,2,2);rect(6,3,2,2);rect(2,6,4,1);rect(3,7,2,1);

  ship.gridCells=ship.gridCells.filter(n=>n!==cell(2,6));ship.gridCells.push(cell(4,8));
  ship.triangleCells=[[2,1],[1,2],[1,5],[2,6]].map(([x,y])=>cell(x,y));
  add('en-au-engine-4',2,2);add('bridge-1',0,3);add('life-support',3,0);add('warp-drive-2',6,3);
  add('sensors-2',3,6);add('darkveil-1',4,6);
  add('ripple-cannon-2',3,7,{item:{rotation:90,exteriorRotation:90,weaponFacing:270},placement:{exteriorCell:cell(3,8)}});
  add('exhaust-thruster-3',6,1);add('exhaust-thruster-3',6,5);add('exhaust-thruster-2',8,3,{item:{rotation:90}});
  add('decent-hover',2,0,{placement:{mountCells:[[2,0],[5,0],[2,7],[5,7]].map(([x,y])=>cell(x,y))}});
 }
 const record={id,title,controlType:side,crewCharacterIds:[...crew],crewNpcUnitIds:[...npcs],characterLocations:{},ship};
 record.currentHullHp=record.maximumHullHp=maps.hullHp(ship);ship.currentHullHp=ship.maximumHullHp=record.maximumHullHp;
 maps.ensureAirlocks(ship);
 const error=maps.exteriorError(ship)||power.constructionError(record);if(error)throw Error(title+': '+error);
 return record;
};
