// Apply the existing Aerofoil impairment rule once per accepted descent.
const maps=require('./ship-map-core'),shields=require('./ship-shields'),{randomInt}=require('node:crypto');
function apply(room,ship,receipt,roll=()=>randomInt(1,11)){
 if(receipt.entryResolved)return receipt.entryDamage||null;
 receipt.entryResolved=true;
 const capabilities=maps.capabilities(ship),items=maps.installedItems(ship);
 if(capabilities.some(c=>c.key==='hover'&&c.available))return null;
 const aero=items.find(i=>maps.definition(i.type).landing==='aerofoil'&&maps.operational(i));
 if(!aero||!aero.impaired&&aero.status!=='impaired')return null;
 const dice=Array.from({length:8},roll),total=dice.reduce((a,b)=>a+b,0),before=ship.currentHullHp;
 shields.damage(room,ship.id,total,{bypassShield:true,damageType:'heat'});
 const damage=before-ship.currentHullHp;
 return receipt.entryDamage={dice,total,damage,text:`Impaired Aerofoil: atmospheric entry rolled ${dice.join(' + ')} = ${total} Heat; ${damage} Hull damage.`};
}
module.exports={apply};
