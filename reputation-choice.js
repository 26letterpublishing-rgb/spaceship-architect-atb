(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SAReputationChoice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const baseline=ship=>Array.from({length:5},(_,i)=>Math.max(0,Math.min(10,Math.round(Number(ship?.reputationSelections?.[i]??5)||0))));
 function preview(original,choice){return original.map((n,i)=>i===choice?.row?Math.max(0,Math.min(10,n+choice.direction)):n);}
 function choose(original,row,dot){
  const direction=dot-original[row];
  if(!Number.isInteger(dot)||row<0||row>4||dot<0||dot>10||Math.abs(direction)>1)return undefined;
  return direction?{row,direction}:null;
 }
 return {baseline,preview,choose};
});
