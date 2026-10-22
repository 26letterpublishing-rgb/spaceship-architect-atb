(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SACampaignLocation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function locate(state){
  const d=state.starmaps||{},own=d.ownLocation,id=state.ownCharacterId;
  const ship=own?(state.starships||[]).find(s=>s.id===own.starshipId):(state.starships||[]).find(s=>s.id===d.party?.shipId)||(state.starships||[]).find(s=>s.crewCharacterIds?.includes(id));
  const surface=own?.environment==='surface'?own:!own?d.party:null;
  let result;
  if(surface)result={...surface,mode:'surface',regionId:surface.regionId||''};
  else if(ship){const local=d.localPositions?.[ship.id],position=d.positions?.[ship.id];result=local?{...local,mode:local.phase==='surface'?'surface':local.phase==='orbit'?'orbit':'system',hex:local.surfaceHex,shipId:ship.id}:{...position,mode:'galaxy',shipId:ship.id};}
  if(!result?.mapId)return null;
  const map=d.maps?.find(m=>m.id===result.mapId);if(!map)return null;
  const star=map.stars?.find(s=>s.id===result.starId);
  if(result.mode!=='galaxy'&&!star)return null;
  // Navigation respects the same visibility policy as ordinary browsing.
  if(d.navigation?.allowed?.[result.mode]===false)return null;
  return result;
 }
 return {locate};
});
