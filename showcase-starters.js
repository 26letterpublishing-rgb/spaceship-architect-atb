// Approved Explore-only Lantern/Cinderwake designs. Existing saved ships are untouched.
const maps=require('./ship-map-core'),power=require('./ship-power');
module.exports=function(id,side,crew=[],npcs=[]){
 const pc=side==='pc',title=pc?'Lantern':'Cinderwake',columns=24,cell=(x,y)=>(y+5)*columns+x+5;
 const ship={id,title,zoneColumns:columns,zoneRows:22,confirmedOnce:true,thrusterDirection:270,gridCells:[],triangleCells:[],sicInventory:[],placements:[],doorStates:{},mapColor:pc?'#58caff':'#f4b49a',mapIcon:pc?1:2,groupCredits:999999,minerals:{},warpFuel:{F:1,D:1,C:2,B:1,A:0,S:0},missileAmmo:{},missileStorage:{}};
 ship.gridCells=maps.rectangleCells(ship,cell(0,0),12,8);
 const add=(type,x,y,extra={})=>{const item={id:id+'-'+type+'-'+ship.sicInventory.filter(i=>i.type===type).length,type,status:'installed',stationLayout:'corners-v1',...extra.item};ship.sicInventory.push(item);ship.placements.push({sicId:item.id,cell:cell(x,y),...extra.placement});};
 // The engine banks are separated; row 3 is a continuous unoccupied corridor.
 add('en-au-engine-4',0,4);add('en-au-engine-2',10,0);
 add('bridge-2',0,0);add('life-support',3,0);
 add('sensors-2',3,2);add('lock-on-3',4,2);add('shield-1',5,2);
 add(pc?'beam-laser-6':'ripple-cannon-2',6,0,{placement:{exteriorCell:cell(6,pc?-2:-1)}});
 add('warp-drive-1',8,0);add('repair-drone-1',11,6);
 add('exhaust-thruster-3',6,8);add('exhaust-thruster-3',9,8);
 add('decent-hover',-1,0,{placement:{mountCells:[[-1,0],[-1,7],[12,0],[12,7]].map(([x,y])=>cell(x,y))}});
 ship.airlocks=[{id:'airlock-main',square:cell(11,3),side:'right'}];
 const record={id,title,controlType:side,crewCharacterIds:[...crew],crewNpcUnitIds:[...npcs],characterLocations:{},ship};
 record.currentHullHp=record.maximumHullHp=maps.hullHp(ship);ship.currentHullHp=ship.maximumHullHp=record.maximumHullHp;
 const error=maps.ensureAirlocks(ship)||maps.exteriorError(ship)||power.constructionError(record);if(error)throw Error(title+': '+error);
 return record;
};
