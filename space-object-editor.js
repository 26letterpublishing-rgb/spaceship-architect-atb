(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // The GM draft owns the collection. Always read it at the moment of an edit;
  // dragging a marker can replace that array without rebuilding this form.
  function bind(map,getObjects,onChange,{getPositions=()=>[]}={}){
    let panel=map.parentElement.querySelector('[data-object-editor]');
    if(!panel){
      panel=document.createElement('section');panel.dataset.objectEditor='';panel.className='space-object-editor';map.after(panel);
      panel.innerHTML='<h4>Space Objects</h4><form><label>Type<select name="kind"><option value="mineral">Minerals</option><option value="asteroid">Asteroid</option><option value="object">Named Object</option><option value="planet">Planet (7 hexes)</option><option value="black-hole">Black Hole</option></select></label><label>Name<input name="name" maxlength="80" value="Iron Deposit" required></label><label>Mineral<select name="mineral"></select></label><label>Quantity<input name="quantity" type="number" min="1" max="10000" value="1" required></label><label hidden>Roll D10 under<input name="miningTarget" type="number" min="1" max="11" value="6"></label><label hidden>Intensity<input name="intensity" type="number" min="1" max="100" value="3" required></label><label>Hex Q<input name="q" type="number" min="-10000" max="10000" value="0" required></label><label>Hex R<input name="r" type="number" min="-10000" max="10000" value="2" required></label><button type="submit">Add Object</button></form><small>A free hex is suggested for each object. Enter Q/R to place it anywhere, including an occupied hex.</small><output role="status"></output><div data-object-list></div>';
      const field=name=>panel.querySelector(`[name=${name}]`);
      field('mineral').innerHTML=window.SASpaceObjects.minerals.map(n=>`<option ${n==='Iron'?'selected':''}>${esc(n)}</option>`).join('');
      panel._defaultName=window.SASpaceObjects.defaultName('mineral','Iron');
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
        field('quantity').closest('label').hidden=['planet','black-hole'].includes(kind);field('intensity').closest('label').hidden=kind!=='black-hole';
        field('miningTarget').closest('label').hidden=kind!=='asteroid';field('quantity').max=kind==='asteroid'?'50':'10000';field('quantity').closest('label').firstChild.textContent=kind==='asteroid'?'Mining attempts':'Quantity';if(kind==='asteroid')field('quantity').value=Math.min(50,Number(field('quantity').value)||1);if(kind==='planet')field('quantity').value='1';
        panel._suggest();
      };
      field('kind').onchange=typeChanged;field('mineral').onchange=typeChanged;
      for(const axis of ['q','r'])field(axis).oninput=()=>{panel._manualPosition=true;};
      panel.querySelector('form').onsubmit=e=>{
        e.preventDefault();
        try{
          panel._suggest();
          const f=new FormData(e.target),kind=f.get('kind');
          const next=window.SASpaceObjects.normalize([...panel._read(),{id:'object-'+crypto.randomUUID(),kind,miningTarget:Number(f.get('miningTarget')),intensity:Number(f.get('intensity')),variant:kind==='planet'?['ocean','desert','ice','volcanic'][crypto.getRandomValues(new Uint32Array(1))[0]%4]:undefined,name:f.get('name'),mineral:f.get('mineral'),quantity:Number(f.get('quantity')),q:Number(f.get('q')),r:Number(f.get('r'))}]);
          panel._manualPosition=false;panel._change(next);panel._suggest();
          const added=next.at(-1);panel.querySelector('output').textContent=`${added.name} added at Q ${added.q}, R ${added.r}. Drag its marker or edit its coordinates to reposition it.`;
        }catch(error){panel.querySelector('output').textContent=error.message;}
      };
      panel.querySelector('[data-object-list]').onchange=e=>{const input=e.target.closest('[data-asteroid-setting]');if(!input)return;try{const next=panel._read().map(o=>o.id===input.dataset.object?{...o,[input.dataset.asteroidSetting]:Number(input.value)}:o);panel._change(window.SASpaceObjects.normalize(next));panel.querySelector('output').textContent='Asteroid mining settings saved.';}catch(error){panel.querySelector('output').textContent=error.message;}};
      panel.querySelector('[data-object-list]').onclick=e=>{
        const remove=e.target.closest('[data-remove-object]');
        if(remove){panel._change(panel._read().filter(o=>o.id!==remove.dataset.removeObject));panel._suggest();panel.querySelector('output').textContent='Object removed.';}
      };
    }
    panel.hidden=map.hidden;panel._read=getObjects;panel._change=onChange;panel._positions=getPositions;
    panel.querySelector('[data-object-list]').innerHTML=getObjects().map(o=>`<span>${esc(o.name)}${o.kind==='asteroid'?` <label>Attempts <input style="width:65px" data-object="${esc(o.id)}" data-asteroid-setting="quantity" type="number" min="1" max="50" value="${o.quantity}"></label><label>D10 under <input style="width:65px" data-object="${esc(o.id)}" data-asteroid-setting="miningTarget" type="number" min="1" max="11" value="${o.miningTarget||6}"></label>`:o.kind==='planet'?'':` (${o.quantity})`} <button type="button" data-remove-object="${esc(o.id)}" aria-label="Remove ${esc(o.name)}" title="Remove object">&times;</button></span>`).join('');
    panel._suggest();
  }
  window.SASpaceObjectEditor={bind};
}());
