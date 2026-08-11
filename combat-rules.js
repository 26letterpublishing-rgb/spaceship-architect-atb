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
    while ((match = pattern.exec(String(text || "")))) total += number(match[1].replace(/\\s/g, ""));
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
    const dicePattern = /([+-]?)\s*(\d+)D(\d+)\s*Damage/gi;
    while ((match = dicePattern.exec(source))) {
      const sign = match[1] === "-" ? -1 : 1;
      const sides = number(match[3]);
      parsed.dice.set(sides, (parsed.dice.get(sides) || 0) + sign * number(match[2]) * multiplier);
    }
    parsed.flat += signedBonuses(source, "Damage") * multiplier;
  }

  function formatDiceFormula(parsed) {
    const terms = [...parsed.dice.entries()]
      .filter(([, count]) => count !== 0)
      .sort((a, b) => a[0] - b[0])
      .map(([sides, count]) => `${count < 0 ? "-" : ""}${Math.abs(count)}D${sides}`);
    if (parsed.flat) terms.push(`${parsed.flat > 0 ? "+ " : "- "}${Math.abs(parsed.flat)}`);
    return terms.join(" ").replace(/^\+\s*/, "") || "0";
  }

  function attackPlan(weapon, { distance = 0, charges = 0, aimDie = 0, attackType = "ranged", strengthDice = [] } = {}) {
    const rangeText = String(weapon?.range || "");
    const baseRange = number(rangeText.match(/\d+(?:\.\d+)?/)?.[0]);
    const chargeRange = signedBonuses(weapon?.chargeBonus, "Range") * Math.max(0, number(charges));
    const effectiveRange = Math.max(0, baseRange + chargeRange);
    const units = Math.max(0, number(distance));
    const isMaximum = /\bMax\b/i.test(rangeText);
    let allowed = true;
    let attackRangeModifier = 0;
    let defenseRangeModifier = 0;
    let damageDieReduction = null;
    let rangeExplanation = "";
    let manualRange = false;

    if (attackType === "melee") {
      allowed = units <= Math.max(1, effectiveRange || 1);
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
      const bands = units > 0 ? Math.ceil(units / effectiveRange) : 0;
      attackRangeModifier = -bands;
      defenseRangeModifier = bands;
      rangeExplanation = `${bands} Range band${bands === 1 ? "" : "s"}: To-Hit ${attackRangeModifier >= 0 ? "+" : ""}${attackRangeModifier}, Defense +${defenseRangeModifier}.`;
    }

    const printedModifier = printedToHitModifier(weapon?.toHit);
    const chargeToHitModifier = signedBonuses(weapon?.chargeBonus, "To-Hit") * Math.max(0, number(charges));
    const attackModifier = printedModifier + chargeToHitModifier + attackRangeModifier;
    const strengthFormula = Array.isArray(strengthDice) && strengthDice.length
      ? strengthDice.map((sides) => `1D${number(sides)}`).join(" + ")
      : "2D4";
    const printedDamage = /All Strength Dice/i.test(String(weapon?.damage || "")) ? strengthFormula : weapon?.damage;
    const damage = parseDiceFormula(printedDamage);
    mergeDamageBonus(damage, weapon?.chargeBonus, Math.max(0, number(charges)));
    if (aimDie > 0) damage.dice.set(number(aimDie), (damage.dice.get(number(aimDie)) || 0) + 1);
    if (damageDieReduction) damage.dice.set(damageDieReduction.sides, Math.max(0, (damage.dice.get(damageDieReduction.sides) || 0) - damageDieReduction.count));
    const specialText = String(weapon?.special || "");
    const choiceRequired = /choose one/i.test(specialText);
    const manualToHit = attackType === "melee"
      ? !/^Dexterity\s*\+\s*(?:Melee|Wrestle\/Disarm)(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/i.test(String(weapon?.toHit || "").trim())
      : !/^Dexterity\s*\+\s*Projectile(?:\s*[+-]\s*\d+(?:\.\d+)?)?$/i.test(String(weapon?.toHit || "").trim());
    const criticalDamageDisabled = /critical hits do not deal double damage/i.test(specialText);

    return {
      allowed,
      manualRange,
      distance: units,
      effectiveRange,
      printedModifier,
      chargeToHitModifier,
      attackRangeModifier,
      defenseRangeModifier,
      attackModifier,
      damageFormula: damage.supported ? formatDiceFormula(damage) : String(weapon?.damage || "Resolve manually"),
      damageFormulaSupported: damage.supported && !choiceRequired && isSimpleDamageFormula(printedDamage) && !(number(charges) > 0 && /\b(?:X|See Ammo|Increase|Choose)\b/i.test(String(weapon?.chargeBonus || ""))),
      rangeExplanation,
      choiceRequired,
      manualToHit,
      criticalDamageDisabled,
      attackType,
      attackSkill: attackType === "melee" && /Wrestle\/Disarm/i.test(String(weapon?.toHit || "")) ? "Wrestle/Disarm" : attackType === "melee" ? "Melee" : "Projectile",
    };
  }

  function resolveAttack({ baseAttackScore, targetDefense, calledShot = false, plan }) {
    const attackScore = number(baseAttackScore) + number(plan?.attackModifier);
    const rangedDefense = number(targetDefense) + number(plan?.defenseRangeModifier);
    const hitDefense = rangedDefense + (calledShot ? 5 : 0);
    const hit = Boolean(plan?.allowed !== false) && attackScore >= hitDefense;
    const criticalDefense = calledShot ? rangedDefense - 5 : rangedDefense;
    const critical = hit && attackScore >= criticalDefense * 2;
    return { attackScore, rangedDefense, hitDefense, criticalDefense, hit, critical };
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

  return { attackPlan, resolveAttack, resolveDamage, parseDiceFormula, formatDiceFormula };
});
