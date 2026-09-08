(function (root) {
  function key(node) {
    if (node.nodeType !== 1) return "";
    if (node.localName === "label" && node.querySelector("input,select")) return `label:${key(node.querySelector("input,select"))}`;
    const identity = ["id", "data-unit-id", "data-ship-combat-lane", "data-starship-id", "data-id", "data-ring-unit", "data-starship-crew", "data-starship-npc-crew", "data-encounter-character", "data-encounter-starship", "data-encounter-npc", "data-staged-npc", "data-staged-location", "data-encounter-distance", "data-npc-editor", "data-npc-field", "name", ...(node.localName === "option" ? ["value"] : [])]
      .find(name => node.hasAttribute(name));
    return `${node.localName}:${identity ? `${identity}:${node.getAttribute(identity)}` : node.getAttribute("class")?.split(" ")[0] || ""}:${node.getAttribute("data-action") || ""}`;
  }
  function patch(target, source) {
    if (target.nodeType !== 1) {
      if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
      return;
    }
    const focused = target.ownerDocument.activeElement === target;
    const input = target.localName === "input" || target.localName === "textarea";
    const checked = target.checked;
    const value = target.value;
    const dirtyValue = input && (focused || value !== target.defaultValue);
    const dirtyChecked = target.localName === "input" && checked !== target.defaultChecked;
    const selected = target.localName === "select" && (focused || [...target.options].some(option => option.selected !== option.defaultSelected));
    for (const attribute of [...target.attributes]) if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
    for (const attribute of source.attributes) if (target.getAttribute(attribute.name) !== attribute.value) target.setAttribute(attribute.name, attribute.value);
    children(target, source);
    if (input) {
      const nextValue = dirtyValue ? value : source.value;
      if (target.value !== nextValue) target.value = nextValue;
      if (target.localName === "input") {
        const nextChecked = dirtyChecked ? checked : source.checked;
        if (target.checked !== nextChecked) target.checked = nextChecked;
      }
    }
    if (selected && target.value !== value && [...target.options].some(option => option.value === value)) target.value = value;
  }
  function children(target, source) {
    let cursor = target.firstChild;
    for (const next of [...source.childNodes]) {
      let match = cursor;
      const compatible = node => node && node.nodeType === next.nodeType && key(node) === key(next);
      if (!compatible(match)) match = [...target.childNodes].slice(cursor ? [...target.childNodes].indexOf(cursor) : target.childNodes.length).find(compatible);
      if (!match) {
        match = next.cloneNode(true);
        target.insertBefore(match, cursor);
      } else {
        if (match !== cursor) target.insertBefore(match, cursor);
        patch(match, next);
      }
      cursor = match.nextSibling;
    }
    while (cursor) { const next = cursor.nextSibling; cursor.remove(); cursor = next; }
  }
  function render(target, markup) {
    const template = target.ownerDocument.createElement("template");
    template.innerHTML = markup;
    children(target, template.content);
  }
  root.SALiveDOM = Object.freeze({ render });
}(window));
