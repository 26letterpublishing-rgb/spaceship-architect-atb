(function (root, factory) {
  const api = factory(() => typeof module !== "undefined" && module.exports ? require('./ship-map-core') : root?.SAShipMap);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SAHealthDisplay = api;
}(typeof window === "undefined" ? null : window, function (getMaps) {
  const shown=new Map();
  function presentation(record){
    if(!record?.id)return record;
    const now=Date.now(),old=shown.get(record.id),event=(typeof window!=='undefined'&&window.SACombatBridge?.state?.()?.starships?.flatMap(s=>s.weaponState?.reports||[])||record.weaponState?.reports||[]).filter(e=>e.impact&&e.targetId===record.id&&now-Date.parse(e.at)<4000).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
    const copy=()=>({...record,ship:{...record.ship},shieldSystems:JSON.parse(JSON.stringify(record.shieldSystems||{}))});
    if(!old){shown.set(record.id,{value:copy(),event:event?.id,until:0});return record;}
    if(event&&old.event!==event.id){old.event=event.id;old.until=now+3000;if(typeof window!=='undefined'){clearTimeout(old.timer);old.timer=setTimeout(()=>window.SACombatBridge?.requestRender?.(),3010);}}
    if(now<old.until)return {...record,currentHullHp:old.value.currentHullHp,currentShieldHp:old.value.currentShieldHp,shieldSystems:old.value.shieldSystems,shieldConditions:old.value.shieldConditions,hullCondition:old.value.hullCondition,ship:{...record.ship,currentHullHp:old.value.ship.currentHullHp}};
    old.value=copy();return record;
  }
  function hull(record,exact=false){const r=presentation(record);return track('hull',r.currentHullHp??r.ship?.currentHullHp,r.maximumHullHp??r.ship?.maximumHullHp??getMaps()?.hullHp(r.ship||r),exact);}
  function segments(current, maximum) {
    const max = Math.max(0, Number(maximum) || 0);
    const filled = max ? Math.round(Math.max(0, Math.min(max, Number(current) || 0)) / max * 6) : 0;
    return [0, 1, 2].map(index => filled >= index * 2 + 2 ? "full" : filled === index * 2 + 1 ? "half" : "empty");
  }
  function track(kind, current, maximum, exact = false) {
    const label = kind === "shield" ? "Shields" : "Hull";
    const value = `${Number(Math.max(0, Number(current) || 0).toFixed(1))}/${Number(Math.max(0, Number(maximum) || 0).toFixed(1))}`;
    return `<span class="sa-health-track" title="${label}${exact ? ` ${value}` : ""}" aria-label="${label}${exact ? ` ${value}` : " condition"}">${segments(current, maximum).map(fill => `<i class="sa-health-icon ${kind} ${fill}" aria-hidden="true"></i>`).join("")}${exact ? `<small>${value}</small>` : ""}</span>`;
  }
  function shieldLayers(record) {
    if (!record || record.contactOnly) return [];
    // Enemy contacts carry only six-step condition readings after Systems Analysis.
    if (Array.isArray(record.shieldConditions)) return record.shieldConditions.map(value => ({
      current: Math.max(0, Math.min(6, Number(value) || 0)), maximum: 6, approximate: true
    }));
    if (record.analyzedContact) return [];
    const maps = getMaps(), data = record.ship || record;
    const installed = new Set((data.placements || []).map(p => p.sicId));
    const systems = record.shieldSystems || data.shieldSystems || {};
    return (data.sicInventory || []).filter(item => installed.has(item.id) && maps?.definition(item.type).shield).map(item => {
      const maximum = Number(maps.componentDefinition(item).shieldHp) || 0;
      const unavailable = item.disabled || ['offline', 'powered-down', 'destroyed'].includes(item.status) || maps.gravityFieldActive(record);
      return {current: unavailable ? 0 : Math.max(0, Math.min(maximum, Number(systems[item.id]?.hp ?? maximum) || 0)), maximum};
    });
  }
  function shieldTracks(layers, exact = false) {
    if (!layers.length) return '';
    return `<span class="sa-shield-groups" aria-label="${layers.length} shield system${layers.length === 1 ? '' : 's'}">${layers.map((layer, index) => `<span class="sa-shield-group" role="group" aria-label="Shield system ${index + 1}">${track('shield', layer.current, layer.maximum, exact && !layer.approximate)}</span>`).join('')}</span>`;
  }
  function shields(record, exact = false) { return shieldTracks(shieldLayers(presentation(record)), exact); }
  function logText(text, exact) {
    if (exact) return String(text || "");
    return String(text || "").replace(/;?\s*HP\s*:?\s*-?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\.?/gi, "")
      .replace(/\bto\s+-?\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*HP\b/gi, "to updated health");
  }
  function logMarkup(entry,exact=false){
    const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const text=logText(entry.text,exact),refs=entry.objectRefs||[];
    const suffix=' Objects within sensor range: '+refs.map(o=>o.label).join(', ')+'.';
    if(!refs.length||!text.endsWith(suffix))return escape(text);
    return escape(text.slice(0,-suffix.length))+' Objects within sensor range: '+refs.map(o=>`<span tabindex="0" data-log-space-object="${escape(o.id)}" title="Highlight on starmap" style="color:#ffe28c;text-decoration:underline dotted;cursor:crosshair">${escape(o.label)}</span>`).join(', ')+'.';
  }
  return Object.freeze({ presentation, hull, segments, track, shieldLayers, shieldTracks, shields, logText, logMarkup });
}));
