const maps=require('./ship-map-core'),power=require('./ship-power');
module.exports=function(){
 const id='showcase-pc-cleanser',title='Last Word — Planetary Cleanser, Dark Phazon';
 const specs=[['bridge','bridge-1',141],['cleanser','planetary-cleanser',148,28],['life','life-support',155],['sensors','sensors-6',195],['engine','en-engine-6',241],['au','au-engine-6',253],['thruster','exhaust-thruster-5',361]];
 const ship={id,title,controlType:'pc',crewCharacterIds:[],crewNpcUnitIds:[],characterLocations:{},currentHullHp:198,maximumHullHp:198,ship:{id,title,class:'Planetary siege vessel',confirmedOnce:true,gridCells:maps.rectangleCells({},141,18,11),sicInventory:specs.map(([key,type])=>({id:id+'-'+key,type,status:'installed'})),placements:specs.map(([key,type,cell,exteriorCell])=>({sicId:id+'-'+key,cell,...(Number.isInteger(exteriorCell)?{exteriorCell}: {})})),doorStates:{},minerals:{'Dark Phaeon':3},groupCredits:25000,currentHullHp:198,maximumHullHp:198,mapColor:'#d99bff'}};
 const error=maps.exteriorError(ship.ship)||power.constructionError(ship);if(error)throw Error('Last Word: '+error);return ship;
};
