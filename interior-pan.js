// Shared drag gesture for scrollable interior maps. Construction placement is excluded.
(function(){
 function bind(doc){if(doc.__saInteriorPan)return;doc.__saInteriorPan=true;let drag=null,suppress=false;
  doc.addEventListener('pointerdown',e=>{const viewport=e.target.closest?.('.inline-map-viewport,.player-starship-map-viewport,.combat-map-viewport');if(!viewport||e.button!==0||e.target.closest('button:not([data-map-square]),input,select,[data-combat-door]')||viewport.querySelector('.placement-active'))return;drag={viewport,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false,id:e.pointerId};},true);
  doc.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;suppress=true;e.preventDefault();e.stopImmediatePropagation();drag.viewport.scrollLeft=drag.left-dx;drag.viewport.scrollTop=drag.top-dy;drag.viewport.style.cursor='grabbing';},true);
  doc.addEventListener('pointerup',()=>{if(drag)drag.viewport.style.cursor='';drag=null;setTimeout(()=>suppress=false,0);},true);
  doc.addEventListener('pointercancel',()=>{if(drag)drag.viewport.style.cursor='';drag=null;suppress=false;},true);
  doc.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();}},true);
 }
 window.SAInteriorPan={bind};bind(document);try{let doc=document;while(doc.defaultView.frameElement&&!doc.defaultView.frameElement.hasAttribute('data-explore-perspective'))doc=doc.defaultView.parent.document;bind(doc);}catch{}
}());
