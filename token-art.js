(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SATokenArt=api;}(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const races=Object.freeze(['android','angiluros','antropic','bruggle','butchers-of-hellmouth','draco-prime','epoc','everliving-brethren','flavilin','garmoc','grey','horus','human','kabuto','krax-gny-vtek','nordic-flaxen','pattanilia','skeder','slyn-tanni','spiddix','tamalori','vinolio-paxton','xithx','yetuak-zune','yuhorn-symitron']);
  const neutral=new Set(['android','butchers-of-hellmouth','grey','kabuto','skeder','spiddix','xithx','yuhorn-symitron']);
  const subraces=Object.freeze(["android-perfect-android", "android-imperfect-android", "android-perfect-robot", "android-imperfect-robot", "antropic-fangs", "antropic-feather", "antropic-fins", "antropic-fluffy", "yuhorn-symitron-ice", "yuhorn-symitron-lava", "yuhorn-symitron-rock", "yuhorn-symitron-wood"]),allRaces=Object.freeze([...races,...subraces]),disguiseAllowed=r=>allRaces.includes(r)&&!['spiddix','kabuto','skeder','xithx'].includes(r);
  const ships=Object.freeze(['Pathfinder','Arrowhead','Bastion','Crescent','Longbow','Atlas','Stingray','Citadel']);
  const variant=value=>Number(value)===1?1:0;
  function character(source={}){const c=source.character||source,baseRace=c.identity?.raceId||c.raceId||'',disguise=c.presentation?.iconRace||c.iconRace,sub=baseRace+'-'+(c.identity?.raceType||c.raceType||''),race=baseRace==='draco-prime'&&disguiseAllowed(disguise)?disguise:subraces.includes(sub)?sub:baseRace;return {race:allRaces.includes(race)?race:'',variant:variant(c.presentation?.iconVariant??c.iconVariant)};}
  function attributes(source){const c=character(source);return `data-token-race="${c.race}" data-token-variant="${c.variant}"`;}
  function atlas(race){return allRaces.includes(race)?`crew-atlas-${race}-v1.webp`:'';}
  // Generated atlases have transparent gutters, but their row boundary can vary.
  // Explicit viewports preserve aspect ratio and exclude the neighboring sprite.
  const rowCuts=Object.freeze({android:251,angiluros:257,antropic:247,bruggle:246,'butchers-of-hellmouth':255,'draco-prime':252,epoc:246,'everliving-brethren':251,flavilin:255,garmoc:258,grey:250,horus:246,human:256,kabuto:258,'krax-gny-vtek':256,'nordic-flaxen':254,pattanilia:258,skeder:254,'slyn-tanni':255,spiddix:254,tamalori:260,'vinolio-paxton':258,xithx:254,'yetuak-zune':238,'yuhorn-symitron':256});
  const atlasSizes=Object.freeze({'draco-prime':[493,512],epoc:[512,500],'everliving-brethren':[506,512]});
  function figure(race,choice=0){
    const file=atlas(race);if(!file)return '';const row=variant(choice),[aw,ah]=atlasSizes[race]||[512,512],cw=aw/2,cut=rowCuts[race]??256,y=row?cut:0,h=row?ah-cut:cut;
    const scale=32/Math.max(cw,h),width=cw*scale,height=h*scale;
    const frame=(column,classes,mirror=false)=>`<g class="crew-sprite-frame ${classes}"${mirror?' transform="translate(32 0) scale(-1 1)"':''}><svg x="${(32-width)/2}" y="${(32-height)/2}" width="${width}" height="${height}" viewBox="${column*cw} ${y} ${cw} ${h}" preserveAspectRatio="xMidYMid meet" overflow="hidden"><image href="${file}" width="${aw}" height="${ah}"/></svg></g>`;
    return `<svg class="crew-figure crew-sprite" viewBox="0 0 32 32" aria-hidden="true" data-perspective="overhead" data-sprite-row="${row}">${frame(0,'crew-sprite-standing')}${frame(1,'crew-sprite-step')}${frame(1,'crew-sprite-step crew-sprite-mirror',true)}</svg>`;
  }
  function options(race){return allRaces.includes(race)?[0,1].map(v=>({value:v,label:neutral.has(race)||race.startsWith('yuhorn-')||race.includes('robot')?`Variant ${v+1}`:v?'Female':'Male'})):[];}
  function shipId(source={}){const value=Number(source.ship?.mapIcon??source.mapIcon);return Number.isInteger(value)&&value>=1&&value<=8?value:1;}
  function shipImage(source){return `ship-token-${shipId(source)}-v1.webp`;}
  return Object.freeze({races,subraces,allRaces,disguiseAllowed,ships,variant,character,attributes,atlas,figure,options,shipId,shipImage,walkCycleMs:840});
}));
