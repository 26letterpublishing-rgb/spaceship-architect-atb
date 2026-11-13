(function(root){
 'use strict';
 const typeId=name=>{const label=name.replace(/\s+\d+$/,'');const id=label.toLowerCase().replace(/[^a-z0-9]+/g,'-');return id==='warp-drive'?'warp':id;};
 function entries(catalog){return catalog.map(e=>({...e,consoleType:e.consoleType||typeId(e.name),typeLabel:e.typeLabel||e.name.replace(/\s+\d+$/,''),url:['sensor','lock'].includes(e.route)?`console-viewer.html?stage=1&family=${e.route==='sensor'?'sensors':'lock'}&tier=${e.id.match(/\d+$/)[0]}`:`console-viewer.html?stage=1&family=${e.route}&type=${encodeURIComponent(e.id)}`}));}
 const api={typeId,entries};if(typeof module==='object')module.exports=api;else root.SAConsoleLayoutCatalog=api;
})(typeof window==='object'?window:globalThis);
