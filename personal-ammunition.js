(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SAPersonalAmmunition=api;})(typeof globalThis==='object'?globalThis:this,function(){
  const profiles={
    'ballistic-sidearm':{capacity:10,item:'ballistic-ammo',rounds:100},
    'rusty-sawed-off':{capacity:1,item:'shotgun-ammo',rounds:50},
    'homing-spike-pistol':{capacity:5,item:'homing-spike-clip',rounds:5},
    'netlauncher':{capacity:1,item:'launcher-net',rounds:1},
    'spouter':{capacity:10,item:'canteen-water-purifier',water:true},
    'silent-scope-sniper-rifle':{capacity:8,mineral:true},
  };
  const profile=w=>profiles[w?.weaponId||w?.id];
  function remaining(w){const p=profile(w);return p?Math.max(0,Math.min(p.capacity,Math.floor(Number(w.ammoRemaining??p.capacity)||0))):null;}
  function reload(unit,weapon,{minerals,mineral='Iron'}={}){
    const p=profile(weapon);if(!p)throw Error('This weapon does not use a magazine.');
    let need=p.capacity-remaining(weapon);if(!need)throw Error('This weapon is already loaded.');
    if(p.mineral){
      if(!['Iron','Magnesium'].includes(mineral))throw Error('Choose Iron or Magnesium.');
      const stock=Math.max(0,Math.floor(Number(minerals?.[mineral])||0));
      if(!stock)throw Error('No '+mineral+' is available aboard this ship. Each mineral unit loads one round.');
      const loaded=Math.min(need,stock);minerals[mineral]=stock-loaded;weapon.ammoRemaining=remaining(weapon)+loaded;return loaded;
    }
    const reserve=(unit.items||[]).filter(i=>i.catalogId===p.item&&i.quantity>0);
    if(!reserve.length)throw Error(p.water?'Carry a filled Canteen/Water Purifier to refill the Spouter.':'Purchase compatible ammunition in the Shop before reloading.');
    let loaded=0;
    for(const item of reserve){
      if(p.water){loaded=need;break;}
      let stock=Math.max(0,Math.floor(item.ammoRounds??p.rounds*item.quantity));
      const used=Math.min(stock,need-loaded);stock-=used;loaded+=used;
      item.ammoRounds=stock;item.quantity=Math.ceil(stock/p.rounds);
      if(loaded===need)break;
    }
    if(!loaded)throw Error('No ammunition remains in the carried reserves.');
    unit.items=unit.items.filter(i=>i.quantity>0);weapon.ammoRemaining=remaining(weapon)+loaded;
    return loaded;
  }
  function canTarget(weapon,target){
    if((weapon?.weaponId||weapon?.id)!=='mk-u-id-assassin')return true;
    const p=weapon.targetProgram;if(!p)return false;
    if(p.kind==='target')return p.value===(target.characterId||target.id)||p.value===target.id;
    if(p.kind==='race')return String(target.raceId||'').toLowerCase()===p.value.toLowerCase();
    if(p.kind==='sex')return String(target.sex||'').toLowerCase()===p.value.toLowerCase();
    return false;
  }
  return {profiles,profile,remaining,reload,canTarget};
});
