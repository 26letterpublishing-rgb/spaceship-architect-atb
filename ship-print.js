(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function open(ship,title){
    let host=document;try{while(host.defaultView.frameElement)host=host.defaultView.parent.document;}catch{}
    const dialog=host.createElement('dialog');dialog.className='ship-print-options';dialog.setAttribute('aria-label','Print starship');
    dialog.innerHTML='<h2>Print Starship</h2><label>Floorplan <select aria-label="Print resolution"><option value="high">High resolution</option><option value="low">Low resolution</option></select></label><p>One page, fitted to paper. Small squares print at half an inch when space allows.</p><button type="button" data-print>Print</button> <button type="button" data-cancel>Cancel</button>';
    host.body.append(dialog);dialog.showModal();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('[data-print]').onclick=()=>{const high=dialog.querySelector('select').value==='high',win=window.open('','_blank');if(!win){dialog.querySelector('p').textContent='Allow this print window in your browser, then try again.';return;}render(win,ship,title,high);dialog.close();};
  }
  async function render(win,ship,title,high){
    const maps=window.SAShipMap,layout=maps.buildLayout(ship),cells=[...new Set([...layout.hull,...layout.footprint.keys()])];
    const xs=cells.map(n=>n%20),ys=cells.map(n=>Math.floor(n/20)),minX=cells.length?Math.min(...xs):0,minY=cells.length?Math.min(...ys):0;
    const cols=cells.length?Math.max(...xs)-minX+1:1,rows=cells.length?Math.max(...ys)-minY+1:1,size=Math.min(1.5,9.7/cols,6.7/rows);
    const content=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const square=(y+minY)*20+x+minX,part=layout.footprint.get(square),hull=layout.hull.has(square);
      const style=part&&!part.exterior?(high?maps.floorplanStyle(part.type,part.column,part.row):`background:${part.color||'#477d83'}`):hull?(high?`background-image:url('hallway.png');background-size:cover`:'background:#e2e4d9'):'';
      content.push(`<div class="print-cell combat-map-square ${hull?'floor':''}" style="${style}">${maps.surfaceMarkup(layout,square)}${hull?maps.boundaryMarkup(layout,square):''}${part&&!part.offset?`<span class="print-label" style="width:${part.width*100}%;height:${part.height*100}%">${esc(maps.definition(part.type).name)}</span>`:''}</div>`);
    }
    win.document.open();win.document.write(`<!doctype html><html><head><base href="${esc(location.href)}"><title>${esc(title)} - Starship</title><link rel="stylesheet" href="ship-map-presentation.css"><style>@page{size:letter landscape;margin:.35in}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:white;color:#152026;font:12px Arial}h1{font-size:20px;margin:0 0 6px}.print-map{display:grid;grid-template-columns:repeat(${cols},1fr);width:${cols*size}in;height:${rows*size}in;margin:auto;position:relative;background:#fff}.print-cell{position:relative;min-width:0;min-height:0}.floor{box-shadow:inset 0 0 0 .4px #687980}.print-cell.floor::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(to right,transparent 32.9%,#70819066 33%,transparent 33.5%,transparent 66.2%,#70819066 66.3%,transparent 66.7%),linear-gradient(to bottom,transparent 32.9%,#70819066 33%,transparent 33.5%,transparent 66.2%,#70819066 66.3%,transparent 66.7%)}.print-label{position:absolute;left:0;top:0;display:grid;place-items:center;text-align:center;z-index:14;font:bold ${Math.max(6,size*9)}px Arial;color:${high?'#ffe95d':'#051319'};text-shadow:${high?'0 1px 2px #000':'none'};pointer-events:none}.print-map .sa-map-wall{background:#26333d}.sa-thruster-flame,.sa-ion-pulse{display:none!important}*{animation:none!important}body>button{margin:6px}@media print{body>button{display:none}body{width:10.3in}}</style></head><body><h1>${esc(title||'Starship')}</h1><div class="print-map ${high?'high-resolution':''} show-walls">${content.join('')}</div><button onclick="window.print()">Print / Save PDF</button></body></html>`);win.document.close();
    const assets=[...new Set(['hallway.png',...(ship.sicInventory||[]).map(i=>maps.definition(i.type).image)].filter(Boolean))];
    await Promise.all([...win.document.querySelectorAll('link[rel=stylesheet]')].map(link=>link.sheet?Promise.resolve():new Promise(resolve=>{link.onload=link.onerror=resolve;})));
    await Promise.all(assets.map(src=>new Promise(resolve=>{const image=new Image();image.onload=image.onerror=resolve;image.src=src;})));
    await Promise.all([...win.document.images].map(image=>image.decode().catch(()=>{})));
    win.document.body.dataset.printReady='true';
    setTimeout(()=>{if(!win.closed)win.print();},300);
  }
  window.SAShipPrint={open};
}());
