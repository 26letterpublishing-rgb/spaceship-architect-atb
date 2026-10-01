// Vacuum and rescue use active encounter time only. Opening a door never rolls invisibly.
const {randomUUID,randomInt}=require('node:crypto');
const maps=require('./ship-map-core'),doors=require('./ship-doors'),hex=require('./ship-distances');
const directions={top:{q:0,r:-1},right:{q:1,r:0},bottom:{q:0,r:1},left:{q:-1,r:0}};
const data=ship=>ship.ship||ship;
function state(ship){return data(ship).breachState||=( {holes:{},processed:{}} );}
function hazards(ship){const s=data(ship);return [...Object.values(s.breachState?.holes||{}).filter(h=>!h.sealed),...(s.airlocks||[]).filter(a=>s.airlockStates?.[a.id]?.open).map(a=>({...a,...s.airlockStates[a.id],airlock:true}))];}
function skill(unit,campaign,name){const value=campaign?.characters?.find(c=>c.id===unit.characterId)?.character.skills?.[name];return value!==undefined?(typeof value==='object'?(Number(value.tenths)||0)/10:Number(value)||0):Number(name==='Engineering'?unit.engineeringSkill:unit.initiativeSkill??unit.physicalSkill)||0;}
function rollSpec(unit,campaign,name,difficulty){return {attributeKey:'dexterity',attributeLabel:'Dexterity',sides:unit.dexterityDice?.length?[...unit.dexterityDice]:require('./combat-engine').npcAttributeDice(unit.physicalAttribute),bonus:skill(unit,campaign,name),skill:name,difficulty,difficultyLabel:`Difficulty ${difficulty}`};}
function distance(ship,from,to){const l=maps.buildLayout(data(ship)),route=maps.meshRoute(l,{square:from,mesh:4},{square:to,mesh:4});if(route)return Math.max(0,Math.ceil((route.length-1)/3));return Math.abs(from%l.columns-to%l.columns)+Math.abs(Math.floor(from/l.columns)-Math.floor(to/l.columns));}
function reconcile(room,campaign,choose=randomInt){const messages=[];
  for(const ship of room.starships||[]){const s=data(ship);if(!(s.sicInventory||[]).some(i=>i.impairmentPoints>=4)&&!hazards(ship).length){if(s.breachState)s.breachState.processed={};continue;}const l=require('./ship-atmosphere').layout(ship),st=state(ship);
    for(const item of s.sicInventory||[]){if(!(item.impairmentPoints>=4)){delete st.processed[item.id];continue;}if(st.processed[item.id])continue;
      const cells=[...l.footprint].filter(([sq,c])=>c.sicId===item.id&&l.hull.has(sq)&&!c.exterior&&!c.blocked).map(([sq])=>sq);if(!cells.length)continue;
      st.processed[item.id]=true;const square=cells[choose(cells.length)],id=randomUUID();st.holes[id]={id,sicId:item.id,square,createdAt:Date.now(),attempts:0,checked:[]};messages.push(`${ship.title}: hull breach in ${maps.definition(item.type).name}!`);
    }
    for(const h of hazards(ship)){const source=h.airlock?s.airlockStates[h.id]:st.holes[h.id];source.checked||=[];const key=doors.roomKey(ship,h.square,l);
      for(const unit of room.units||[]){if(unit.shipAi||unit.vacuum||unit.currentHp<=0||unit.location?.starshipId!==ship.id||doors.roomKey(ship,unit.location.square,l)!==key||source.checked.includes(unit.id))continue;
        source.checked.push(unit.id);const difficulty=Math.max(0,16-distance(ship,unit.location.square,h.square));
        (unit.pendingShipRolls||=[]).push({id:randomUUID(),label:h.airlock?'Open airlock: resist suction':'Hull breach: resist suction',breachCheck:{shipId:ship.id,hazardId:h.id,square:h.square,side:h.side},rollSpec:rollSpec(unit,campaign,'Initiative',difficulty)});
      }
    }
  }return messages;
}
function outward(ship,square,side){if(directions[side])return directions[side];const s=data(ship),c=maps.gridColumns(s),cells=s.gridCells||[],x=square%c,y=Math.floor(square/c),cx=cells.reduce((n,k)=>n+k%c,0)/Math.max(1,cells.length),cy=cells.reduce((n,k)=>n+Math.floor(k/c),0)/Math.max(1,cells.length);return directions[Math.abs(x-cx)>Math.abs(y-cy)?x<cx?'left':'right':y<cy?'top':'bottom'];}
function report(ship,text,values=[],total){const r={at:new Date().toISOString(),text,values,total};ship.sensorState||={};(ship.sensorState.reports||=[]).unshift(r);return r;}
function resolveCheck(room,unit,request,total,values=[]){const check=request.breachCheck,ship=room.starships.find(s=>s.id===check.shipId),h=ship&&hazards(ship).find(h=>h.id===check.hazardId);unit.pendingShipRolls=(unit.pendingShipRolls||[]).filter(r=>r.id!==request.id);
  if(!h||unit.location?.starshipId!==ship.id||doors.roomKey(ship,unit.location.square)!==doors.roomKey(ship,h.square))return ship&&report(ship,'Suction check cancelled: the opening is sealed or the character left the room.',values,total);
  if(total>=request.rollSpec.difficulty)return report(ship,`${unit.characterName} resisted the suction.`,values,total);
  const point=hex.positions(room.starships,room.shipPositions).find(p=>p.id===ship.id),direction=outward(ship,h.square,h.side),center=hex.roundHex(point);
  unit.vacuum={id:`body-${unit.id}`,sourceShipId:ship.id,position:{q:center.q+direction.q,r:center.r+direction.r},direction,damageRemaining:2,driftRemaining:12,ejectedAt:Date.now(),from:{...unit.location},holeSquare:h.square};
  unit.location=null;unit.timedAction=null;unit.delayedAction=null;unit.delayTimer=null;unit.consoleHold=null;unit.pendingShipRolls=[];unit.atb=0;
  return report(ship,`${unit.characterName} has been sucked into the vacuum of space! 1 damage every 2 active seconds; drifting 1 hex every 12 active seconds.`,values,total);
}
function canRemote(ship,unit){if(unit?.location?.starshipId!==ship.id||!unit.location.stationed)return false;const c=maps.buildLayout(data(ship)).footprint.get(unit.location.square);return !!(c&&unit.location.sicId===c.sicId&&c.stations.some(p=>p.x===c.column&&p.y===c.row&&p.mesh===Number(unit.location.mesh))&&maps.definition(c.type).bridge&&maps.operational(c.item));}
function operate(room,unit,body){const ship=room.starships.find(s=>s.id===body.starshipId),s=ship&&data(ship),a=s?.airlocks?.find(a=>a.id===body.airlockId);if(!a||unit?.vacuum||unit?.currentHp<=0||unit?.location?.starshipId!==ship.id||unit.location.square!==a.square&&!canRemote(ship,unit))throw Error('Stand on the airlock square or operate an online Bridge station.');
  s.airlockStates||={};const old=s.airlockStates[a.id]||{},open=!old.open;if(open&&body.confirmed!==true)throw Error('Confirm opening the airlock: everyone in this room risks being sucked into space.');s.airlockStates[a.id]={open,checked:[]};return `${unit.characterName} ${open?'opened':'closed'} the airlock aboard ${ship.title}.`;
}
function queueRepair(room,unit,body,campaign){const ship=room.starships.find(s=>s.id===unit?.location?.starshipId),hole=ship&&state(ship).holes[body.hazardId];if(!hole||hole.sealed||doors.roomKey(ship,hole.square)!==doors.roomKey(ship,unit.location.square))throw Error('Enter the breached room to repair it.');if(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.consoleHold||unit.delayTimer)throw Error('Wait for your turn and finish your current action.');
  const difficulty=Math.max(0,20-hole.attempts);hole.attempts++;unit.delayedAction={id:randomUUID(),kind:'action',label:'Repair Hull Breach',rate:100/6,total:100,remaining:100,consumeTurn:true,resolving:false,breachRepair:{shipId:ship.id,hazardId:hole.id},rollSpec:rollSpec(unit,campaign,'Engineering',difficulty)};return ship;
}
function resolveRepair(room,unit,roll){const pending=unit.delayedAction,order=pending.breachRepair,ship=room.starships.find(s=>s.id===order.shipId),hole=ship&&state(ship).holes[order.hazardId],spec=pending.rollSpec,values=spec.sides.map(roll),total=Number.isFinite(roll.submittedScore)?roll.submittedScore:require('./ship-sensors').fusedTotal(values)+spec.bonus;unit.delayedAction=null;
  if(!hole||hole.sealed||unit.location?.starshipId!==ship.id||doors.roomKey(ship,unit.location.square)!==doors.roomKey(ship,hole.square))return ship&&report(ship,'Breach repair cancelled: the opening is sealed or the operator left the room.',values,total);
  if(total>=spec.difficulty){hole.sealed=true;return report(ship,`${unit.characterName} sealed the hull breach. Life Support can restore the room’s atmosphere.`,values,total);}return report(ship,`${unit.characterName} could not seal the hull breach. Next attempt: difficulty ${Math.max(0,20-hole.attempts)}.`,values,total);
}
function advance(room,seconds,campaign){const messages=[];if(!(seconds>0))return messages;
  for(const unit of room.units||[]){const v=unit.vacuum;if(!v)continue;
    const damage=Math.max(0,Math.floor((seconds+2-v.damageRemaining)/2));v.damageRemaining=2-((seconds+2-v.damageRemaining)%2);if(!require('./breathing').independent(campaign?.characters?.find(c=>c.id===unit.characterId)?.character||unit))unit.currentHp=Math.max(0,(Number(unit.currentHp)||0)-damage);
    const drift=Math.max(0,Math.floor((seconds+12-v.driftRemaining)/12));v.driftRemaining=12-((seconds+12-v.driftRemaining)%12);v.position.q+=v.direction.q*drift;v.position.r+=v.direction.r*drift;
    const record=campaign?.characters?.find(c=>c.id===unit.characterId);if(record){record.character.health||={};record.character.health.current=unit.currentHp;}
    const rescuer=(room.starships||[]).find(s=>s.currentHullHp>0&&data(s).airlocks?.length&&maps.installedItems(s).some(i=>i.type==='manipulation-arm'&&maps.operational(i))&&hex.hexDistance(hex.roundHex(hex.positions(room.starships,room.shipPositions).find(p=>p.id===s.id)),v.position)===0);
    if(rescuer){const s=data(rescuer),a=s.airlocks[0],l=maps.buildLayout(s),side=l.sides.find(d=>d.name===a.side),inside=a.square-(side?.offset||0),square=l.hull.has(inside)&&!l.footprint.get(inside)?.blocked?inside:a.square;unit.location={starshipId:rescuer.id,square,mesh:4,stationed:false};unit.vacuum=null;
      if(unit.characterId)(rescuer.characterLocations||={})[unit.characterId]={...unit.location};messages.push(`${rescuer.title} retrieved ${unit.characterName} with its Manipulation Arm, beside the airlock.`);
    }
  }return messages;
}
module.exports={hazards,state,distance,reconcile,rollSpec,resolveCheck,canRemote,operate,queueRepair,resolveRepair,advance};
