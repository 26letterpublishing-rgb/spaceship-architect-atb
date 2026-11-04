(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SANpcStatistics=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const fields=['speed','moveSpeed','maximumHp'];
  const bounded=(value,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):fallback));
  function attributeDice(value){
    const rating=Math.round(bounded(value,2,20,2));
    if(rating<=4)return Array.from({length:rating},()=>4);
    const dice=[4,4,4,4],faces=[4,6,8,10,12];
    for(let upgrade=0;upgrade<rating-4;upgrade++){const i=upgrade%4;dice[i]=faces[Math.min(faces.length-1,faces.indexOf(dice[i])+1)];}
    return dice.sort((a,b)=>b-a);
  }
  function derived(npc){
    const physical=attributeDice(npc.physicalAttribute),mental=Math.round(bounded(npc.mentalAttribute,2,20,6));
    return {speed:Math.round((mental+bounded(npc.mentalSkill,0,4,0))*10)/10,
      moveSpeed:Math.round((2+physical.filter(d=>d>=10).length+bounded(npc.physicalSkill,0,4,0))*10)/10,
      maximumHp:20+physical.reduce((sum,d)=>sum+d,0)};
  }
  // Preset statistics remain intentional until the GM chooses Recalculate.
  function overrides(npc){return Object.fromEntries(fields.map(k=>[k,npc.statOverrides?npc.statOverrides[k]===true:true]));}
  function calculate(npc,reset=false){npc.statOverrides=reset?{}:overrides(npc);const values=derived(npc);for(const k of fields)if(!npc.statOverrides[k])npc[k]=values[k];return npc;}
  function edit(npc,field){npc.statOverrides=overrides(npc);if(fields.includes(field))npc.statOverrides[field]=true;return calculate(npc);}
  const present=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  function exertion(npc,source={}){
    if(npc.team!=='npc'||npc.shipAi||source.shipAi)return npc;
    // Copy resource fields only on first construction, never over a live spent balance.
    for(const key of ['exertionCurrent','exertionMax','exertionDerivedMax'])if(!present(npc[key])&&present(source[key]))npc[key]=Number(source[key]);
    const maximum=Math.ceil(Math.round(bounded(npc.mentalAttribute,2,20,4))/2)+1;
    if(!present(npc.exertionMax)){
      npc.exertionMax=Math.max(maximum,present(npc.exertionCurrent)?Math.max(0,Math.round(npc.exertionCurrent)):0);
      if(npc.exertionMax===maximum)npc.exertionDerivedMax=maximum;
    }else if(present(npc.exertionDerivedMax)&&npc.exertionMax===npc.exertionDerivedMax){
      npc.exertionMax=maximum;npc.exertionDerivedMax=maximum;
    }
    // An explicit legacy maximum without our derived marker is a GM override.
    npc.exertionMax=Math.max(0,Math.round(npc.exertionMax));
    npc.exertionCurrent=present(npc.exertionCurrent)?Math.max(0,Math.min(npc.exertionMax,Math.round(npc.exertionCurrent))):npc.exertionMax;
    return npc;
  }
  const automated=npc=>Boolean(npc?.shipAi||(npc?.automationMode&&npc.automationMode!=='off'));
  function availableExertion(npc){if(npc.team!=='npc')return Number(npc.exertionCurrent??1);exertion(npc);return automated(npc)?0:Math.max(0,Number(npc.exertionCurrent)||0);}
  function validateExertion(npc,amount,{automatedAction=false}={}){
    if(!Number.isInteger(amount)||amount<0||amount>availableExertion(npc)||(amount&&automatedAction))throw Error('Selected Exertion is unavailable for this NPC.');
    return amount;
  }
  return {fields,attributeDice,derived,overrides,calculate,edit,exertion,automated,availableExertion,validateExertion};
});
