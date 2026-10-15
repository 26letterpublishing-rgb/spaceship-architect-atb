'use strict';
// Server-authoritative personal effects. Only active combat seconds enter advance;
// every damage pool is queued for the existing manual dice/confirmation flow.
const arena = require('./combat-arena');
const {randomUUID} = require('node:crypto');
const electronic = u => u.raceId === 'android' || u.shipAi || u.securityDroid;
function queue(unit, effect) {
  (unit.personalEffects ||= []).push({id:randomUUID(), ...effect});
}
function ignite(unit, intensity, source = 'Fire', maximum = 5) {
  const current = unit.burning;
  const value = Math.max(0, Math.floor(Number(intensity) || 0));
  if (!value) return;
  unit.burning = {intensity:Math.max(current?.intensity || 0,value), remaining:current?.remaining ?? 8,
    maximum:Math.max(maximum,value,current?.maximum||5),source};
}
function extinguish(unit, amount) {
  if (!unit.burning) return 0;
  unit.burning.intensity = Math.max(0,unit.burning.intensity-amount);
  if (!unit.burning.intensity) unit.burning = null;
  return unit.burning?.intensity || 0;
}
function nextEvent(unit) {
  if(unit.defeatedAt||unit.currentHp===0)return Infinity;
  return Math.min(unit.burning?.remaining ?? Infinity,...(unit.weaponTimers||[]).map(t=>t.remaining));
}
function advance(unit, seconds) {
  if (!(seconds>0)||unit.defeatedAt||unit.currentHp===0) return;
  if(unit.frozenSeconds>0)unit.frozenSeconds=Math.max(0,unit.frozenSeconds-seconds);
  if (unit.burning) {
    const fire=unit.burning;fire.remaining-=seconds;
    if (fire.remaining<=1e-7) {
      queue(unit,{name:fire.source,formula:`${fire.intensity}D10`,element:'Fire',growFire:true});
      fire.remaining=8;
    }
  }
  for (const timer of unit.weaponTimers||[]) {
    timer.remaining-=seconds;
    if (timer.remaining<=1e-7) {
      queue(unit,{...timer,id:undefined});
      unit.personalEffects.at(-1).id=randomUUID();
      timer.remaining=timer.interval||Infinity;
      timer.duration=(timer.duration??0)-(timer.interval||0);
    }
  }
  unit.weaponTimers=(unit.weaponTimers||[]).filter(t=>Number.isFinite(t.remaining)&&(t.duration===undefined||t.duration>0));
}
function damage(unit, amount, {element='',ignoreDamageReduction=false,finalDamage=false,critical=false,bypassSuit=false}={}) {
  let incoming=Math.max(0,Number(amount)||0);
  if (!finalDamage && /Fire|Heat/i.test(element)) {
    if (unit.raceId==='butchers-of-hellmouth'||unit.raceId==='yuhorn-symitron'&&unit.raceType==='lava') incoming=0;
    else if (/Fire/i.test(element)&&(['everliving-brethren','yetuak-zune'].includes(unit.raceId)||unit.raceId==='yuhorn-symitron'&&['ice','wood'].includes(unit.raceType))) incoming*=2;
  }
  if(!finalDamage&&/^Light$/i.test(element)&&unit.raceId==='pattanilia')incoming=0;
  if(!finalDamage&&/Ice|Cold/i.test(element)){if(unit.raceId==='yetuak-zune'||unit.raceId==='yuhorn-symitron'&&unit.raceType==='ice')incoming=0;else if(unit.raceId==='yuhorn-symitron'&&unit.raceType==='lava')incoming*=2;}
  if(!finalDamage&&/Poison/i.test(element)&&electronic(unit))incoming=0;
  if (!finalDamage && /Electric/i.test(element)&&(unit.statuses?.wet||unit.frozenSeconds>0||electronic(unit))) incoming*=2;
  const armor=require('./health-display').protectionItem(unit),kevlar=armor?.catalogId==='kevlar-vest';
  const reduction=finalDamage||ignoreDamageReduction?0:
    (unit.raceId==='xithx'&&(/Fire/i.test(element)||critical)?0:Math.max(0,Number(unit.damageReduction)||0))+
    (kevlar&&/^Physical$/i.test(element)?20:0);
  let applied=Math.max(0,incoming-reduction),suitAbsorbed=0;
  if (!bypassSuit) {
    const suit=armor?.catalogId==='space-suit'?armor:null;
    if (suit) {
      unit.suitHp ||= {};
      const hp=unit.suitHp[suit.id]??suit.protectionHp??20;
      suitAbsorbed=Math.min(hp,applied);unit.suitHp[suit.id]=hp-suitAbsorbed;suit.protectionHp=hp-suitAbsorbed;applied-=suitAbsorbed;
    }
  }
  return {incoming,reduction,applied,suitAbsorbed};
}
function lineBehind(room,attacker,target,range=10) {
  const a=arena.position(attacker),b=arena.position(target),g=arena.grid(room,b);
  if (!g||!a||a.starshipId!==b.starshipId||a.arenaId!==b.arenaId) return [];
  const ai=g.index(a),bi=g.index(b),dx=bi%g.width-ai%g.width,dy=Math.floor(bi/g.width)-Math.floor(ai/g.width),length=Math.hypot(dx,dy);
  if (!length) return [];
  const result=[];
  for (const u of room.units) {
    const p=arena.position(u);if(u===target||u===attacker||!p||p.starshipId!==b.starshipId||p.arenaId!==b.arenaId)continue;
    const n=g.index(p),x=n%g.width-bi%g.width,y=Math.floor(n/g.width)-Math.floor(bi/g.width),along=(x*dx+y*dy)/length,cross=Math.abs(x*dy-y*dx)/length;
    if(along>0&&along<=range&&cross<=.5&&arena.canTarget(room,target,u))result.push(u);
  }
  return result;
}
function knockback(room,attacker,target,units) {
  const g=arena.grid(room,arena.position(target));if(!g)return false;
  const a=g.index(arena.position(attacker)),start=g.index(arena.position(target));
  const dx=start%g.width-a%g.width,dy=Math.floor(start/g.width)-Math.floor(a/g.width),length=Math.hypot(dx,dy);
  if(!length)return false;
  let last=start;
  for(let n=1;n<=units;n++) {
    const x=Math.round(start%g.width+dx/length*n),y=Math.round(Math.floor(start/g.width)+dy/length*n),to=y*g.width+x;
    const p=g.location(to),probe={location:p};
    const blocked=x<0||x>=g.width||y<0||y>=g.height||!g.floor.has(to)||!arena.canTarget(room,{location:g.location(last)},probe)||room.units.some(u=>u!==target&&!u.defeatedAt&&arena.distance(room,u,probe)===0);
    if(blocked){target.location=g.location(last);return true;}
    last=to;
  }
  target.location=g.location(last);return false;
}
function afterHit(room,attacker,target,attack,applied) {
  const id=attack.weaponId,charges=attack.chargeCount||0;
  target.statuses ||= {};
  if(id==='spouter')target.statuses.wet=true;
  if(attack.plan?.fireIntensity)ignite(target,attack.plan.fireIntensity,attack.weaponName);
  if(id==='cc-9000'||id==='disabler')queue(target,{name:attack.weaponName,check:true,attribute:id==='cc-9000'?'strength':'willpower',skill:id==='cc-9000'?'Escape':'Resist Distress',difficulty:id==='cc-9000'?13:15});
  if(id==='fireball-launcher'||id==='hyper-thermalized-katana') {
    const bonus=attacker.classId==='pyro'?Math.floor(attacker.demolitionsSkill||0):0;
    ignite(target,2+(id==='fireball-launcher'?charges:0)+bonus,attack.weaponName,5+bonus);
  }
  if(attack.attackType==='melee') {
    if(attacker.raceId==='butchers-of-hellmouth'&&attacker.burning)ignite(target,attacker.burning.intensity);
    if(id==='unarmed'&&attacker.raceId==='yuhorn-symitron'&&attacker.raceType==='lava')ignite(target,attacker.willpowerDice?.length||1);
  }
  const poisonBase=Number(attack.damageSummary?.rolled??applied);
  if(id==='greentip-v-x-101'&&!electronic(target)&&poisonBase>=4) {
    const dice=Math.floor(poisonBase/4),old=(target.weaponTimers||[]).find(t=>t.kind==='poison');
    if(!old||(old.dice||0)<dice){target.weaponTimers=(target.weaponTimers||[]).filter(t=>t.kind!=='poison');target.weaponTimers.push({kind:'poison',name:'Greentip poison',formula:`${dice}D8`,dice,element:'Poison',remaining:6,interval:6,duration:3600,ignoreDamageReduction:true,bypassSuit:true});}
  }
  if(id==='dark-matter-launcher'&&applied>=10)(target.weaponTimers||=[]).push({name:'Dark Matter delayed damage',formula:`${2*Math.floor(applied/10)}D8`,element:'Dark Matter',remaining:6,ignoreDamageReduction:true,bypassSuit:true});
  if(id==='frost-thrower'&&target.raceId!=='yetuak-zune'&&!(target.raceId==='yuhorn-symitron'&&target.raceType==='ice'))target.frozenSeconds=(target.frozenSeconds||0)+Math.floor(applied/Math.max(2,16-charges*2))*100/Math.max(1,target.speed||1);
  if(id==='electricity-blade'&&attack.attackResult?.critical)target.frozenSeconds=(target.frozenSeconds||0)+200/Math.max(1,target.speed||1);
  if(id==='amplify-gauntlets'&&knockback(room,attacker,target,Math.min(4,attacker.strengthDice?.length||0)))queue(target,{name:'Amplify Gauntlets collision',formula:'2D10',element:'Physical'});
}
function blastTargets(room,origin,radius,multiplier=5,falloff=1) {
  const source={location:origin};
  return room.units.flatMap(unit=>{const distance=arena.distance(room,source,unit);if(distance===null||distance>=radius||!arena.canTarget(room,source,unit))return [];return [{unit,multiplier:Math.max(0,multiplier-Math.floor(distance/falloff))}];});
}
function explosive(weaponId, origin) {
  if(weaponId==='flash-bomb')return {name:'Flash Bomb',flash:true,origin,radius:18};
  if(weaponId==='mini-nuke')return {name:'Mini Nuke',formula:'3D12',element:'Physical',origin,radius:30,multiplier:10,falloff:3,fallout:true};
  if(['grenade','sticky-grenade','proximity-mine'].includes(weaponId))return {name:weaponId==='grenade'?'Grenade':weaponId==='sticky-grenade'?'Sticky Grenade':'Proximity Mine',formula:'3D8',element:'Physical',origin,radius:5,multiplier:5,falloff:1};
  return null;
}
function wallsNear(room,target,radius=6) {
  const p=arena.position(target),g=arena.grid(room,p);if(!g)return 2;
  const n=g.index(p),x=n%g.width,y=Math.floor(n/g.width),edges=new Set();let blocked=0;
  for(let yy=Math.max(0,y-radius);yy<=Math.min(g.height-1,y+radius);yy++)for(let xx=Math.max(0,x-radius);xx<=Math.min(g.width-1,x+radius);xx++){
    if(Math.hypot(xx-x,yy-y)>radius)continue;const a=yy*g.width+xx;
    if(!g.floor.has(a)){blocked++;continue;}
    for(const b of [a+1,a+g.width]){if(b>=g.width*g.height||b===a+1&&xx===g.width-1)continue;const e=g.edge(a,b);if(g.floor.has(b)&&(e.kind==='wall'||e.kind==='door'&&!e.open))edges.add(e.key||[a,b].join(':'));}
  }
  return 2+blocked+edges.size;
}
module.exports={queue,ignite,extinguish,nextEvent,advance,damage,lineBehind,knockback,afterHit,blastTargets,electronic,explosive,wallsNear};
