const maps=require('../../ship-map-core');
module.exports=function(){
  const specs=[['bridge','bridge-2',22],['engine','en-engine-4',182],['life','life-support',102],['vr','vr-training-room',27],['med','medbay',147],['library','library',212],['meeting','meeting-room',152],['ai','ship-ai',22]];
  const ship={id:'crew-ship',title:'Wayfinder',controlType:'pc',crewCharacterIds:['pc'],crewNpcUnitIds:[],characterLocations:{},currentHullHp:200,maximumHullHp:200,ship:{id:'crew-ship',title:'Wayfinder',confirmedOnce:true,groupCredits:999999,gridCells:maps.rectangleCells({},21,15,14),sicInventory:specs.map(([id,type])=>({id,type,status:'installed'})),placements:specs.map(([sicId,type,cell])=>({sicId,cell})),minerals:{Umbrexium:3},doorStates:{}}};
  const character={id:'pc',pcCode:'1234',approved:true,character:{identity:{characterName:'Tester',raceId:'human'},attributes:{health:[1,1],dexterity:[1,1],intellect:[1,1]},skills:{Engineering:{tenths:10},'Weapon Systems':{tenths:19},'Athletics':{tenths:10}},health:{current:10},computed:{maximumHp:30,moveSpeed:4,skills:{Engineering:1,'Weapon Systems':1.9,'Athletics':1}},resources:{creditsBase:1000}}};
  const unit={id:'unit-pc',characterId:'pc',characterName:'Tester',team:'pc',currentHp:10,maximumHp:30,atb:100,speed:5,engineeringSkill:1,location:null};
  const campaign={code:'CREW',name:'Crew Rooms',elapsedMinutes:0,starships:[ship],characters:[character],npcRoster:[],privateNotes:[]};
  const room={starships:[ship],units:[unit],threshold:100,activeId:unit.id,log:[],hasEngagedClock:true,running:true};
  function seat(id){const item=ship.ship.sicInventory.find(i=>i.id===id),p=ship.ship.placements.find(p=>p.sicId===id),s=maps.componentDefinition(item).stations[0];unit.location={starshipId:ship.id,sicId:id,square:p.cell+s.y*20+s.x,mesh:s.mesh,stationed:true};ship.characterLocations.pc={...unit.location};}
  seat('med');return {ship,character,unit,campaign,room,seat};
};
