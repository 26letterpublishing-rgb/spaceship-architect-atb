// Page 186–187-inspired capital layout retained as the oversized benchmark.
// Transporter and Devastation Laser have dedicated ships in the revised fleet.
const maps=require('./ship-map-core'),power=require('./ship-power');
module.exports=function(){
 const id='showcase-gm-menace',title='Menace — Large Hull, Cloaking, Gravity Field, Planetary Cleanser';
 const data={id,title,zoneColumns:40,zoneRows:36,confirmedOnce:true,gridCells:[],sicInventory:[],placements:[],doorStates:{},groupCredits:250000,minerals:{'Dark Phaeon':5},warpFuel:{F:8},mapColor:'#b685ea'};
 const cell=(x,y)=>y*40+x;data.gridCells=maps.rectangleCells(data,cell(8,8),18,18);
 data.gridCells.push(...maps.rectangleCells(data,cell(14,6),6,2),...maps.rectangleCells(data,cell(14,26),6,1),cell(13,6));
 const record={id,title,controlType:'gm',crewCharacterIds:[],crewNpcUnitIds:[],characterLocations:{},currentHullHp:data.gridCells.length,maximumHullHp:data.gridCells.length,ship:data};
 function add(type,x,y,extra={}){const n=data.sicInventory.filter(i=>i.type===type).length,item={id:id+'-'+type+'-'+n,type,status:'installed',...extra.item};data.sicInventory.push(item);data.placements.push({sicId:item.id,cell:cell(x,y),...extra.placement});return item;}
 add('en-engine-6',8,8);add('en-engine-6',20,8);add('en-engine-6',8,20);add('au-engine-6',20,20);
 add('bridge-8',14,6);add('shield-10',14,14);add('gravity-absolution-field',10,15);
 add('planetary-cleanser',15,24,{placement:{exteriorCell:cell(15,27),exteriorRotation:180}});
 for(const y of [8,13,18,23])add('ionic-pulse-thruster-5',26,y);
 for(const [type,y]of [['ripple-cannon-8',14],['beam-laser-8',18],['ion-pulse-cannon-5',19]])add(type,8,y,{item:{rotation:270,exteriorRotation:270},placement:{exteriorCell:cell(8-maps.definition(type).exteriorRows,y)}});
 for(const type of ['sensors-9','lock-on-10','life-support','nutritional-supplement','cpu-security-8','darkveil-10','cloaking-device','ew-ftl-drive']){
  const d=maps.definition(type),layout=maps.buildLayout(data),spot=data.gridCells.find(n=>{const cells=maps.rectangleCells(data,n,d.width,d.height);return cells.length===d.width*d.height&&cells.every(c=>data.gridCells.includes(c)&&!layout.footprint.get(c)?.sicId);});
  if(spot==null)throw Error('Menace has no space for '+type);add(type,spot%40,Math.floor(spot/40));
 }
 const error=maps.exteriorError(data)||power.constructionError(record);if(error)throw Error('Menace: '+error);
 return record;
};
