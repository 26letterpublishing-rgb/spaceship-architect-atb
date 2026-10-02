const policy=require('./ship-automation'),sensors=require('./ship-sensors'),crypto=require('node:crypto');
// Called inside the same per-room queue used by human actions. No client can call
// the internal action executor or supply the automatic dice results.
async function exploreAttack(room,seconds,{act,publish}){
  const a=room.attackResolution;if(!room.showcase||!a)return false;
  if(a.phase==='gmDamage'){await act({action:'confirmNpcDamage',attackId:a.id,finalDamage:a.damageSummary.applied});publish();return true;}
  const attacker=room.units.find(u=>u.id===a.attackerId),defender=room.units.find(u=>u.id===a.defenderId);
  const role=a.phase==='checks'&&!a.attackerRoll&&attacker?.team==='npc'&&policy.active(attacker)?'attacker':a.phase==='checks'&&!a.defenseRoll&&defender?.team==='npc'&&policy.active(defender)?'defender':a.phase==='damage'&&!a.damageRoll&&attacker?.team==='npc'&&policy.active(attacker)?'damage':null;
  if(!role)return false;
  const unit=role==='defender'?defender:attacker,key=a.id+':'+role;
  let show=unit.automationPresentation;
  if(show?.id!==key){
    const damage=role==='damage',formula=damage?require('./combat-rules').parseDiceFormula(a.plan.damageFormula):null;
    const sides=damage?[...formula.dice].flatMap(([s,n])=>Array(n).fill(s)):[...(role==='defender'&&unit.dodgeDice?unit.dodgeDice:unit.dexterityDice||[])];
    if(role==='attacker'&&a.attackType!=='melee'&&a.aimDie>0)sides.push(a.aimDie);
    const bonus=damage?Number(formula.flat||0):Number(role==='defender'?unit.dodgeSkill:['Melee','Wrestle/Disarm'].includes(a.plan.attackSkill)?unit.meleeSkill:unit.projectileSkill)||0;
    const values=sides.map(s=>crypto.randomInt(1,s+1)),score=(damage?values.reduce((n,v)=>n+v,0):sensors.fusedTotal(values))+bonus;
    unit.automationPresentation={id:key,label:unit.characterName+' '+role,sides,values,score,displayScore:score,damage,phase:'rolling',remaining:1.2,personalAttack:true};publish();return true;
  }
  if(!show.animationComplete)return true;
  show.remaining-=Math.min(.5,Math.max(0,seconds));if(show.remaining>0)return true;
  const result=await act(role==='damage'?{action:'submitAttackDamage',id:unit.id,attackId:a.id,rolledDamage:show.score,diceResults:show.values}:{action:'submitAttackRoll',id:unit.id,attackId:a.id,rollRole:role,score:show.score,diceResults:show.values});
  if(result.ok){show.phase='complete';show.completedAt=Date.now();publish();}return true;
}
async function exploreFirstAid(room,seconds,{act,publish}){
 const a=room.itemResolution;if(!room.showcase||!a||!room.units.some(policy.active))return false;
 if(a.phase==='gmDifficulty'){await act({action:'setFirstAidDifficulty',difficulty:a.baseDifficulty||12});publish();return true;}
 const unit=room.units.find(u=>u.id===a.healerId);if(unit?.team!=='npc'||!policy.active(unit))return false;
 const healing=a.phase==='healing';if(!['roll','healing'].includes(a.phase))return false;
 const key=a.id+':'+a.phase;let show=unit.automationPresentation;
 if(show?.id!==key){const formula=healing?require('./combat-rules').parseDiceFormula(a.healingFormula):null,sides=healing?[...formula.dice].flatMap(([s,n])=>Array(n).fill(s)):require('./combat-engine').npcAttributeDice(unit.mentalAttribute),values=sides.map(s=>crypto.randomInt(1,s+1)),score=(healing?values.reduce((sum,n)=>sum+n,0):sensors.fusedTotal(values))+(healing?Number(formula.flat||0):Number(unit.mentalSkill||0));unit.automationPresentation={id:key,label:unit.characterName+(healing?' healing':' First Aid'),sides,values,score,displayScore:score,damage:healing,personalAttack:true,phase:'rolling',remaining:1.2};publish();return true;}
 if(!show.animationComplete)return true;show.remaining-=Math.min(.5,Math.max(0,seconds));if(show.remaining>0)return true;
 const result=await act({action:healing?'submitFirstAidHealing':'submitFirstAidRoll',id:unit.id,resolutionId:a.id,score:show.score,rolledHealing:show.score,diceResults:show.values});if(result.ok){show.phase='complete';show.completedAt=Date.now();publish();}return true;
}
async function step(room,seconds,{act,publish,off}){
  if(room.hardPaused||room.holdPaused||!room.hasEngagedClock||room.encounterEndedAt)return;
  if(await exploreAttack(room,seconds,{act,publish}))return;
  if(await exploreFirstAid(room,seconds,{act,publish}))return;
  if(room.attackResolution||room.itemResolution||room.delayRequest)return;
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
