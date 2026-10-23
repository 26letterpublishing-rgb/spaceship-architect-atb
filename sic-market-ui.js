// Extracted from the original starship purchasing interface. Both locations use this implementation.
(function(){
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatCredits=v=>Number(v||0).toLocaleString();
const reducedCardMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function cardAccent(type) {
  if (type === "life-support") return "#42e0d0";
  if (type === "nutritional-supplement") return "#e9ef4d";
  return ["#82ddff", "#b58aff", "#679dff", "#52edcb", "#ff6679", "#cc87ff", "#e9c877", "#e8f6ff"][(Number(type.match(/\d+$/)?.[0]) || 1) - 1]||'#8fffbf';
}
function previewSicCard(source) {
  const card = source.cloneNode(true);
  card.dataset.sicPreview = source.dataset.sicCard || source.dataset.sicPreview;
  card.removeAttribute("data-sic-card"); card.removeAttribute("tabindex"); card.removeAttribute("aria-label");
  card.querySelectorAll("button,[id]").forEach(node => node.matches("button") ? node.remove() : node.removeAttribute("id"));
  return card;
}


function categoryHosts(items,container,typeFor,variant,catalog){const SIC_CATALOG=catalog;
  const hosts=new Map(),entries=items.map(value=>({type:typeFor(value),value}));
  for(const group of window.SASicCategories.group(entries,entry=>SIC_CATALOG[entry.type]||window.SAShipMap.definition(entry.type))){
    const section=document.createElement('fieldset');section.className=`sic-category sic-category-${variant}`;section.dataset.sicCategory=group.id;section.style.setProperty('--category-color',group.color);section.style.setProperty('--category-count',Math.min(4,group.items.length));
    const legend=document.createElement('legend'),toggle=document.createElement('button');toggle.type='button';legend.append(toggle);
    const body=document.createElement('div');body.className='sic-category-body';section.append(legend,body);container.append(section);
    const key='sa-sic-category-'+variant+'-'+group.id;const setClosed=closed=>{body.hidden=closed;toggle.textContent=group.label+' '+(closed?'+':'−');toggle.setAttribute('aria-expanded',String(!closed));};setClosed(variant==='market'?sessionStorage.getItem(key)!=='open':sessionStorage.getItem(key)==='closed');toggle.onclick=()=>{setClosed(!body.hidden);sessionStorage.setItem(key,body.hidden?'closed':'open');};
    group.items.forEach(entry=>hosts.set(entry.value,body));
  }
  return hosts;
}
function create(options){
const market=options.market,SIC_CATALOG=options.catalog,cardHost=options.document||document;
let activeFamilyDialog=null,disposeFamilyDialog=null;
const sicCategoryHosts=(items,container,typeFor,variant)=>categoryHosts(items,container,typeFor,variant,SIC_CATALOG);
const openSicCard=(source,trigger)=>options.inspect(source,trigger);
function attachFloorplanPreview(card,type,container) {
  const d=SIC_CATALOG[type],art=card.querySelector('.sic-poker-art');
  if(!art||!d?.image||(!d.floorplanPreview&&(!d.width||!d.height||d.hullSystem)))return;
  let popup;
  const hide=()=>{popup?.remove();popup=null;};
  art.addEventListener('pointerenter',()=>{
    const previewDocument=container.ownerDocument;
    hide();popup=previewDocument.createElement('aside');popup.className='sic-floorplan-preview';
    const installation=Boolean(d.floorplanPreview),label=installation?'installation preview':'floorplan';
    const size=installation?(d.addon==='hull'?'Whole-hull coating · no floor space':'Inside its Shield · no extra floor space'):d.mixed?`${d.width} × ${d.exteriorRows} EXT + ${d.interiorWidth||d.width} × ${d.interiorRows||d.height-d.exteriorRows} EDG`:`${d.width} × ${d.height}${d.exterior?' EXT':''}`;
    popup.innerHTML=`<strong>${escapeHtml(d.name)} ${label}</strong>${d.mixed&&d.sprite?`<img class="sic-preview-exterior" src="${escapeHtml(d.sprite)}" alt="${escapeHtml(d.name)} exterior">`:''}<img src="${escapeHtml(d.floorplanPreview||d.image)}" alt="${escapeHtml(d.name)} ${label}"><small>${escapeHtml(size)}</small>`;
    container.append(popup);const r=art.getBoundingClientRect(),w=previewDocument.defaultView.innerWidth,h=previewDocument.defaultView.innerHeight;
    popup.style.left=`${Math.max(8,Math.min(w-248,r.left-248))}px`;popup.style.top=`${Math.max(8,Math.min(h-popup.offsetHeight-8,r.top))}px`;
  });
  art.addEventListener('pointerleave',hide);art.addEventListener('pointerdown',hide);
}
function openSicFamily(family, items, trigger) {
  if (activeFamilyDialog) return;
  const dialog = cardHost.createElement("dialog");
  dialog.className = "sic-family-picker" + (options.pickerClass ? " "+options.pickerClass : ""); dialog.setAttribute("aria-label", family);
  dialog.innerHTML = `<header><button type="button" data-family-back>Back</button><h2>${escapeHtml(family)}</h2><strong>${formatCredits(options.credits())} Credits</strong></header><p role="alert" data-family-feedback></p><div class="sic-picker-grid"></div>`;
  const grid = dialog.querySelector(".sic-picker-grid"), slots = [];
  const order=item=>{const type=item.querySelector('[data-sic-card]').dataset.sicCard,d=SIC_CATALOG[type];if(d.bridge)return (type.startsWith('cockpit')?0:2)+(d.tier||Number(type.match(/\d+$/)?.[0])||0);if(d.warp)return type==='warp-drive-x'?100:type==='ew-ftl-drive'?99:d.tier||0;return Number(type.match(/\d+$/)?.[0]||99);};
  const ascending=[...items].sort((a,b)=>options.compare?options.compare(a.querySelector('[data-sic-card]').dataset.sicCard,b.querySelector('[data-sic-card]').dataset.sicCard):order(a)-order(b));
  for (const [index, item] of ascending.entries()) {
    const source = item.querySelector("[data-sic-card]"), type = source.dataset.sicCard;
    const slot = cardHost.createElement("div"); slot.className = "sic-picker-slot";
    const face = cardHost.createElement("section"); face.className = "sic-market-item sic-picker-face";
    face.style.setProperty("--card-accent", cardAccent(type));
    const preview = previewSicCard(source); preview.tabIndex = 0; preview.setAttribute("role", "button"); preview.setAttribute("aria-label", `${SIC_CATALOG[type].name} details`);
    attachFloorplanPreview(preview,type,dialog);
    preview.addEventListener("click", () => openSicCard(source, preview));
    preview.addEventListener("keydown", event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); openSicCard(source, preview); } });
    const buy = cardHost.createElement("button"); buy.type = "button"; buy.className = "sic-purchase-button"; buy.textContent = "Purchase"; buy.dataset.purchaseType = type;
    buy.addEventListener("click", async () => {
      if (buy.disabled) return;
      buy.disabled = true;
      try { if (await options.purchase(type)) close(false);
      else { buy.disabled = false; dialog.querySelector("[data-family-feedback]").textContent = options.error?.() || "Purchase could not be completed."; } } catch(error) {buy.disabled=false;dialog.querySelector("[data-family-feedback]").textContent=error.message;}
    });
    buy.disabled=Boolean(options.disabled?.(type));face.append(preview, buy);if(options.consolePreview){const consoleButton=window.SACardInspector.consoleButton(type,cardHost,message=>{dialog.querySelector('[data-family-feedback]').textContent=message;});if(consoleButton)face.append(consoleButton);}if(options.blueprint&&options.canBlueprint?.(type)!==false&&window.SAFabrication?.recipe(type)){const bp=cardHost.createElement("button");bp.className="sic-buy-blueprint";bp.textContent="Buy blueprint";bp.onclick=()=>options.blueprint(type);face.append(bp);} slot.append(face); grid.append(slot); slots.push(slot);
    if (!reducedCardMotion()) slot.animate([{ opacity: 0, transform: `translateY(45px) rotate(${(index - 2) * 5}deg) scale(.7)` }, { opacity: 1, transform: "none" }], { duration: 320, delay: index * 35, fill: "backwards" });
  }
  function fit() {
    const faceHeight=Math.max(490,...slots.map(slot=>490+42*slot.querySelectorAll('.sic-picker-face > .sic-console-preview,.sic-picker-face > .sic-buy-blueprint').length));
    for(const slot of slots)slot.style.setProperty('--picker-face-height',faceHeight+'px');
    const { width, height } = grid.getBoundingClientRect();
    let best = { scale: 0, columns: 1 };
    for (let columns = 1; columns <= Math.min(slots.length,options.maxColumns||slots.length); columns++) {
      const rows = Math.ceil(slots.length / columns), scale = Math.min(1, (width - (columns - 1) * 14) / (columns * 350), (height - (rows - 1) * 14) / (rows * faceHeight));
      if (scale > best.scale) best = { scale, columns };
    }
    const scale = Math.max(.15, best.scale);
    grid.style.gridTemplateColumns = `repeat(${best.columns},${350 * scale}px)`;
    slots.forEach(slot => { slot.style.width = `${350 * scale}px`; slot.style.height = `${faceHeight * scale}px`; slot.style.setProperty("--picker-scale", scale); });
  }
  let closing = false;
  const resize = new cardHost.defaultView.ResizeObserver(fit);
  function close(animate = true) {
    if(closing)return;closing=true;
    for(const animation of dialog.getAnimations())animation.cancel();
    dispose();if(animate&&trigger.isConnected)trigger.focus({preventScroll:true});
  }
  function dispose() {
    resize.disconnect(); dialog.close(); dialog.remove(); activeFamilyDialog = null; disposeFamilyDialog = null;
  }
  dialog.querySelector("[data-family-back]").addEventListener("click", () => close());
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  cardHost.body.append(dialog); activeFamilyDialog = dialog; disposeFamilyDialog = dispose; dialog.showModal(); resize.observe(grid); fit();window.SACardFit?.observe(dialog);
}
function build(){
const families = new Map();
for (const item of [...market.querySelectorAll(".sic-market-item")]) {
  const type = item.querySelector("[data-sic-card]").dataset.sicCard;
  item.querySelector("[data-sic-card]").classList.add("sic-display-card");
  item.style.setProperty("--card-accent", cardAccent(type));
  const family = options.family ? options.family(type,SIC_CATALOG[type]) : SIC_CATALOG[type]?.warp?'Warp Drive':SIC_CATALOG[type]?.cloaking||SIC_CATALOG[type]?.darkveil?'Darkveil':/fuel-cell|warp-fuel/.test(type)?'Fuel Cells':SIC_CATALOG[type]?.bridge?'Cockpits & Bridges':SIC_CATALOG[type]?.name?.replace(/ (?:\d+|Zero|X)$/, "") || item.querySelector("h3").textContent;
  if (!families.has(family)) families.set(family, []);
  families.get(family).push(item);
}
for (const [family, items] of families) {
  if (items.length === 1 && !options.alwaysStack) { market.append(items[0]); continue; }
  const stack = document.createElement("details"); stack.className = "sic-family-stack";
  const summary = document.createElement("summary");
  summary.setAttribute("aria-label", `${family}: expand ${items.length} card${items.length === 1 ? "" : "s"}`);
  const ordered = [...items].sort((a, b) => Number(b.querySelector("h3").textContent.match(/\d+$/)?.[0] || 99) - Number(a.querySelector("h3").textContent.match(/\d+$/)?.[0] || 99));
  const preview = document.createElement("div"); preview.className = "sic-stack-preview sic-market-item"; preview.setAttribute("aria-hidden", "true"); preview.inert = true;
  for (const [index, item] of ordered.entries()) {
    const card = previewSicCard(item.querySelector("[data-sic-card]"));
    card.style.setProperty("--stack-angle", `${index === ordered.length - 1 ? 0 : (index % 2 ? -1 : 1) * (ordered.length - index) * .35}deg`);
    card.style.setProperty("--stack-offset", `${(ordered.length - index - 1) * -3}px`);
    card.classList.add(index === ordered.length - 1 ? "sic-stack-bottom" : "sic-stack-header");
    preview.append(card);
  }
  summary.innerHTML = `<strong>${escapeHtml(family)}${options.showCounts?`<small>${items.length} card${items.length===1?'':'s'}</small>`:""}</strong>`; summary.append(preview);
  const cards = document.createElement("div"); cards.className = "sic-family-cards"; cards.append(...items);
  stack.append(summary, cards); market.append(stack);
  const resizeStack=new ResizeObserver(entries=>{for(const entry of entries){const width=entry.contentRect.width;if(width>0){preview.style.setProperty('--stack-scale',String(Math.min(1,width/350)));summary.style.setProperty('--stack-height',(Math.min(350,width)*1.4+120)+'px');}}});resizeStack.observe(stack);
  summary.addEventListener("click", event => { event.preventDefault(); openSicFamily(family, items, summary); });
}

if(options.categories!==false){
const marketEntries=[...market.children].filter(node=>node.matches('.sic-market-item,.sic-family-stack'));
const marketHosts=sicCategoryHosts(marketEntries,market,node=>node.querySelector('[data-sic-card]')?.dataset.sicCard,'market');
marketEntries.forEach(node=>marketHosts.get(node).append(node));
}


market.querySelectorAll('[data-sic-card]').forEach(card=>attachFloorplanPreview(card,card.dataset.sicCard,cardHost.body));
window.SACardFit?.observe(market);
}
return {build,openFamily:openSicFamily,dispose:()=>disposeFamilyDialog?.()};
}
window.SASicMarket={create,categoryHosts,previewCard:previewSicCard,cardAccent};
})();
