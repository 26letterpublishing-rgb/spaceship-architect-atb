(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SACombatRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function signedBonuses(text, label) {
    const pattern = new RegExp(`([+-]\\s*\\d+(?:\\.\\d+)?)\\s*${label}`, "gi");
    let total = 0;
    let match;
    while ((match = pattern.exec(String(text || "")))) total += number(match[1].replace(/\s/g, ""));
    return total;
  }

  function printedToHitModifier(text) {
    const remainder = String(text || "").replace(/Dexterity/gi, "").replace(/Projectile|Melee|Wrestle|Disarm/gi, "").replace(/[A-Za-z]/g, "");
    return (remainder.match(/[+-]\s*\d+(?:\.\d+)?/g) || []).reduce((sum, value) => sum + number(value.replace(/\s/g, "")), 0);
  }

  function parseDiceFormula(text) {
    const source = String(text || "").trim();
    const dice = new Map();
    let match;
    const dicePattern = /([+-]?)\s*(\d+)D(\d+)/gi;
    while ((match = dicePattern.exec(source))) {
      const sign = match[1] === "-" ? -1 : 1;
      const sides = number(match[3]);
      dice.set(sides, (dice.get(sides) || 0) + sign * number(match[2]));
    }
    const withoutDice = source.replace(dicePattern, " ");
    const flat = (withoutDice.match(/[+-]\s*\d+(?:\.\d+)?/g) || []).reduce((sum, value) => sum + number(value.replace(/\s/g, "")), 0);
    return { dice, flat, supported: dice.size > 0 || /^\s*[+-]?\d+(?:\.\d+)?\s*$/.test(source) };
  }

  function isSimpleDamageFormula(text) {
    const compact = String(text || "").replace(/\s/g, "");
    return /^(?:\d+D(?:4|6|8|10|12|20)|\d+(?:\.\d+)?)(?:[+-](?:\d+D(?:4|6|8|10|12|20)|\d+(?:\.\d+)?))*$/i.test(compact);
  }

  function mergeDamageBonus(parsed, bonusText, multiplier) {
    const source = String(bonusText || "");
    let match;
    for (const clause of source.split(/[,;]/)) {
      const formula = clause.match(/([+-]?\s*\d+D\d+(?:\s*[+-]\s*\d+)?|[+-]\s*\d+)\s*Damage/i)?.[1];
      if (!formula) continue;
      const bonus=parseDiceFormula(formula);
      for (const [sides,count] of bonus.dice) parsed.dice.set(sides,(parsed.dice.get(sides)||0)+count*multiplier);
      parsed.flat+=bonus.flat*multiplier;
    }
  }

  function formatDiceFormula(parsed) {
    const terms = [...parsed.dice.entries()]
      .filter(([, count]) => count !== 0)
      .sort((a, b) => a[0] - b[0])
      .map(([sides, count]) => `${count < 0 ? "-" : ""}${Math.abs(count)}D${sides}`);
    if (parsed.flat) terms.push(`${parsed.flat > 0 ? "+ " : "- "}${Math.abs(parsed.flat)}`);
    return terms.join(" ").replace(/ (?=\d+D)/g, " + ").replace(/^\+\s*/, "") || "0";
  }

  function heldWeapon(unit) {
    const weapon=(unit?.weapons||[]).find(w=>w.inventoryId===unit.heldWeaponId);if(!weapon)return null;
    const ammoId=unit.launcherAmmo?.[weapon.inventoryId]?.[0],ammo=(unit.weapons||[]).find(w=>w.inventoryId===ammoId);
    if(!ammo||ammo.launcherId!==weapon.id)return weapon;
    return {...weapon,...ammo,id:ammo.weaponId,weaponId:ammo.weaponId,category:'ranged',inventoryId:weapon.inventoryId,ammoInventoryId:ammo.inventoryId,launcherId:weapon.id,name:weapon.name+' / '+ammo.name,toHit:'Dexterity + Projectile '+(String(ammo.toHit).match(/[+-]\d+/)?.[0]||''),recoverySeconds:weapon.recoverySeconds,criticalDamageDisabled:true,special:ammo.special+' Critical hits do not deal double damage.'};
  }
  function configureWeapon(original, options={}, charges=0) {
    const weapon={...original};const count=v=>Math.max(0,Math.min(6,Math.floor(number(v))));
    if(weapon.id==='gravity-gun'){
      const x=Math.max(1,Math.min(8,Math.floor(number(options.rating,1))));weapon.damage=x+'D12';weapon.range=(x*4)+' Max';weapon.toHit='Dexterity + Projectile +'+x;
    }
    if(weapon.id==='solar-powered-t44-cannon'){
      const x=Math.max(0,Math.min(8,Math.floor(number(options.rating,2))));weapon.damage=(x*(1+charges))+'D10';weapon.range=String(x);weapon.toHit='Dexterity + Projectile +'+x;weapon.chargeBonus='None';weapon.recoverySeconds=charges*6;weapon.dark=x===0;
    }
    if(weapon.id==='phazor'&&options.reflected)weapon.toHit='Dexterity + Science';
    if(weapon.id==='cf-leprechaun'&&charges>0&&['Physical','Fire','Heat','Electricity','Light','Ionic Force','Energy Blast','Poison'].includes(options.element))weapon.element=options.element;
    if(weapon.id==='l-x-custom-royal'){
      const choices=Array.isArray(options.choices)?options.choices.slice(0,charges):[];
      const counts={damage:0,accuracy:0,range:0,fire:0,penetrate:0,burst:0};for(const choice of choices)if(Object.hasOwn(counts,choice))counts[choice]++;
      if(counts.burst>1)throw Error('The +3D12 burst may be selected only once.');
      weapon.damage=(2+counts.damage)+'D8 + '+(1+counts.damage*2)+(counts.burst?' + 3D12':'');weapon.toHit='Dexterity + Projectile +'+counts.accuracy*2;weapon.range=String(8+counts.range*2);weapon.chargeBonus='None';weapon.special='Configured charge bonuses';weapon.fireIntensity=counts.fire;weapon.penetrate=counts.penetrate>0;weapon.recoverySeconds=counts.burst?12:0;
    }
    if(weapon.id==='murasama-blade'&&options.unsheathe){weapon.damage+=' + 1D10';weapon.chargeBonus+=', +1D10 Damage';}
    return weapon;
  }
  function attackPlan(weapon, { distance = 0, charges = 0, aimDie = 0, aimDice = [], attackType = "ranged", strengthDice = [], situationalAttackModifier = 0, options = {} } = {}) {
    weapon=configureWeapon(weapon,options,charges);
    const rangeText = String(weapon?.range || "");
    const baseRange = number(rangeText.match(/\d+(?:\.\d+)?/)?.[0]);
    const chargeRange = signedBonuses(weapon?.chargeBonus, "Range") * Math.max(0, number(charges));
    const effectiveRange = Math.max(0, baseRange + chargeRange);
    const units = Math.max(0, number(distance));
    const isMaximum = /\bMax\b/i.test(rangeText);
    let allowed = !weapon.dark;
    let attackRangeModifier = 0;
    let defenseRangeModifier = 0;
    let damageDieReduction = null;
    let rangeExplanation = "";
    let manualRange = false;

    if (attackType === "melee") {
      allowed = units <= Math.max(1.5, effectiveRange || 1);
      rangeExplanation = allowed ? "Nearby melee target; no Range modifiers." : "Target is not within melee reach.";
    } else if (weapon?.id === "ionic-shotgun") {
      const bands = Math.floor(units / 2);
      attackRangeModifier = bands;
      damageDieReduction = { sides: 10, count: bands };
      rangeExplanation = `${bands} complete 2-unit band${bands === 1 ? "" : "s"}: To-Hit +${bands}, Damage -${bands}D10; Defense unchanged.`;
    } else if (weapon?.id === "rusty-sawed-off") {
      const steps = Math.floor(units);
      allowed = units <= effectiveRange;
      attackRangeModifier = steps * 2;
      damageDieReduction = { sides: 6, count: steps * 2 };
      rangeExplanation = `${steps} unit${steps === 1 ? "" : "s"}: To-Hit +${steps * 2}, Damage -${steps * 2}D6; Defense unchanged.${allowed ? "" : ` Maximum ${effectiveRange} units exceeded.`}`;
    } else if (!baseRange || /Strength|See Ammo|\bX\b/i.test(rangeText)) {
      manualRange = true;
      rangeExplanation = `Printed Range ${rangeText || "N/A"} requires the card's special rule or GM resolution.`;
    } else if (isMaximum) {
      allowed = units <= effectiveRange;
      rangeExplanation = allowed ? `Within the ${effectiveRange}-unit maximum; no standard Range modifiers.` : `Out of range: maximum ${effectiveRange} units.`;
    } else {
      const bands = units > 0 ? Math.floor((units + 1e-8) / effectiveRange) : 0;
      attackRangeModifier = bands ? -bands : 0;
      defenseRangeModifier = bands;
      rangeExplanation = `${bands} Range band${bands === 1 ? "" : "s"}: To-Hit ${attackRangeModifier >= 0 ? "+" : ""}${attackRangeModifier}, Defense +${defenseRangeModifier}.`;
    }

    const printedModifier = printedToHitModifier(weapon?.toHit);
    const chargeToHitModifier = signedBonuses(weapon?.chargeBonus, "To-Hit") * Math.max(0, number(charges));
    const attackModifier = printedModifier + chargeToHitModifier + attackRangeModifier + number(situationalAttackModifier);
    const strengthFormula = Array.isArray(strengthDice) && strengthDice.length
      ? strengthDice.map((sides) => `1D${number(sides)}`).join(" + ")
      : "2D4";
    const weaponDamage = String(weapon?.damage || "").trim();
    const printedStrengthDamage = /Strength Dice/i.test(weaponDamage);
    const printedDamage = attackType === "melee"
      ? `${printedStrengthDamage ? weaponDamage.replace(/(?:All )?Strength Dice/i, strengthFormula) : weaponDamage + ' + ' + strengthFormula}`
      : weaponDamage;
    const damage = parseDiceFormula(printedDamage);
    mergeDamageBonus(damage, weapon?.chargeBonus, Math.max(0, number(charges)));
    for (const die of (aimDice.length ? aimDice : aimDie > 0 ? [aimDie] : []).slice(0,4)) if (!["greentip-v-x-101","disabler","netlauncher"].includes(weapon?.id)) damage.dice.set(number(die), (damage.dice.get(number(die)) || 0) + 1);
    if (damageDieReduction) damage.dice.set(damageDieReduction.sides, Math.max(0, (damage.dice.get(damageDieReduction.sides) || 0) - damageDieReduction.count));
    const specialText = String(weapon?.special || "");
    const choiceRequired = /choose one/i.test(specialText);
    const manualToHit = attackType === "melee"
      ? !/^Dexterity\s*\+\s*(?:Melee|Grappling|Wrestle\/Disarm)(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/i.test(String(weapon?.toHit || "").trim())
      : !/^Dexterity\s*\+\s*Projectile(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/i.test(String(weapon?.toHit || "").trim());
    const criticalDamageDisabled = /critical hits do not deal double damage|does not double critical-hit damage/i.test(specialText);

    return {
      weaponId: weapon?.id,
      element:weapon?.element || "Physical",
      fireIntensity:weapon.fireIntensity||0,
      recoverySeconds:weapon.recoverySeconds||0,
      charges: Math.max(0, number(charges)),
      ignoreDamageReduction: weapon.penetrate || ["power-drill","hyper-thermalized-katana","greentip-v-x-101"].includes(weapon?.id),
      defenseMultiplier: weapon?.id === "homing-spike-pistol" ? .5 : 1,
      specialRules: specialText,
      attackAttribute: /^Strength/i.test(weapon?.toHit || "") ? "strength" : "dexterity",
      allowed,
      manualRange,
      distance: units,
      effectiveRange,
      printedModifier,
      chargeToHitModifier,
      attackRangeModifier,
      situationalAttackModifier: number(situationalAttackModifier),
      defenseRangeModifier,
      attackModifier,
      damageFormula: damage.supported && isSimpleDamageFormula(printedDamage) ? formatDiceFormula(damage) : String(weapon?.damage || "Resolve manually"),
      damageFormulaSupported: damage.supported && !choiceRequired && isSimpleDamageFormula(printedDamage) && !(number(charges) > 0 && /\b(?:X|See Ammo|Increase|Choose)\b/i.test(String(weapon?.chargeBonus || ""))),
      rangeExplanation,
      choiceRequired,
      manualToHit,
      criticalDamageDisabled,
      attackType,
      attackSkill: /Science/i.test(weapon?.toHit || "") ? "Science" : attackType === "melee" && /(?:Grappling|Wrestle\/Disarm)/i.test(String(weapon?.toHit || "")) ? "Grappling" : attackType === "melee" ? "Melee" : "Projectile",
    };
  }

  function resolveAttack({ baseAttackScore, targetDefense, calledShot = false, plan }) {
    const attackScore = number(baseAttackScore) + number(plan?.attackModifier);
    const rangedDefense = number(targetDefense) * number(plan?.defenseMultiplier, 1) + number(plan?.defenseRangeModifier);
    const hitDefense = rangedDefense + (calledShot ? 5 : 0);
    const hit = Boolean(plan?.allowed !== false) && attackScore >= hitDefense;
    const criticalDefense = calledShot ? rangedDefense - 5 : rangedDefense;
    const critical = hit && attackScore >= criticalDefense * 2;
    return { attackScore, rangedDefense, hitDefense, criticalDefense, hit, critical };
  }

  function damagePlan(plan, result, fusions=0) {
    if (!plan?.damageFormulaSupported) return plan;
    const damage=parseDiceFormula(plan.damageFormula), margin=Math.max(0,result.attackScore-result.hitDefense);
    const die=plan.weaponId==='snp-400'?6:plan.weaponId==='t16-autoblaster-5000'?8:0;
    if(die)damage.dice.set(die,(damage.dice.get(die)||0)+Math.min(3,Math.floor(margin/3)));
    if(plan.weaponId==='scatterforce')damage.flat+=margin;
    if(plan.weaponId==='fusion-blade')damage.dice.set(8,(damage.dice.get(8)||0)+2*Math.max(0,Math.floor(number(fusions))));
    if(plan.weaponId==='viltrexian-devastator'&&result.critical){damage.dice.delete(12);damage.dice.set(20,4);}
    return {...plan,damageFormula:formatDiceFormula(damage)};
  }
  function correctedDamage(plan,total,diceResults=[]){
    if(plan?.weaponId!=='silent-scope-sniper-rifle'||!diceResults.length)return total;
    return number(total)+diceResults.reduce((sum,value)=>sum+(number(value)>=6?15-number(value):0),0);
  }

  function resolveDamage({ rolledDamage, damageReduction = 0, critical = false, calledShot = false }) {
    const rolled = Math.max(0, number(rolledDamage));
    const beforeReduction = critical && !calledShot ? rolled * 2 : rolled;
    const reduction = Math.max(0, number(damageReduction));
    return {
      rolled,
      beforeReduction,
      reduction,
      applied: Math.max(0, beforeReduction - reduction),
    };
  }

  function mappedDistance(state, attacker, defender) {
    const position=unit=>{const action=unit?.timedAction;if(action?.kind==='move'&&action.routeSegment?.length){const progress=Math.max(0,Math.min(1,1-action.remaining/Math.max(.001,action.total))),i=Math.floor(progress*action.routeSegment.length)-1;return i>=0?action.routeSegment[Math.min(i,action.routeSegment.length-1)]:action.startLocation||unit.location;}return unit?.location;};
    const a=position(attacker),b=position(defender);
    if(a?.arenaId==='surface'&&b?.arenaId==='surface'&&state.arena){const w=state.arena.width;return Math.hypot(a.square%w-b.square%w,Math.floor(a.square/w)-Math.floor(b.square/w));}
    if(!a?.starshipId||a.starshipId!==b?.starshipId||![a.square,a.mesh,b.square,b.mesh].every(Number.isInteger))return null;
    const ship=state.starships?.find(s=>s.id===a.starshipId)?.ship;
    if(!ship)return null;
    const columns=Number(ship.zoneColumns)||20;
    const x=p=>p.square%columns*3+p.mesh%3,y=p=>Math.floor(p.square/columns)*3+Math.floor(p.mesh/3);
    return Math.hypot(x(a)-x(b),y(a)-y(b));
  }
  return { heldWeapon, configureWeapon, mappedDistance, attackPlan, resolveAttack, damagePlan, correctedDamage, resolveDamage, parseDiceFormula, formatDiceFormula };
});
