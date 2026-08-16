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
  const consumeWrap = document.querySelector("#combatConsumeWrap");
  const consume = document.querySelector("#combatConsume");
  const useKitWrap = document.querySelector("#combatUseKitWrap");
  const useKit = document.querySelector("#combatUseKit");
  const jetPackWrap = document.querySelector("#combatJetPackWrap");
  const jetPack = document.querySelector("#combatJetPack");
  const jetPackCharges = document.querySelector("#combatJetPackCharges");
  const shieldWrap = document.querySelector("#combatShieldWrap");
  const shieldTargets = document.querySelector("#combatShieldTargets");
  const smokeWrap = document.querySelector("#combatSmokeWrap");
  const smokeAffected = document.querySelector("#combatSmokeAffected");
  const smokePenaltyText = document.querySelector("#combatSmokePenaltyText");
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
  const heldReadouts = [...document.querySelectorAll("#heldWeaponReadout, [data-held-weapon-readout]")];
  const actionButtons = [...document.querySelectorAll("[data-combat-action]")];

  let currentState = null;
  let currentUnit = null;
  let pendingKind = "";
  let lastLoadoutSync = "";
  let actionSubmitting = false;

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
      const printed = Number(current.maxCharge);
      const limit = Number.isFinite(printed) && printed > 0 ? Math.min(Number(unit?.moveSpeed) || 0, printed) : Number(unit?.moveSpeed) || 0;
      return Math.min(Math.max(0, limit), Math.max(0, Number(unit?.movementChargeUnits) || 0));
    }
    if (!unit?.weaponCharge || unit.weaponCharge.inventoryId !== current.inventoryId) return 0;
    const segments = Math.max(1, Number(current.chargeSegments) || 1);
    return Math.min(segments, Math.floor(((Number(unit.weaponCharge.progress) || 0) + 0.00001) / (100 / segments)));
  }

  function formatTime(value) {
    const seconds = Math.max(0, Number(value) || 0);
    return seconds >= 10 ? `${Math.ceil(seconds)} sec` : `${seconds.toFixed(1)} sec`;
  }

  function targetOptions({ includeLocation = false, includeSelf = false } = {}) {
    const options = [];
    if (includeLocation) options.push('<option value="__location__">Area / map location</option>');
    options.push(...(currentState?.units || [])
      .filter((entry) => (includeSelf || entry.id !== currentUnit?.id) && !entry.defeatedAt)
      .map((entry) => `<option value="${esc(entry.id)}">${esc(entry.characterName)} (${entry.team === "pc" ? "PC" : "NPC"})</option>`));
    return options.join("") || '<option value="">No other combatants available</option>';
  }

  function weaponOptions({ throwableOnly = false, includeItems = false, station = false } = {}) {
    const options = [];
    if (station) {
      options.push('<option value="manual">SIC / Ship Station</option>');
      if (currentUnit?.mountedVehicleId) options.push('<option value="dismount">Dismount current vehicle</option>');
      const occupiedVehicle = (currentState?.vehicles || []).find((entry) => entry.id === currentUnit?.mountedVehicleId);
      if (occupiedVehicle && !occupiedVehicle.driverId) options.push(`<option value="vehicle-drive:${esc(occupiedVehicle.id)}">Take driver seat of ${esc(occupiedVehicle.name)}</option>`);
      for (const entry of currentUnit?.items || []) {
        if (["one-man-vehicle", "small-atv"].includes(entry.catalogId)) options.push(`<option value="vehicle-item:${esc(entry.id)}">Mount ${esc(entry.name)} as driver</option>`);
      }
      for (const vehicle of currentState?.vehicles || []) {
        if (vehicle.itemCatalogId === "small-atv" && !vehicle.occupantIds?.includes(currentUnit?.id) && Number(vehicle.occupantIds?.length || 0) < Number(vehicle.seats || 0)) {
          options.push(`<option value="vehicle-join:${esc(vehicle.id)}">Ride in ${esc(vehicle.name)} (passenger)</option>`);
        }
      }
      return options.join("");
    }
    for (const entry of currentUnit?.weapons || []) {
      if (throwableOnly && !entry.throwable && !entry.placeable && entry.category !== "melee") continue;
      options.push(`<option value="weapon:${esc(entry.inventoryId)}">Weapon: ${esc(entry.name)}</option>`);
    }
    if (includeItems) {
      for (const entry of currentUnit?.items || []) {
        if (throwableOnly && entry.catalogId !== "smoke-grenade") continue;
        options.push(`<option value="item:${esc(entry.id)}">Item: ${esc(entry.name)} (x${Number(entry.quantity) || 0})</option>`);
      }
    }
    return options.join("");
  }

  function selectedCarriedItem() {
    if (!weapon.value.startsWith("item:")) return null;
    const itemId = weapon.value.slice(5);
    return (currentUnit?.items || []).find((entry) => entry.id === itemId) || null;
  }

  function selectedVehicle() {
    return (currentState?.vehicles || []).find((entry) => entry.id === currentUnit?.mountedVehicleId) || null;
  }

  function updateItemControls() {
    const item = selectedCarriedItem();
    const usingItem = pendingKind === "drawWeapon" && Boolean(item);
    consumeWrap.hidden = !usingItem || item?.catalogId === "power-shields";
    consume.checked = usingItem && ["intoxicating-liquid", "smoke-grenade"].includes(item?.catalogId);
    shieldWrap.hidden = !(usingItem && item?.catalogId === "power-shields" && !currentUnit?.powerShield?.active);
    if (!shieldWrap.hidden) {
      shieldTargets.innerHTML = (currentState?.units || []).filter((entry) => !entry.defeatedAt).map((entry) =>
        `<label><input type="checkbox" value="${esc(entry.id)}" ${entry.id === currentUnit.id ? "checked disabled" : ""} /> ${esc(entry.characterName)}</label>`).join("");
    }
    if (usingItem) {
      note.textContent = item.catalogId === "power-shields"
        ? currentUnit?.powerShield?.active ? "Deactivate the current shield. Remaining Shield HP is retained until recharged." : "Select every character currently inside the stationary shield."
        : item.description || "Choose whether using this item consumes one unit.";
    } else if (pendingKind === "drawWeapon") note.textContent = configurations.drawWeapon.note;
  }

  const configurations = {
    defense: { title: "Defense", amount: "Defense Duration", min: 1, max: 15, value: 5, note: "Dodge is doubled. A Critical Success against a melee attack delays the attacker by twice the elapsed Defense time." },
    move: { title: "Move", amount: "Units Moved", min: 1, max: () => {
      const vehicle = selectedVehicle();
      return Math.max(1, jetPack?.checked ? 4 : vehicle?.driverId === currentUnit?.id ? Number(vehicle.currentMoveSpeed) || 1 : Number(currentUnit?.moveSpeed) || 1);
    }, value: 1, jetPack: true, note: "Movement takes up to 3 seconds, then grants an immediate turn. Moving clears Aim." },
    melee: { title: "Melee Attack", target: true, attack: true, melee: true, note: "Movement from the immediately previous action adds one Charge per unit, limited by Move Speed and the card's Max Charge." },
    wrestle: { title: "Wrestle / Disarm", target: true, note: "The GM and player resolve this nearby contest manually." },
    fire: { title: "Fire Gun", target: true, attack: true, note: "Choose the target and distance. The attacker and defender will receive simultaneous roll prompts." },
    calledShot: { title: "Called Shot", target: true, attack: true, calledShot: true, note: "Called Shot adds +5 Defense to hit. A critical creates the intended special effect instead of doubling Damage." },
    drawWeapon: { title: "Use Item / Draw Weapon", weapon: "all", includeItems: true, note: "Choose a carried item or ready a weapon. Stored items do not appear here." },
    throwItem: { title: "Throw Item", weapon: "throwable", target: true, includeLocation: true, includeItems: true, note: "Smoke Grenades detonate after 5 seconds. Other explosives use their listed countdown. Thrown melee weapons deal half damage." },
    charge: { title: "Charge Weapon", note: "The Charge meter fills alongside normal ATB. Each completed segment provides one card Charge." },
    firstAid: { title: "First Aid", target: true, includeSelf: true, kit: true, note: "Choose the patient and whether to commit a carried First Aid Kit. Treatment time uses Intellect boxes + Anatomy/First Aid." },
    station: { title: "Station / Mount", weapon: "station", text: "SIC / Station Name", placeholder: "Helm, Engine Room, Sensor Console...", note: "Mount a carried vehicle, join an available Small ATV, dismount, or enter a ship station." },
  };


  function selectedTargetUnit() {
    return (currentState?.units || []).find((entry) => entry.id === target.value) || null;
  }

  function currentAttackPlan() {
    const current = held();
    if (!current || !window.SACombatRules) return null;
    return window.SACombatRules.attackPlan(current, {
      distance: current?.category === "melee" ? 1 : Number(distance.value) || 0,
      charges: chargeCount(),
      aimDie: current?.category === "ranged" ? Number(currentUnit?.aim?.aimDie) || 0 : 0,
      attackType: current?.category === "melee" ? "melee" : "ranged",
      strengthDice: currentUnit?.strengthDice || [],
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
    const called = calledShot.checked;
    calledShotDetailWrap.hidden = !called;
    if (!current || !plan) {
      attackPreview.textContent = "Choose and hold a firearm before resolving this attack.";
      return;
    }
    const manualWarnings = [
      plan.damageFormulaSupported ? "" : "This card has an unusual Damage formula; the GM may need to finish it manually.",
      plan.manualToHit ? "The printed To-Hit formula is unusual. Confirm any X, Ammo, or post-roll instructions with the GM." : "",
      plan.criticalDamageDisabled ? "This card prevents Critical Hits from doubling Damage." : "",
    ].filter(Boolean);
    const formulaWarning = manualWarnings.map((warning) => '<strong class="attack-manual-warning">' + esc(warning) + '</strong>').join("");
    attackPreview.innerHTML =
      '<div><span>Printed Range</span><strong>' + esc(current.range || "Special") + '</strong></div>' +
      '<div><span>Range Result</span><strong class="' + (plan.allowed ? "" : "attack-invalid") + '">' + esc(plan.rangeExplanation) + '</strong></div>' +
      '<div><span>Automatic Modifier</span><strong>To-Hit ' + signed(plan.attackModifier) + ' | Defense ' + signed(plan.defenseRangeModifier) + '</strong></div>' +
      '<div><span>Damage Dice</span><strong>' + esc(plan.damageFormula) + '</strong></div>' +
      formulaWarning;
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
    target.innerHTML = config.target ? targetOptions({ includeLocation: config.includeLocation, includeSelf: config.includeSelf }) : "";
    amountWrap.hidden = !config.amount;
    if (config.amount) {
      amountLabel.textContent = config.amount;
      amount.min = String(typeof config.min === "function" ? config.min() : config.min);
      amount.max = String(typeof config.max === "function" ? config.max() : config.max);
      amount.value = String(typeof config.value === "function" ? config.value() : config.value);
    }
    weaponWrap.hidden = !config.weapon;
    weapon.innerHTML = config.weapon
      ? weaponOptions({ throwableOnly: config.weapon === "throwable", includeItems: config.includeItems, station: config.weapon === "station" })
      : "";
    consumeWrap.hidden = true;
    consume.checked = false;
    useKitWrap.hidden = !config.kit;
    useKit.checked = Boolean(config.kit && (currentUnit?.items || []).some((entry) => entry.catalogId === "first-aid-kit"));
    useKit.disabled = Boolean(config.kit && !(currentUnit?.items || []).some((entry) => entry.catalogId === "first-aid-kit"));
    jetPackWrap.hidden = !config.jetPack || !(currentUnit?.items || []).some((entry) => entry.catalogId === "jet-pack" && Number(entry.charges) > 0);
    jetPack.checked = false;
    const jetItem = (currentUnit?.items || []).find((entry) => entry.catalogId === "jet-pack");
    jetPackCharges.textContent = jetItem ? `(${Number(jetItem.charges) || 0}/${Number(jetItem.chargesMax) || 30})` : "";
    shieldWrap.hidden = true;
    textWrap.hidden = !config.text;
    textLabel.textContent = config.text || "Details";
    textInput.placeholder = config.placeholder || "";
    textInput.value = "";
    attackWrap.hidden = !config.attack;
    const activeSmoke = (currentState?.areaEffects || []).find((entry) => entry.kind === "smoke" && Number(entry.penalty) > 0);
    smokeWrap.hidden = !config.attack || Boolean(config.melee) || !activeSmoke;
    smokeAffected.checked = Boolean(activeSmoke);
    smokePenaltyText.textContent = activeSmoke ? `Apply -${Number(activeSmoke.penalty)} to this Projectile roll if the attack passes through its 6-unit smoke zone.` : "";
    if (config.attack) {
      distance.value = "1";
      distance.closest("label").hidden = Boolean(config.melee);
      calledShot.checked = Boolean(config.calledShot);
      calledShotDetail.value = "";
      updateAttackPreview();
    }
    note.textContent = config.note || "";
    updateItemControls();
    error.textContent = "";
    dialog.classList.remove("hidden");
    const panel = dialog.querySelector(".combat-action-panel");
    if (panel) panel.scrollTop = 0;
  }

  async function send(kind, details = {}) {
    if (actionSubmitting || !currentUnit || currentState?.activeId !== currentUnit.id) return;
    actionSubmitting = true;
    actionButtons.forEach((button) => { button.disabled = true; });
    form?.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = true; });
    try {
      await action({ action: "playerCombatAction", id: currentUnit.id, kind, ...details }, "resolve");
    } finally {
      actionSubmitting = false;
      form?.querySelectorAll("button, input, select, textarea").forEach((control) => { control.disabled = false; });
      renderControls({
        mine: currentUnit,
        state: currentState,
        isMyTurn: currentState?.activeId === currentUnit?.id,
        hasPendingDelayRequest: Boolean(currentState?.delayRequest),
      });
    }
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
      if (pendingKind === "move") { details.units = entered; details.jetPack = Boolean(jetPack.checked); }
      if (pendingKind === "defense") details.seconds = entered;
    }
    let actualKind = pendingKind;
    if (!weaponWrap.hidden) {
      if (!weapon.value) { error.textContent = "Choose an item, weapon, vehicle, or station."; return; }
      if (pendingKind === "drawWeapon") {
        if (weapon.value.startsWith("item:")) { actualKind = "useItem"; details.itemId = weapon.value.slice(5); details.consume = Boolean(consume.checked); details.protectedIds = [...shieldTargets.querySelectorAll("input:checked")].map((input) => input.value); }
        else if (weapon.value.startsWith("weapon:")) details.inventoryId = weapon.value.slice(7);
      } else if (pendingKind === "station") {
        if (weapon.value === "dismount") details.stationMode = "dismount";
        else if (weapon.value.startsWith("vehicle-item:")) { details.stationMode = "mountItem"; details.itemId = weapon.value.slice(13); }
        else if (weapon.value.startsWith("vehicle-join:")) { details.stationMode = "joinVehicle"; details.vehicleId = weapon.value.slice(13); }
        else if (weapon.value.startsWith("vehicle-drive:")) { details.stationMode = "takeDriver"; details.vehicleId = weapon.value.slice(14); }
        else details.stationMode = "manual";
      } else if (weapon.value.startsWith("weapon:")) details.inventoryId = weapon.value.slice(7);
      else if (pendingKind === "throwItem" && weapon.value.startsWith("item:")) details.itemId = weapon.value.slice(5);
    }
    if (!textWrap.hidden && pendingKind === "station") details.stationName = textInput.value.trim();
    if (pendingKind === "firstAid") details.useKit = Boolean(useKit.checked);
    if (!attackWrap.hidden) {
      const plan = currentAttackPlan();
      if (!plan?.allowed) {
        error.textContent = plan?.rangeExplanation || "That target is out of range.";
        return;
      }
      details.distance = Number(distance.value) || 0;
      details.calledShot = calledShot.checked;
      details.calledShotDetail = calledShotDetail.value.trim();
      details.smokePenalty = !smokeWrap.hidden && smokeAffected.checked ? Number((currentState?.areaEffects || []).find((entry) => entry.kind === "smoke")?.penalty) || 0 : 0;
    }
    closeDialog();
    await send(actualKind, details);
  });

  cancel?.addEventListener("click", closeDialog);
  weapon?.addEventListener("change", updateItemControls);
  jetPack?.addEventListener("change", () => {
    if (pendingKind !== "move") return;
    amount.max = String(configurations.move.max());
    amount.value = String(Math.min(Number(amount.value) || 1, Number(amount.max)));
    note.textContent = jetPack.checked ? "FLIGHT: Move Speed 4. This spends one Jet-Pack charge." : configurations.move.note;
  });
  [target, distance, calledShot].forEach((control) => {
    control?.addEventListener("input", updateAttackPreview);
    control?.addEventListener("change", updateAttackPreview);
  });

  function renderControls({ mine, state, isMyTurn, hasPendingDelayRequest }) {
    currentState = state;
    currentUnit = mine;
    const current = held(mine);
    const charges = chargeCount(mine);
    heldReadouts.forEach((heldReadout) => {
      const chargeReadout = current?.category === "melee"
        ? `${charges}/${Math.max(0, Math.min(Number(mine?.moveSpeed) || 0, Number.isFinite(Number(current.maxCharge)) ? Number(current.maxCharge) : Number(mine?.moveSpeed) || 0))} Move Charges`
        : `${charges}/${Math.max(0, Number(current?.chargeSegments) || 0)} Charges`;
      heldReadout.innerHTML = current
        ? `<span>Held Weapon</span><strong>${esc(current.name)}</strong><small>${chargeReadout}${mine?.aim ? ` | Aim: +highest PER die to Dexterity and Damage; +${Number(mine.aim.speedBonus) || 0} Speed` : ""}</small>`
        : "<span>Held Weapon</span><strong>None</strong><small>Choose one in Supplies or use Draw Weapon.</small>";
    });
    const disabled = actionSubmitting || !isMyTurn || hasPendingDelayRequest;
    actionButtons.forEach((button) => {
      const kind = button.dataset.combatAction;
      let unavailable = disabled;
      let reason = disabled ? "Available only during your active turn." : "";
      if (kind === "charge" && (!current || current.chargeMode !== "meter" || !current.chargeSegments)) { unavailable = true; reason = "The held weapon does not use Charge."; }
      if (kind === "charge" && current?.aimRequired && !mine?.aim) { unavailable = true; reason = "Aim before charging this weapon."; }
      if (kind === "charge" && mine?.weaponCharge && current && mine.weaponCharge.inventoryId === current.inventoryId && Number(mine.weaponCharge.progress) >= 100) { unavailable = true; reason = "The held weapon is fully Charged."; }
      if (kind === "fire" && current?.category !== "ranged") { unavailable = true; reason = "Hold a ranged weapon to Fire Gun."; }
      if (kind === "melee" && current?.category !== "melee") { unavailable = true; reason = "Hold a melee weapon to make a Melee Attack."; }
      if (kind === "calledShot" && !["ranged", "melee"].includes(current?.category)) { unavailable = true; reason = "Hold a ranged or melee weapon to make a Called Shot."; }
      if (kind === "throwItem") {
        const canThrowMelee = (mine?.weapons || []).some((entry) => entry.category === "melee");
        const canThrowExplosive = (mine?.weapons || []).some((entry) => entry.throwable || entry.placeable) || (mine?.items || []).some((entry) => entry.catalogId === "smoke-grenade");
        const explosiveCapacity = (mine?.thrownEffects || []).length < 5;
        unavailable ||= !canThrowMelee && (!canThrowExplosive || !explosiveCapacity);
        if (unavailable && !reason) reason = canThrowExplosive && !explosiveCapacity ? "Maximum five active explosive effects." : "No throwable weapon in Supplies.";
      }
      if (kind === "drawWeapon") unavailable ||= !(mine?.weapons || []).length && !(mine?.items || []).length;
      const vehicle = (state?.vehicles || []).find((entry) => entry.id === mine?.mountedVehicleId);
      if (kind === "move" && mine?.powerShield?.active) { unavailable = true; reason = "Deactivate Power Shields before moving."; }
      if (kind === "move" && vehicle && vehicle.driverId !== mine.id) { unavailable = true; reason = "Passengers cannot choose Move; the driver controls the vehicle."; }
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
      meleeSkill: Math.max(0, Number(record.character.skills?.Melee?.tenths) || 0) / 10,
      dodgeSkill: Math.max(0, Number(record.character.skills?.["Dodge/Block"]?.tenths) || 0) / 10,
      strengthDice: (record.character.attributes?.strength || []).filter((value) => Number(value) >= 0).map((value) => [4, 6, 8, 10, 12][Number(value)] || 0).filter(Boolean),
      damageReduction: Math.max(0, Number(record.character.computed?.damageReduction) || 0),
      maximumHp: Math.max(0, Number(record.character.computed?.maximumHp) || 0),
      currentHp: Number.isFinite(Number(record.character.health?.current)) ? Number(record.character.health.current) : Number(record.character.computed?.maximumHp) || 0,
      items: (record.character.items || []).map((entry) => ({ id: entry.id, catalogId: entry.catalogId, name: entry.name, description: entry.description, quantity: entry.quantity, unitCost: entry.unitCost, charges: entry.charges, chargesMax: entry.chargesMax, chargeState: entry.chargeState, special: entry.special })),
      intellectBoxes: boxes("intellect"),
      intellectDice: (record.character.attributes?.intellect || []).filter((value) => Number(value) >= 0).map((value) => [4, 6, 8, 10, 12][Number(value)] || 0).filter(Boolean),
      anatomySkill: Math.max(0, Number(record.character.skills?.["Anatomy/First Aid"]?.tenths) || 0) / 10,
      statuses: { ...(record.character.statuses || {}) },
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
    pieces.push(`<div class="combat-loadout-line"><span>Held</span><strong>${esc(current?.name || "None")}</strong>${aimText ? `<i>${esc(aimText)}</i>` : ""}${unit?.movementChargeUnits ? `<i>${Number(unit.movementChargeUnits)} Move Charge</i>` : ""}${unit?.statuses?.intoxicated ? '<i class="combat-status-drunk">STILL DRUNK</i>' : ""}</div>`);
    if (unit?.powerShield) {
      const shieldPercent = Math.max(0, Math.min(100, (Number(unit.powerShield.hp) / Math.max(1, Number(unit.powerShield.maximumHp) || 30)) * 100));
      pieces.push(`<div class="combat-submeter power-shield-meter ${unit.powerShield.active ? "active" : "inactive"} ${unit.powerShield.collapsedAt ? "collapsed" : ""}" data-combat-meter="shield"><div style="width:${shieldPercent}%"></div><span>POWER SHIELDS - ${Number(unit.powerShield.hp) || 0}/${Number(unit.powerShield.maximumHp) || 30} HP${unit.powerShield.active ? "" : " (OFFLINE)"}</span></div>`);
    }
    const vehicle = (currentState?.vehicles || []).find((entry) => entry.id === unit?.mountedVehicleId);
    if (vehicle) pieces.push(`<div class="combat-vehicle-state">${esc(vehicle.name)} - ${vehicle.driverId === unit.id ? `DRIVER / MOVE ${vehicle.currentMoveSpeed}` : "PASSENGER"}</div>`);
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
      const segments = Math.max(1, Number(current.chargeSegments) || 1);
      const earned = Math.min(100, Math.floor((progress + .0001) / (100 / segments)) * (100 / segments));
      pieces.push(`<div class="combat-submeter weapon-charge-meter ${earned ? "has-charge" : ""} ${progress >= 100 ? "fully-charged" : ""}" data-combat-meter="charge" style="--segments:${segments}"><div class="charge-progress" style="width:${progress}%"></div><div class="charge-earned" style="width:${earned}%"></div><span>${esc(current.name)} Charge - ${chargeCount(unit)}/${segments} | ${esc(current.chargeBonus || "Card bonus")}</span></div>`);
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
      unit?.powerShield ? `shield:${unit.powerShield.active}:${unit.powerShield.hp}:${unit.powerShield.collapsedAt || 0}` : "noshield",
      unit?.mountedVehicleId || "novehicle",
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
    const shield = card.querySelector('[data-combat-meter="shield"]');
    if (shield && unit.powerShield) {
      const percent = Math.max(0, Math.min(100, (Number(unit.powerShield.hp) / Math.max(1, Number(unit.powerShield.maximumHp) || 30)) * 100));
      shield.querySelector("div").style.width = `${percent}%`;
      shield.querySelector("span").textContent = `POWER SHIELDS - ${Number(unit.powerShield.hp) || 0}/${Number(unit.powerShield.maximumHp) || 30} HP${unit.powerShield.active ? "" : " (OFFLINE)"}`;
      shield.classList.toggle("active", Boolean(unit.powerShield.active));
      shield.classList.toggle("inactive", !unit.powerShield.active);
      shield.classList.toggle("collapsed", Boolean(unit.powerShield.collapsedAt));
    }
    const charge = card.querySelector('[data-combat-meter="charge"]');
    if (charge && unit.weaponCharge) {
      const current = held(unit);
      const progress = Math.max(0, Math.min(100, Number(unit.weaponCharge.progress) || 0));
      const segments = Math.max(1, Number(current?.chargeSegments) || 1);
      const earned = Math.min(100, Math.floor((progress + .0001) / (100 / segments)) * (100 / segments));
      charge.querySelector(".charge-progress").style.width = `${progress}%`;
      charge.querySelector(".charge-earned").style.width = `${earned}%`;
      charge.querySelector("span").textContent = `${current?.name || "Weapon"} Charge - ${chargeCount(unit)}/${Math.max(1, Number(current?.chargeSegments) || 1)}`;
      charge.classList.toggle("has-charge", earned > 0);
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
