(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SASicCategories=api;
}(typeof window==='object'?window:null,function(){
  const categories=Object.freeze([
    {id:'core',label:'Core & Propulsion',color:'#78cddd'},
    {id:'defense',label:'Shields, Stealth & Hull',color:'#8bd4a7'},
    {id:'weapons',label:'Weapons & Targeting',color:'#e4ac80'},
    {id:'sensors',label:'Sensors & Probes',color:'#aab9ee'},
    {id:'security',label:'Hacking & Security',color:'#c6a4e4'},
    {id:'crew',label:'Crew & Life Support',color:'#e6c886'},
    {id:'support',label:'Repair, Cargo & Utilities',color:'#91bcbc'}
  ]);
  function category(type,definition={}){
    if(definition.illusion)return 'sensors';
    if(definition.securityDroid)return 'security';
    if(type==='relay-pulse-sub-triangulator')return 'sensors';
    if(type==='pulse-relay-echo-reverberator')return 'weapons';
    if(type==='hack-alert'||type==='transport-scrambler')return 'security';
    if(type==='ionic-force-displacers')return 'defense';
    if(definition.cpuSecurity||definition.hacking||definition.surveillance||['surv-camera','brig','hacking-bug'].includes(type)||/^(cpu-security|hacking-module)-/.test(type))return 'security';
    if(definition.shield||definition.darkveil||definition.cloaking||definition.gravityField||definition.staticShield||definition.shieldRecovery||definition.hullUpgrade||['scramble-box','vulnerability-fortification','ripple-reflector'].includes(type))return 'defense';
    if(definition.mine||definition.seeker||definition.weapon||definition.lockOn||definition.lockSharing||definition.planetaryCleanser||definition.blackHoleGun||definition.category==='missile-ammo'||type==='self-destruct'||/^(missile|spread-missiles?|flare)(-|$)/.test(type))return 'weapons';
    if(definition.sensor||definition.antenna||definition.probe||definition.probeLauncher||['shield-breacher','warp-bubble-inhibitor'].includes(type)||/^antenna-/.test(type))return 'sensors';
    if(definition.bridge||definition.thruster||definition.warp||definition.landing||definition.output>0||definition.auOutput>0||['land-wheels','ship-ai','power-core-damper','aerofoil','hover','descent','landing-gear'].includes(type)||/^(warp-fuel-|fuel-cell-)/.test(type))return 'core';
    if(['mining-laser','vulture-drone'].includes(type))return 'support';
    if(definition.addon==='science'||type==='science-lab')return 'support';
    if(definition.crewRoom||['life-support','nutritional-supplement','gravity'].includes(type))return 'crew';
    return 'support';
  }
  function group(items,definitionFor=()=>({})){
    const buckets=new Map(categories.map(c=>[c.id,[]]));
    for(const item of items)buckets.get(category(item.type||String(item),definitionFor(item))).push(item);
    return categories.filter(c=>buckets.get(c.id).length).map(c=>({...c,items:buckets.get(c.id)}));
  }
  return Object.freeze({categories,category,group});
}));
