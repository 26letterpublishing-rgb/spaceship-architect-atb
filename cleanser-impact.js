(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SACleanserImpact=api;
}(typeof window==='object'?window:null,function(){
  function presentation(event={}){
    const ship=event.targetKind==='starship';
    const outcome=ship?(event.visualOutcome||(!event.hit?'miss':'damaged')):'planet';
    const destroyed=outcome==='destroyed'||outcome==='planet';
    const variant=['ocean','desert','ice','volcanic'].includes(event.variant)?event.variant:'ocean';
    const rank=Math.max(1,Math.min(5,Math.round(Number(event.targetMapRank)||1)));
    const result={planet:'PLANET DESTROYED',miss:'TARGET ESCAPED · NO DAMAGE',shielded:'SHIELD LAYER ABSORBED THE HIT',damaged:'HULL IMPACT CONFIRMED',destroyed:'STARSHIP DESTROYED'}[outcome];
    return {
      kind:ship?'starship':'planet',outcome,destroyed,showRemains:destroyed,showFragments:destroyed,
      art:ship?`sic-art-starship-rank-${rank}.webp`:`planet-${variant}.webp`,
      remainsArt:ship?null:'planet-debris.webp',
      remainsAlt:ship?'Destroyed starship debris':'Shattered planetary debris',
      result,
      stages:{buildup:ship?'ORIGINAL FIRING SOLUTION HELD':'FINAL CONTAINMENT RELEASE',beam:'FIRING — NO RETURN',rupture:result,aftermath:outcome==='miss'?'EMPTY SPACE · RESIDUAL DISTORTION':outcome==='shielded'?'HULL PROTECTED · EXCESS ENERGY DISPERSED':destroyed?'SIGNAL LOST':'TARGET SURVIVED',result}
    };
  }
  return {presentation};
}));
