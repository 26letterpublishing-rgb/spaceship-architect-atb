const policy=require('./ship-automation'),sensors=require('./ship-sensors'),crypto=require('node:crypto');
// Called inside the same per-room queue used by human actions. No client can call
// the internal action executor or supply the automatic dice results.
async function step(room,seconds,{act,publish,off}){
  if(room.hardPaused||room.holdPaused||!room.hasEngagedClock||room.encounterEndedAt||room.attackResolution||room.itemResolution||room.delayRequest)return;
  const waits=room.units.filter(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length);
  if(waits.some(u=>!u.delayedAction?.automated))return;
  if(require('./ship-oxygen').pending(room.starships))return;
  const missile=require('./ship-targets').flights(room).find(m=>m.phase==='impact');
  if(missile&&!missile.automated)return;
  const unit=missile?(room.units.find(u=>u.id===missile.unitId)||{id:missile.unitId,characterName:'Automated missile',location:{starshipId:missile.sourceId}}):waits[0]||room.units.find(u=>u.id===room.activeId&&policy.active(u));
  if(!unit)return;
  const pending=missile||unit.delayedAction;
  if(missile||pending?.awaitingRoll){
    const key=pending.id,spec=missile?{sides:Array(missile.dice).fill(8),bonus:0,damage:true,damageMultiplier:(()=>{const t=require('./ship-targets').find(room,missile.targetId);return t?.isMissile?1:t?.currentShieldHp>0?1:5;})()}:pending.rollSpec;
    if(!spec?.sides?.length)return;
    const holder=missile||unit;let show=holder.automationPresentation;
    if(show?.id!==key){
      const values=spec.sides.map(s=>crypto.randomInt(1,s+1)),score=(spec.damage?values.reduce((a,b)=>a+b,0):sensors.fusedTotal(values))+Number(spec.bonus||0);
      show=holder.automationPresentation=unit.automationPresentation={id:key,label:missile?missile.name+' impact':pending.label,sides:spec.sides,values,score,displayScore:score*(spec.damageMultiplier||1),difficulty:spec.difficulty,damage:!!spec.damage,phase:'rolling',remaining:0};publish();return;
    }
    unit.automationPresentation=show;
    if(show.phase==='complete'||!show.animationComplete)return;
    show.remaining-=Math.min(.5,Math.max(0,seconds));
    if(show.remaining>0)return;
    if(show.phase==='rolling'){show.phase='result';show.remaining=1.2;publish();return;}
    const result=await act(missile?{action:'missileDamage',id:unit.id,missileId:missile.id,score:show.score}:{action:'rollShipAction',id:unit.id,rollId:key,score:show.score,diceResults:show.values,exertion:0});
    if(result.ok){show.phase='complete';show.completedAt=Date.now();publish();}
    else {unit.automationNotice=result.error;show.remaining=2;off(unit,result.error);pending.automated=false;publish();}
    return;
  }
  if(unit.defeatedAt||unit.currentHp<=0||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold||unit.shieldRestabilizing)return;
  for(const candidate of policy.candidates(room,unit)){
    const result=await act({...candidate,id:unit.id,requestId:crypto.randomUUID()});
    if(result.ok){unit.automationRepairTarget=candidate.repairTarget||null;unit.automationAction={id:crypto.randomUUID(),label:unit.delayedAction?.label||unit.timedAction?.label||candidate.kind,at:Date.now()};if(unit.delayedAction)unit.delayedAction.automated=true;unit.automationNotice='';publish();return;}
  }
  if(unit.shipAi&&unit.automationMode==='offense'&&require('./ship-map-core').installedItems(room.starships.find(s=>s.id===unit.location?.starshipId)).some(i=>require('./ship-map-core').definition(i.type).weapon)){unit.automationNotice='Waiting for a detected enemy or an available zero-AU weapon.';await act({action:'completeTurn',id:unit.id});publish();return;}
  if(unit.shipAi){off(unit,unit.automationMode==='defense'?'Defense automation stopped: no available defensive action.':'Offense automation stopped: no available target or usable zero-AU weapon.');publish();}
  else {unit.automationNotice='No available action; waiting for the next turn.';await act({action:'completeTurn',id:unit.id});publish();}
}
module.exports={step};
