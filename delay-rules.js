(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.SADelayRules=api;}(typeof window!=='undefined'?window:null,function(){
  const positive=[{flat:2,percent:0,label:'+2'},{flat:3,percent:0,label:'+3'},{flat:0,percent:.16,label:'+16%'},{flat:0,percent:.33,label:'+33%'}];
  const negative=positive.map(s=>({flat:-s.flat,percent:-s.percent,label:s.label.replace('+','-')}));
  function calculate(settings){
    if(!settings)return {base:8,flat:0,percent:0,critBonus:0,rate:8,labels:[]};
    let flat=0,percent=0,critBonus=0;const labels=[];
    for(const [factor,value] of Object.entries(settings.factors||{})){
      if(factor==='Execution'){if(value>0)labels.push('Execution Crit');continue;}
      const steps=(value>0?positive:negative).slice(0,Math.min(4,Math.abs(Number(value)||0)));
      if(!steps.length)continue;
      for(const step of steps){flat+=step.flat;percent+=step.percent;}
      labels.push(`${factor} ${steps.map(s=>s.label).join(' ')}`);
    }
    const beforeCrit=Math.max(.1,Math.max(1,settings.base+flat)*(1+percent));
    if(settings.factors?.Execution>0)critBonus=Math.max(2,beforeCrit*.25);
    return {base:settings.base,flat,percent,critBonus,rate:Math.ceil((beforeCrit+critBonus)*10)/10,labels};
  }
  const repairDroneSettings=tier=>({base:6,factors:{Situation:0,Execution:0,Quality:Math.min(4,Math.max(1,tier)),Performance:0,Efficiency:0,Ingenuity:0}});
  function afterRoll(baseSeconds,score,difficulty){
    const base=Math.max(0,Number(baseSeconds)||0);
    if(!Number.isFinite(score)||!Number.isFinite(difficulty))return {baseSeconds:base,seconds:base,margin:0,outcome:'No fixed difficulty'};
    const margin=Math.max(0,score-difficulty),criticalSuccess=difficulty>0&&score>=difficulty*2,criticalFailure=difficulty>0&&score<=Math.floor(difficulty/2);
    const seconds=criticalFailure?base*2:(base-margin)*(criticalSuccess?.5:1);
    return {baseSeconds:base,seconds:Math.max(1,Math.round(seconds*1000)/1000),margin,outcome:criticalFailure?'Critical Failure':criticalSuccess?'Critical Success':score>=difficulty?'Success':'Failure'};
  }
  return {calculate,repairDroneSettings,afterRoll};
}));
