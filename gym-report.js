(function(root){'use strict';
const GYM_NARRATIONS=Object.freeze([
  '{character} finished the workout and went looking for a drink.',
  'Is it leg day? {character} is still checking the schedule.',
  '{character} completed the circuit. The equipment requested a break.',
  '{character} challenged gravity to a rematch. Gravity declined to comment.',
  '{character} counted every repetition, including the dramatic pause.',
  '{character} stretched. The ship did not become any roomier.',
  '{character} earned a respectful beep from the exercise console.',
  '{character} declared the cooldown the best part of the workout.'
]);
function report(character,activity,index,at){
 const name=character||'Crew',exercise=['Strength circuit','Endurance workout','Stretching'].includes(activity)?activity:'Stretching';
 const narration=GYM_NARRATIONS[index].replaceAll('{character}',()=>name);
 return {text:name+' completed '+exercise.toLowerCase()+'. '+narration+' No automatic skill or attribute award.',narration,at};
}
const api={GYM_NARRATIONS,report};if(typeof module==='object')module.exports=api;else root.SAGymReport=api;
})(typeof window==='object'?window:globalThis);
