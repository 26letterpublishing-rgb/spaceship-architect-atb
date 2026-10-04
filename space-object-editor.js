(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // Read the live GM draft at the time of each operation; dragging can replace
  // its array without replacing this form or the user's unfinished settings.
  function bind(map,getObjects,onChange,{getPositions=()=>[],fixedIds=[]}={}){
    let panel=map.parentElement.querySelector('[data-object-editor]');
    if(!panel){
      panel=document.createElement('section');panel.dataset.objectEditor='';panel.className='space-object-editor';map.after(panel);
      panel.innerHTML='<h4>Add space object</h4><form><div class="space-object-fields"><label>Object type<select name="kind"><option value="asteroid">Asteroid</option><option value="planet">Planet (7 hexes)</option><option value="sun">Sun (7 hexes, gravity 2)</option><option value="black-hole">Black Hole</option><option value="mineral">Minerals</option><option value="object">Named Object</option></select></label><label>Name<input name="name" maxlength="80" value="Asteroid" required></label><label hidden>Mineral<select name="mineral"></select></label><label>Mining attempts<input name="quantity" type="number" min="1" max="50" value="1" required></label><label>Roll D10 under<input name="miningTarget" type="number" min="1" max="11" value="6"></label><label hidden>Intensity<input name="intensity" type="number" min="1" max="100" value="3" required></label><button type="submit" class="object-place-button">Place on Map</button></div><details class="space-object-advanced"><summary>Advanced: exact coordinates</summary><p>You can place objects by clicking the map. These optional numbers identify a particular hex.</p><div><label>Column axis (Q)<input name="q" type="number" min="-10000" max="10000" value="0" required></label><label>Diagonal axis (R)<input name="r" type="number" min="-10000" max="10000" value="2" required></label><button type="submit" data-add-at-coordinates>Add at These Coordinates</button></div></details></form><small>Choose an object, click Place on Map, then click its destination hex. Existing objects can be dragged to reposition them.</small><output role="status" aria-live="polite"></output><details class="space-object-list"><summary>Objects on map <span data-object-count></span></summary><div data-object-list></div></details>';
      const field=name=>panel.querySelector(`[name=${name}]`);
      field('mineral').innerHTML=window.SASpaceObjects.minerals.map(name=>`<option ${name==='Iron'?'selected':''}>${esc(name)}</option>`).join('');
      panel._defaultName=window.SASpaceObjects.defaultName(field('kind').value,field('mineral').value);
      panel._suggest=()=>{
        if(panel._manualPosition)return;
        const ships=panel._positions(),objects=panel._read(),origin=ships.length?{q:ships.reduce((n,p)=>n+p.q,0)/ships.length,r:ships.reduce((n,p)=>n+p.r,0)/ships.length}:undefined;
        const next=window.SASpaceObjects.suggestedPosition([...ships,...objects],field('kind').value,origin);
        field('q').value=String(next.q);field('r').value=String(next.r);
      };
      const typeChanged=()=>{
        const kind=field('kind').value,nextName=window.SASpaceObjects.defaultName(kind,field('mineral').value);
        if(!field('name').value.trim()||field('name').value===panel._defaultName)field('name').value=nextName;
        panel._defaultName=nextName;
        field('mineral').closest('label').hidden=kind!=='mineral';
        field('quantity').closest('label').hidden=['planet','black-hole','sun'].includes(kind);field('intensity').closest('label').hidden=kind!=='black-hole';
        field('miningTarget').closest('label').hidden=kind!=='asteroid';field('quantity').max=kind==='asteroid'?'50':'10000';field('quantity').closest('label').firstChild.textContent=kind==='asteroid'?'Mining attempts':'Quantity';
        if(kind==='asteroid')field('quantity').value=Math.min(50,Number(field('quantity').value)||1);if(['planet','sun'].includes(kind))field('quantity').value='1';
        panel._suggest();
      };
      field('kind').onchange=typeChanged;field('mineral').onchange=typeChanged;
      for(const axis of ['q','r'])field(axis).oninput=()=>{panel._manualPosition=true;};
      panel.querySelector('form').onsubmit=event=>{
        event.preventDefault();
        try{
          panel._suggest();
          const values=new FormData(event.target),kind=values.get('kind');
          // Freeze what is being placed, so subsequent form changes cannot change a pending object.
          const object={id:'object-'+crypto.randomUUID(),kind,miningTarget:Number(values.get('miningTarget')),intensity:Number(values.get('intensity')),variant:kind==='planet'?['ocean','desert','ice','volcanic'][crypto.getRandomValues(new Uint32Array(1))[0]%4]:undefined,name:values.get('name'),mineral:values.get('mineral'),quantity:Number(values.get('quantity'))};
          const place=point=>{
            const next=window.SASpaceObjects.normalize([...panel._read(),{...object,...point}]);
            panel._manualPosition=false;panel._change(next);panel._suggest();
            panel.querySelector('output').textContent=`${next.at(-1).name} added. Drag its marker to reposition it.`;
          };
          if(event.submitter?.hasAttribute?.('data-add-at-coordinates'))place({q:Number(values.get('q')),r:Number(values.get('r'))});
          else{
            window.SASpaceMap.beginObjectPlacement(map,{name:object.name,onPlace:place,onCancel:()=>{panel.querySelector('output').textContent='Object placement cancelled.';}});
            panel.querySelector('output').textContent=`Click a hex on the map to place ${object.name}. Cancel is above the map.`;
            map.scrollIntoView?.({behavior:'smooth',block:'center'});
          }
        }catch(error){panel.querySelector('output').textContent=error.message;}
      };
      panel.querySelector('[data-object-list]').onchange=event=>{
        const input=event.target.closest('[data-asteroid-setting]');if(!input)return;
        try{const next=panel._read().map(object=>object.id===input.dataset.object?{...object,[input.dataset.asteroidSetting]:Number(input.value)}:object);panel._change(window.SASpaceObjects.normalize(next));panel.querySelector('output').textContent='Asteroid mining settings saved.';}catch(error){panel.querySelector('output').textContent=error.message;}
      };
      panel.querySelector('[data-object-list]').onclick=event=>{
        const remove=event.target.closest('[data-remove-object]');if(!remove||panel._fixedIds.includes(remove.dataset.removeObject))return;
        panel._change(panel._read().filter(object=>object.id!==remove.dataset.removeObject));panel._suggest();panel.querySelector('output').textContent='Object removed.';
      };
    }
    panel.hidden=map.hidden;panel._read=getObjects;panel._change=onChange;panel._positions=getPositions;panel._fixedIds=fixedIds;
    panel.querySelector('[data-object-count]').textContent=`(${getObjects().length})`;
    panel.querySelector('[data-object-list]').innerHTML=getObjects().map(object=>`<article><strong>${esc(object.name)}</strong><small>${esc(object.kind==='mineral'?object.mineral+' · '+object.quantity:object.kind==='black-hole'?'Black Hole · intensity '+object.intensity:object.kind==='sun'?'Sun · gravity 2':object.kind==='asteroid'?'Asteroid':object.kind==='planet'?'Planet':'Object')}</small>${object.kind==='asteroid'?`<label>Mining attempts<input data-object="${esc(object.id)}" data-asteroid-setting="quantity" type="number" min="1" max="50" value="${object.quantity}"></label><label>D10 under<input data-object="${esc(object.id)}" data-asteroid-setting="miningTarget" type="number" min="1" max="11" value="${object.miningTarget||6}"></label>`:''}<button type="button" data-remove-object="${esc(object.id)}" aria-label="Remove ${esc(object.name)}" ${fixedIds.includes(object.id)?'disabled title="The central star stays in this system."':''}>Remove</button></article>`).join('');
    panel._suggest();
  }
  window.SASpaceObjectEditor={bind};
}());
