(function () {
  'use strict';
  const content = window.SAStarshipHelpContent;
  const assetBase = new URL('.', document.currentScript.src);
  const asset = file => new URL(file, assetBase).href;

  function figure(doc, key) {
    const shot = content.shots[key];
    if (!shot) return doc.createDocumentFragment();
    const node = doc.createElement('figure');
    node.className = 'sg-figure';
    const frame = doc.createElement('div');
    frame.className = 'sg-image-frame';
    const img = doc.createElement('img');
    img.src = asset(shot.file); img.alt = shot.alt; img.decoding = 'async';
    if (shot.w && shot.h) { img.width = shot.w; img.height = shot.h; }
    frame.append(img);
    if (shot.marks?.length) {
      const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', `0 0 ${shot.w} ${shot.h}`);
      svg.setAttribute('aria-hidden', 'true');
      const marker = 'sg-arrow-' + key;
      svg.innerHTML = `<defs><marker id="${marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#ffe28a"/></marker></defs>`;
      for (const [label, x, y, tx, ty] of shot.marks) {
        const line = doc.createElementNS(ns, 'path');
        line.setAttribute('d', `M${x} ${y + 8}L${tx} ${ty}`);
        line.setAttribute('stroke', '#ffe28a'); line.setAttribute('stroke-width', '3');
        line.setAttribute('fill', 'none'); line.setAttribute('marker-end', `url(#${marker})`);
        const text = doc.createElementNS(ns, 'text');
        text.setAttribute('x', x); text.setAttribute('y', y); text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#ffe28a'); text.setAttribute('stroke', '#051018');
        text.setAttribute('stroke-width', '5'); text.setAttribute('paint-order', 'stroke');
        text.setAttribute('font-size', '22'); text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-weight', '700'); text.textContent = label;
        svg.append(line, text);
      }
      frame.append(svg);
    }
    const caption = doc.createElement('figcaption'); caption.textContent = shot.caption;
    node.append(frame, caption);
    return node;
  }

  function ensureStyle(doc) {
    if (doc.querySelector('link[data-starship-guide-style]')) return;
    const style = doc.createElement('link'); style.rel = 'stylesheet';
    style.href = asset('starship-guide.css'); style.dataset.starshipGuideStyle = '';
    doc.head.append(style);
  }

  function mount(dialog, {fromHelp = false, opener = document.activeElement, section = 'start'} = {}) {
    const doc = dialog.ownerDocument, view = doc.defaultView;
    if (dialog.dataset.starshipGuide === 'open') return;
    ensureStyle(doc);
    // Keep the existing Help nodes and handlers, including its current page.
    // Nothing in this module reads or writes ship/campaign storage.
    const saved = {
      nodes: [...dialog.childNodes], id: dialog.id, style: dialog.getAttribute('style'),
      label: dialog.getAttribute('aria-label'), scroll: dialog.scrollTop,
      focus: doc.activeElement, windowX: view.scrollX, windowY: view.scrollY
    };
    const previous = doc.createDocumentFragment();
    saved.nodes.forEach(node => previous.append(node));
    dialog.id = 'sa-starship-guide'; dialog.removeAttribute('style');
    dialog.dataset.starshipGuide = 'open'; dialog.setAttribute('aria-label', 'Starship Creation Guide');
    dialog.innerHTML = `<header class="sg-header"><div><span class="sg-eyebrow">SPACESHIP ARCHITECT · ENGINEERING MANUAL</span><h1>Starship Creation Guide</h1></div><div class="sg-header-actions"><button type="button" data-sg-back>${fromHelp ? 'Back to Help' : 'Back to Starship Creator'}</button><button type="button" data-sg-close aria-label="Close Starship Creation Guide" title="Return to the originating view">×</button></div></header><div class="sg-workspace"><nav class="sg-nav" aria-label="Construction guide sections"></nav><label class="sg-mobile-nav">Section<select aria-label="Construction guide section"></select></label><article class="sg-content" tabindex="0" aria-label="Guide section"></article></div><footer class="sg-footer"><button type="button" data-sg-prev>Previous</button><span data-sg-count></span><button type="button" data-sg-next>Next</button><span class="sg-footer-note">Reference only · Your ship stays as you left it</span></footer>`;
    const nav = dialog.querySelector('.sg-nav'), select = dialog.querySelector('select');
    const article = dialog.querySelector('.sg-content'), prev = dialog.querySelector('[data-sg-prev]');
    const next = dialog.querySelector('[data-sg-next]'), count = dialog.querySelector('[data-sg-count]');
    const scrollPositions = new Map();
    let index = Math.max(0, content.sections.findIndex(item => item.id === section));
    let leaving = false;

    function render(target, focusHeading = false) {
      if (article.childNodes.length) scrollPositions.set(index, article.scrollTop);
      index = target;
      const item = content.sections[index];
      article.replaceChildren();
      const heading = doc.createElement('h2'); heading.tabIndex = -1; heading.textContent = item.title;
      const eyebrow = doc.createElement('span'); eyebrow.className = 'sg-eyebrow';
      eyebrow.textContent = `SECTION ${String(index + 1).padStart(2, '0')} / ${String(content.sections.length).padStart(2, '0')}`;
      const intro = doc.createElement('p'); intro.className = 'sg-intro'; intro.textContent = item.intro;
      const body = doc.createElement('div'); body.className = 'sg-copy'; body.innerHTML = item.html;
      // URLs are resolved against this script, including when hosted by a parent dialog.
      for (const img of body.querySelectorAll('img')) img.src = asset(img.getAttribute('src'));
      const layout = doc.createElement('div'); layout.className = 'sg-section-layout'; layout.dataset.section = item.id;
      layout.append(body);
      if (item.shots.length) {
        const visuals = doc.createElement('div'); visuals.className = 'sg-visuals';
        item.shots.forEach(key => visuals.append(figure(doc, key)));
        layout.append(visuals);
      }
      article.append(eyebrow, heading, intro, layout);
      for (const [i, button] of [...nav.children].entries()) {
        if (i === index) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
      select.value = String(index); prev.disabled = index === 0; next.disabled = index === content.sections.length - 1;
      count.textContent = `${index + 1} / ${content.sections.length} · ${item.label}`;
      if (focusHeading) heading.focus({preventScroll:true});
      article.scrollTop = scrollPositions.get(index) || 0;
    }
    content.sections.forEach((item, i) => {
      const button = doc.createElement('button'); button.type = 'button';
      const number = doc.createElement('span'); number.textContent = String(i + 1).padStart(2, '0');
      button.append(number, doc.createTextNode(item.label)); button.onclick = () => render(i);
      nav.append(button);
      const option = doc.createElement('option'); option.value = String(i); option.textContent = `${i + 1}. ${item.label}`; select.append(option);
    });
    select.onchange = () => render(Number(select.value));
    prev.onclick = () => { if (index > 0) render(index - 1, true); };
    next.onclick = () => { if (index < content.sections.length - 1) render(index + 1, true); };

    function leave() {
      if (leaving) return;
      leaving = true; dialog.removeEventListener('cancel', cancel);
      delete dialog.dataset.starshipGuide;
      if (fromHelp) {
        dialog.id = saved.id;
        if (saved.style == null) dialog.removeAttribute('style'); else dialog.setAttribute('style', saved.style);
        if (saved.label == null) dialog.removeAttribute('aria-label'); else dialog.setAttribute('aria-label', saved.label);
        dialog.replaceChildren(previous); dialog.scrollTop = saved.scroll;
        if (saved.focus?.isConnected) saved.focus.focus({preventScroll:true});
      } else {
        dialog.close(); dialog.remove();
        if (opener?.isConnected) opener.focus({preventScroll:true});
      }
      view.scrollTo(saved.windowX, saved.windowY);
    }
    function cancel(event) { event.preventDefault(); event.stopImmediatePropagation(); leave(); }
    dialog.addEventListener('cancel', cancel);
    dialog.querySelector('[data-sg-back]').onclick = leave;
    dialog.querySelector('[data-sg-close]').onclick = leave;
    render(index);
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('[data-sg-back]').focus({preventScroll:true});
  }

  function openFromCreator(opener) {
    let host = window;
    try { while (host.parent !== host && host.parent.document) host = host.parent; } catch {}
    const doc = host.document;
    if (doc.getElementById('sa-starship-guide')) return;
    const help = doc.getElementById('sa-app-help');
    if (help) { mount(help, {fromHelp:true, opener}); return; }
    const dialog = doc.createElement('dialog'); doc.body.append(dialog);
    mount(dialog, {opener});
  }

  window.SAStarshipGuide = Object.freeze({mount, figure, openFromCreator});
  const entry = document.getElementById('starshipCreationGuide');
  entry?.addEventListener('click', () => openFromCreator(entry));
})();
