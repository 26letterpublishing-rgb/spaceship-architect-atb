(function () {
  const dialog = document.querySelector("#combatActionDialog");
  const form = document.querySelector("#combatActionForm");
  const title = document.querySelector("#combatActionTitle");
  const summary = document.querySelector("#combatActionSummary");
  const targetWrap = document.querySelector("#combatTargetWrap");
  const target = document.querySelector("#combatTarget");
  const amountWrap = document.querySelector("#combatAmountWrap");
  const amountLabel = document.querySelector("#combatAmountLabel");
  const amount = document.querySelector("#combatAmount");
  const weaponWrap = document.querySelector("#combatWeaponWrap");
  const weapon = document.querySelector("#combatWeapon");
  const textWrap = document.querySelector("#combatTextWrap");
  const textLabel = document.querySelector("#combatTextLabel");
  const textInput = document.querySelector("#combatText");
  const attackWrap = document.querySelector("#combatAttackWrap");
  const distance = document.querySelector("#combatDistance");
  const attackScore = document.querySelector("#combatAttackScore");
  const defenseScore = document.querySelector("#combatDefenseScore");
  const damageRoll = document.querySelector("#combatDamageRoll");
  const calledShot = document.querySelector("#combatCalledShot");
  const calledShotDetailWrap = document.querySelector("#combatCalledShotDetailWrap");
  const calledShotDetail = document.querySelector("#combatCalledShotDetail");
  const attackPreview = document.querySelector("#combatAttackPreview");
  const note = document.querySelector("#combatActionNote");
  const error = document.querySelector("#combatActionError");
  const cancel = document.querySelector("#cancelCombatAction");
  const heldReadout = document.querySelector("#heldWeaponReadout");
  const actionButtons = [...document.querySelectorAll("[data-combat-action]")];

  let currentState = null;
  let currentUnit = null;
  let pendingKind = "";
  let lastLoadoutSync = "";

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function held(unit = currentUnit) {
    return (unit?.weapons || []).find((entry) => entry.inventoryId === unit.heldWeaponId) || null;
  }

  function chargeCount(unit = currentUnit) {
    const current = held(unit);
    if (!current) return 0;
    if (current.category === "melee") {
      return Math.min(Math.max(0, Number(unit?.moveSpeed) || 0), Math.max(0, Number(unit?.movementChargeUnits) || 0));
    }
    if (!unit?.weaponCharge || unit.weaponCharge.inventoryId !== current.inventoryId) return 0;
    const segments = Math.max(1, Number(current.chargeSegments) || 1);
    return Math.min(segments, Math.floor(((Number(unit.weaponCharge.progress) || 0) + 0.00001) / (100 / segments)));
  }

  function formatTime(value) {
    const seconds = Math.max(0, Number(value) || 0);
    return seconds >= 10 ? `${Math.ceil(seconds)} sec` : `${seconds.toFixed(1)} sec`;
  }

  function targetOptions({ includeLocation = false } = {}) {
    const options = [];
    if (includeLocation) options.push('<option value="__location__">Area / map location</option>');
    options.push(...(currentState?.units || [])
      .filter((entry) => entry.id !== currentUnit?.id)
      .map((entry) => `<option value="${esc(entry.id)}">${esc(entry.characterName)} (${entry.team === "pc" ? "PC" : "NPC"})</option>`));
    return options.join("") || '<option value="">No other combatants available</option>';
  }

  function weaponOptions({ throwableOnly = false, includeItem = false } = {}) {
    const options = [];
    if (includeItem) options.push('<option value="__item__">Use an item manually</option>');
    for (const entry of currentUnit?.weapons || []) {
      if (throwableOnly && !entry.throwable && !entry.placeable && entry.category !== "melee") continue;
      options.push(`<option value="${esc(entry.inventoryId)}">${esc(entry.name)}</option>`);
    }
    return options.join("");
  }

  const configurations = {
    defense: { title: "Defense", amount: "Defense Duration", min: 1, max: 15, value: 5, note: "Dodge is doubled. A Critical Success against a melee attack delays the attacker by twice the elapsed Defense time." },
    move: { title: "Move", amount: "Units Moved", min: 1, max: () => Math.max(1, Number(currentUnit?.moveSpeed) || 1), value: 1, note: "Movement takes up to 3 seconds, then grants an immediate turn. Moving clears Aim." },
    melee: { title: "Melee Attack", target: true, note: "Resolve dice at the table. Movement from the immediately previous action adds one Charge per unit." },
    wrestle: { title: "Wrestle / Disarm", target: true, note: "The GM and player resolve this nearby contest manually." },
    fire: { title: "Fire Gun", target: true, attack: true, note: "Enter the physical dice results. The app applies card, range, Charge, critical, and Damage Reduction rules." },
    calledShot: { title: "Called Shot", target: true, attack: true, calledShot: true, note: "Called Shot adds +5 Defense to hit. A critical creates the intended special effect instead of doubling Damage." },
    drawWeapon: { title: "Use Item / Draw Weapon", weapon: "all", includeItem: true, text: "Item Name (optional)", note: "Changing weapons snuffs out stored Charge and Aim." },
    throwItem: { title: "Throw Item", weapon: "throwable", target: true, includeLocation: true, note: "Explosives begin a 25-second reverse countdown. Thrown melee weapons deal half damage." },
    charge: { title: "Charge Weapon", note: "The Charge meter fills alongside normal ATB. Each completed segment provides one card Charge." },
    firstAid: { title: "First Aid", note: "Requires a First Aid Kit. Roll Intellect + Anatomy/First Aid, then add 2D8 healing. Healing cannot exceed Maximum HP." },
    station: { title: "Station", text: "SIC / Station Name", placeholder: "Helm, Engine Room, Sensor Console...", note: "Enter the SIC or station your character now operates." },
  };


  function selectedTargetUnit() {
    return (currentState?.units || []).find((entry) => entry.id === target.value) || null;
  }

  function currentAttackPlan() {
    const current = held();
    if (!current || !window.SACombatRules) return null;
    return window.SACombatRules.attackPlan(current, {
      distance: Number(distance.value) || 0,
      charges: chargeCount(),
      aimDie: Number(currentUnit?.aim?.aimDie) || 0,
    });
  }

  function signed(value) {
    const amount = Number(value) || 0;
    return `${amount >= 0 ? "+" : ""}${amount}`;
  }

  function updateAttackPreview() {
    if (!attackWrap || attackWrap.hidden) return;
    const current = held();
    const plan = currentAttackPlan();
    const defender = selectedTargetUnit();
    const called = calledShot.checked;
    calledShotDetailWrap.hidden = !called;
    if (!current || !plan) {
      attackPreview.textContent = "Choose and hold a firearm before resolving this attack.";
      return;
    }
    damageRoll.placeholder = `Roll ${plan.damageFormula}`;
    const baseAttack = Number(attackScore.value);
    const baseDefense = Number(defenseScore.value);
    const hasScores = attackScore.value !== "" && defenseScore.value !== "" && Number.isFinite(baseAttack) && Number.isFinite(baseDefense);
    const resolution = hasScores
      ? window.SACombatRules.resolveAttack({ baseAttackScore: baseAttack, targetDefense: baseDefense, calledShot: called, plan })
      : null;
    const damage = resolution?.hit && damageRoll.value !== ""
      ? window.SACombatRules.resolveDamage({ rolledDamage: Number(damageRoll.value), damageReduction: defender?.damageReduction, critical: resolution.critical, calledShot: called || plan.criticalDamageDisabled })
      : null;
    const manualWarnings = [
      plan.damageFormulaSupported ? "" : "Card has a choice or unusual Damage formula; confirm its special rule with the GM.",
      plan.manualToHit ? `Use the printed To-Hit formula: ${current.toHit}. Apply any X, Ammo, or post-roll card instructions manually.` : "",
      plan.criticalDamageDisabled ? "This card prevents Critical Hits from doubling Damage." : "",
    ].filter(Boolean);
    const formulaWarning = manualWarnings.map((warning) => `<strong class="attack-manual-warning">${esc(warning)}</strong>`).join("");
    attackPreview.innerHTML = `
      <div><span>Printed Range</span><strong>${esc(current.range || "Special")}</strong></div>
      <div><span>Range Result</span><strong class="${plan.allowed ? "" : "attack-invalid"}">${esc(plan.rangeExplanation)}</strong></div>
      <div><span>App Modifier</span><strong>To-Hit ${signed(plan.attackModifier)} | Defense ${signed(plan.defenseRangeModifier)}</strong></div>
      <div><span>Damage Dice</span><strong>${esc(plan.damageFormula)}</strong></div>
      ${formulaWarning}
      ${resolution ? `<div class="attack-resolution ${resolution.hit ? "hit" : "miss"}"><span>${resolution.hit ? resolution.critical ? called ? "CRITICAL EFFECT" : "CRITICAL HIT" : "HIT" : "MISS"}</span><strong>${resolution.attackScore} To-Hit vs ${resolution.hitDefense} Defense${damage ? ` | ${damage.applied} HP after DR ${damage.reduction}` : ""}</strong></div>` : ""}
    `;
  }

  function closeDialog() {
    pendingKind = "";
    dialog?.classList.add("hidden");
    error.textContent = "";
  }

  function openDialog(kind) {
    const config = configurations[kind];
    if (!config || !dialog || !currentUnit) return;
    pendingKind = kind;
    title.textContent = config.title;
    const current = held();
    const charges = chargeCount();
    summary.textContent = current
      ? `Held: ${current.name} | To-Hit: ${current.toHit} | Damage: ${current.damage}${charges ? ` | ${charges} Charge${charges === 1 ? "" : "s"}` : ""}`
      : "No weapon is currently held.";
    targetWrap.hidden = !config.target;
    target.innerHTML = config.target ? targetOptions({ includeLocation: config.includeLocation }) : "";
    amountWrap.hidden = !config.amount;
    if (config.amount) {
      amountLabel.textContent = config.amount;
      amount.min = String(typeof config.min === "function" ? config.min() : config.min);
      amount.max = String(typeof config.max === "function" ? config.max() : config.max);
      amount.value = String(typeof config.value === "function" ? config.value() : config.value);
    }
    weaponWrap.hidden = !config.weapon;
    weapon.innerHTML = config.weapon
      ? weaponOptions({ throwableOnly: config.weapon === "throwable", includeItem: config.includeItem })
      : "";
    textWrap.hidden = !config.text;
    textLabel.textContent = config.text || "Details";
    textInput.placeholder = config.placeholder || "";
    textInput.value = "";
    attackWrap.hidden = !config.attack;
    if (config.attack) {
      distance.value = "1";
      attackScore.value = "";
      defenseScore.value = "";
      damageRoll.value = "";
      calledShot.checked = Boolean(config.calledShot);
      calledShotDetail.value = "";
      updateAttackPreview();
    }
    note.textContent = config.note || "";
    error.textContent = "";
    dialog.classList.remove("hidden");
    const panel = dialog.querySelector(".combat-action-panel");
    if (panel) panel.scrollTop = 0;
  }

  async function send(kind, details = {}) {
    if (!currentUnit || currentState?.activeId !== currentUnit.id) return;
    await action({ action: "playerCombatAction", id: currentUnit.id, kind, ...details }, "resolve");
  }

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.combatAction;
      if (configurations[kind]) openDialog(kind);
      else send(kind);
    });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingKind) return;
    const details = {};
    if (!targetWrap.hidden) {
      if (!target.value) { error.textContent = "Choose a valid target."; return; }
      details.targetId = target.value;
    }
    if (!amountWrap.hidden) {
      const entered = Number(amount.value);
      const min = Number(amount.min);
      const max = Number(amount.max);
      if (!Number.isFinite(entered) || entered < min || entered > max) {
        error.textContent = `Enter a value from ${min} to ${max}.`;
        return;
      }
      if (pendingKind === "move") details.units = entered;
      if (pendingKind === "defense") details.seconds = entered;
    }
    let actualKind = pendingKind;
    if (!weaponWrap.hidden) {
      if (!weapon.value) {
        error.textContent = "Choose an item or weapon.";
        return;
      }
      if (pendingKind === "drawWeapon" && weapon.value === "__item__") actualKind = "useItem";
      else details.inventoryId = weapon.value;
    }
    if (!textWrap.hidden) {
      if (pendingKind === "station") details.stationName = textInput.value.trim();
      if (actualKind === "useItem") details.itemName = textInput.value.trim();
    }
    if (!attackWrap.hidden) {
      const plan = currentAttackPlan();
      const baseAttack = Number(attackScore.value);
      const targetDefense = Number(defenseScore.value);
      if (!plan?.allowed) { error.textContent = plan?.rangeExplanation || "That target is out of range."; return; }
      if (attackScore.value === "" || defenseScore.value === "" || !Number.isFinite(baseAttack) || !Number.isFinite(targetDefense)) {
        error.textContent = "Enter your rolled base To-Hit score and the target's Defense score."; return;
      }
      const resolution = window.SACombatRules.resolveAttack({ baseAttackScore: baseAttack, targetDefense, calledShot: calledShot.checked, plan });
      if (resolution.hit && (damageRoll.value === "" || !Number.isFinite(Number(damageRoll.value)) || Number(damageRoll.value) < 0)) {
        error.textContent = `Hit confirmed. Roll ${plan.damageFormula} and enter the Damage total.`; return;
      }
      details.distance = Number(distance.value) || 0;
      details.baseAttackScore = baseAttack;
      details.targetDefenseScore = targetDefense;
      details.damageRoll = resolution.hit ? Number(damageRoll.value) : 0;
      details.calledShot = calledShot.checked;
      details.calledShotDetail = calledShotDetail.value.trim();
    }
    closeDialog();
    await send(actualKind, details);
  });

  cancel?.addEventListener("click", closeDialog);
  [target, distance, attackScore, defenseScore, damageRoll, calledShot].forEach((control) => {
    control?.addEventListener("input", updateAttackPreview);
    control?.addEventListener("change", updateAttackPreview);
  });

  function renderControls({ mine, state, isMyTurn, hasPendingDelayRequest }) {
    currentState = state;
    currentUnit = mine;
    const current = held(mine);
    const charges = chargeCount(mine);
    if (heldReadout) {
      heldReadout.innerHTML = current
        ? `<span>Held Weapon</span><strong>${esc(current.name)}</strong><small>${charges}/${Math.max(0, Number(current.chargeSegments) || 0)} Charges${mine?.aim ? ` | Aim: +highest PER die to Dexterity and Damage; +${Number(mine.aim.speedBonus) || 0} Speed` : ""}</small>`
        : "<span>Held Weapon</span><strong>None</strong><small>Choose one in Supplies or use Draw Weapon.</small>";
    }
    const disabled = !isMyTurn || hasPendingDelayRequest;
    actionButtons.forEach((button) => {
      const kind = button.dataset.combatAction;
      let unavailable = disabled;
      let reason = disabled ? "Available only during your active turn." : "";
      if (kind === "charge" && (!current || current.chargeMode !== "meter" || !current.chargeSegments)) { unavailable = true; reason = "The held weapon does not use Charge."; }
      if (kind === "charge" && current?.aimRequired && !mine?.aim) { unavailable = true; reason = "Aim before charging this weapon."; }
      if (kind === "charge" && mine?.weaponCharge?.inventoryId === current?.inventoryId && Number(mine.weaponCharge.progress) >= 100) { unavailable = true; reason = "The held weapon is fully Charged."; }
      if (kind === "fire" && current?.category !== "ranged") { unavailable = true; reason = "Hold a ranged weapon to Fire Gun."; }
      if (kind === "melee" && current?.category !== "melee") { unavailable = true; reason = "Hold a melee weapon to make a Melee Attack."; }
      if (kind === "calledShot" && !["ranged", "melee"].includes(current?.category)) { unavailable = true; reason = "Hold a ranged or melee weapon to make a Called Shot."; }
      if (kind === "throwItem") {
        const canThrowMelee = (mine?.weapons || []).some((entry) => entry.category === "melee");
        const canThrowExplosive = (mine?.weapons || []).some((entry) => entry.throwable || entry.placeable);
        const explosiveCapacity = (mine?.thrownEffects || []).length < 5;
        unavailable ||= !canThrowMelee && (!canThrowExplosive || !explosiveCapacity);
        if (unavailable && !reason) reason = canThrowExplosive && !explosiveCapacity ? "Maximum five active explosive effects." : "No throwable weapon in Supplies.";
      }
      if (kind === "drawWeapon") unavailable ||= !(mine?.weapons || []).length;
      button.disabled = Boolean(unavailable);
      button.title = unavailable ? reason : button.textContent.trim();
    });
  }

  function syncCampaignLoadout(record, unit) {
    if (!record?.character || !unit) return;
    const rows = (record.character.weapons || []).flatMap((entry) => entry?.weaponId
      ? [{ inventoryId: String(entry.id || entry.weaponId), weaponId: entry.weaponId }]
      : []);
    const heldEntry = (record.character.weapons || []).find((entry) => entry?.held && entry?.weaponId);
    const boxes = (key) => (record.character.attributes?.[key] || []).reduce((sum, row) => sum + Math.max(0, Number(row) + 1), 0);
    const highestDie = (key) => Math.max(0, ...(record.character.attributes?.[key] || [])
      .filter((value) => Number(value) >= 0)
      .map((value) => [4, 6, 8, 10, 12][Number(value)] || 0));
    const payload = {
      action: "syncCharacterLoadout",
      id: unit.id,
      weapons: rows,
      heldWeaponId: heldEntry ? String(heldEntry.id || heldEntry.weaponId) : "",
      dexterityBoxes: boxes("dexterity"),
      highestPerceptionDie: highestDie("perception"),
      moveSpeed: Math.max(1, Number(record.character.computed?.moveSpeed) || 1),
      weaponMechanics: Math.max(0, Number(record.character.skills?.["Weapon Mechanics"]?.tenths) || 0) / 10,
      dexterityDice: (record.character.attributes?.dexterity || []).filter((value) => Number(value) >= 0).map((value) => [4, 6, 8, 10, 12][Number(value)] || 0).filter(Boolean),
      projectileSkill: Math.max(0, Number(record.character.skills?.Projectile?.tenths) || 0) / 10,
      damageReduction: Math.max(0, Number(record.character.computed?.damageReduction) || 0),
      maximumHp: Math.max(0, Number(record.character.computed?.maximumHp) || 0),
      currentHp: Number.isFinite(Number(record.character.health?.current)) ? Number(record.character.health.current) : Number(record.character.computed?.maximumHp) || 0,
    };
    const signature = JSON.stringify(payload);
    if (signature === lastLoadoutSync) return;
    lastLoadoutSync = signature;
    action(payload).catch(() => {});
  }

  function statusMarkup(unit) {
    const current = held(unit);
    const timed = unit?.timedAction;
    const charge = unit?.weaponCharge && current?.inventoryId === unit.weaponCharge.inventoryId ? unit.weaponCharge : null;
    const thrown = unit?.thrownEffects || [];
    const pieces = [];
    const aimText = unit?.aim ? `Aim +${Number(unit.aim.speedBonus) || 0} Speed${unit.aim.aimDie ? ` / 1D${unit.aim.aimDie}` : ""}` : "";
    pieces.push(`<div class="combat-loadout-line"><span>Held</span><strong>${esc(current?.name || "None")}</strong>${aimText ? `<i>${esc(aimText)}</i>` : ""}${unit?.movementChargeUnits ? `<i>${Number(unit.movementChargeUnits)} Move Charge</i>` : ""}</div>`);
    if (timed) {
      const percent = Math.max(0, Math.min(100, (Number(timed.remaining) / Math.max(0.1, Number(timed.total))) * 100));
      const elapsed = Math.max(0, (Number(timed.total) || 0) - (Number(timed.remaining) || 0));
      const timerText = timed.kind === "defense"
        ? `${timed.label} - ${formatTime(timed.remaining)} | Dodge x2 | Crit Counter Delay ${Math.ceil(elapsed * 20) / 10} sec`
        : `${timed.label} - ${formatTime(timed.remaining)}`;
      pieces.push(`<div class="combat-submeter timed-action-meter ${timed.kind === "defense" ? "defense-active" : ""}" data-combat-meter="timed"><div style="width:${percent}%"></div><span>${esc(timerText)}</span></div>`);
    }
    if (charge && current) {
      const progress = Math.max(0, Math.min(100, Number(charge.progress) || 0));
      pieces.push(`<div class="combat-submeter weapon-charge-meter ${chargeCount(unit) ? "has-charge" : ""} ${progress >= 100 ? "fully-charged" : ""}" data-combat-meter="charge" style="--segments:${Math.max(1, Number(current.chargeSegments) || 1)}"><div style="width:${progress}%"></div><span>${esc(current.name)} Charge - ${chargeCount(unit)}/${Math.max(1, Number(current.chargeSegments) || 1)} | ${esc(current.chargeBonus || "Card bonus")}</span></div>`);
    }
    for (const effect of thrown) {
      const percent = Math.max(0, Math.min(100, (Number(effect.remaining) / Math.max(0.1, Number(effect.total))) * 100));
      pieces.push(`<div class="combat-submeter thrown-effect-meter ${effect.resolving ? "resolving" : ""}" data-combat-meter="thrown" data-effect-id="${esc(effect.id)}"><div style="width:${percent}%"></div><span>${esc(effect.label)} - ${effect.resolving ? "DETONATE" : formatTime(effect.remaining)}</span></div>`);
    }
    return `<div class="combat-status-stack">${pieces.join("")}</div>`;
  }

  function structureSignature(unit) {
    return [
      unit?.heldWeaponId || "none",
      unit?.aim ? "aim" : "noaim",
      unit?.timedAction?.kind || "notimed",
      unit?.weaponCharge?.inventoryId || "nocharge",
      chargeCount(unit),
      ...(unit?.thrownEffects || []).map((entry) => entry.id),
    ].join("|");
  }

  function updateCard(card, unit) {
    const timed = card.querySelector('[data-combat-meter="timed"]');
    if (timed && unit.timedAction) {
      const percent = Math.max(0, Math.min(100, (Number(unit.timedAction.remaining) / Math.max(0.1, Number(unit.timedAction.total))) * 100));
      timed.querySelector("div").style.width = `${percent}%`;
      const elapsed = Math.max(0, (Number(unit.timedAction.total) || 0) - (Number(unit.timedAction.remaining) || 0));
      timed.querySelector("span").textContent = unit.timedAction.kind === "defense"
        ? `${unit.timedAction.label} - ${formatTime(unit.timedAction.remaining)} | Dodge x2 | Crit Counter Delay ${Math.ceil(elapsed * 20) / 10} sec`
        : `${unit.timedAction.label} - ${formatTime(unit.timedAction.remaining)}`;
    }
    const charge = card.querySelector('[data-combat-meter="charge"]');
    if (charge && unit.weaponCharge) {
      charge.querySelector("div").style.width = `${Math.max(0, Math.min(100, Number(unit.weaponCharge.progress) || 0))}%`;
      const current = held(unit);
      charge.querySelector("span").textContent = `${current?.name || "Weapon"} Charge - ${chargeCount(unit)}/${Math.max(1, Number(current?.chargeSegments) || 1)}`;
      charge.classList.toggle("has-charge", chargeCount(unit) > 0);
      charge.classList.toggle("fully-charged", Number(unit.weaponCharge.progress) >= 100);
    }
    for (const effect of unit.thrownEffects || []) {
      const meter = card.querySelector(`[data-effect-id="${CSS.escape(effect.id)}"]`);
      if (!meter) continue;
      const percent = Math.max(0, Math.min(100, (Number(effect.remaining) / Math.max(0.1, Number(effect.total))) * 100));
      meter.querySelector("div").style.width = `${percent}%`;
      meter.querySelector("span").textContent = `${effect.label} - ${effect.resolving ? "DETONATE" : formatTime(effect.remaining)}`;
      meter.classList.toggle("resolving", Boolean(effect.resolving));
    }
  }

  window.SACombatActions = {
    render: renderControls,
    statusMarkup,
    structureSignature,
    syncCampaignLoadout,
    updateCard,
  };
})();
