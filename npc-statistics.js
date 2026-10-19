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
  return {fields,attributeDice,derived,overrides,calculate,edit};
});
