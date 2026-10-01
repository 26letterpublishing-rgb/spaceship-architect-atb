(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.SACharacterStatistics=api;})(typeof window==='object'?window:null,function(){
 function state(character){character.statistics||={};const s=character.statistics;s.skills||={};s.receipts||=[];return s;}
 function once(s,key){if(!key||s.receipts.includes(key))return false;s.receipts.push(key);s.receipts=s.receipts.slice(-1000);return true;}
 function roll(character,skill,score,receipt){if(!receipt||!skill||!Number.isFinite(Number(score)))return;const s=state(character);if(!once(s,'roll:'+receipt))return;const key=String(skill).slice(0,100);if(['__proto__','constructor','prototype'].includes(key))return;const row=s.skills[key]||{count:0,total:0};row.count++;row.total+=Number(score);s.skills[key]=row;}
 function damage(character,kind,amount,receipt){const s=state(character);if(!receipt||!Number.isFinite(amount)||amount<0||!once(s,kind+':'+receipt))return;const key=kind==='dealt'?'mostDamageDealt':'mostDamageTaken';s[key]=Math.max(s[key]||0,amount);}
 function earned(character,kind,amount){if(amount>0&&Number.isFinite(amount)){const s=state(character);s[kind+'Earned']=(s[kind+'Earned']||0)+amount;}}
 return {state,roll,damage,earned};
});
