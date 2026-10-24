(() => {
 'use strict';
 function open(selected={},choose){
  const art=window.SATokenArt,d=document.createElement('dialog');d.className='npc-icon-dialog';d.setAttribute('aria-label','Choose NPC icon');
  d.innerHTML='<h2>Choose NPC Icon</h2><div class="npc-icon-tabs" role="tablist" aria-label="Icon collection"><button type="button" role="tab" data-tab="default">Default</button><button type="button" role="tab" data-tab="pc">PC Icons</button></div><div class="npc-icon-options" role="tabpanel"></div><footer><button type="button" data-cancel>Cancel</button></footer>';
  const grid=d.querySelector('.npc-icon-options');
  function render(tab){for(const b of d.querySelectorAll('[data-tab]'))b.setAttribute('aria-selected',String(b.dataset.tab===tab));grid.replaceChildren();for(const id of tab==='default'?art.npcIcons:art.allRaces)for(const option of art.options(id)){const b=document.createElement('button');b.type='button';b.innerHTML=art.figure(id,option.value);const name=document.createElement('span');name.textContent=art.label(id)+(tab==='pc'?' · '+option.label:'');b.append(name);b.setAttribute('aria-pressed',String(selected.iconRace===id&&Number(selected.iconVariant||0)===option.value));b.onclick=()=>{d.close();choose({iconRace:id,iconVariant:option.value,name:art.label(id)});};grid.append(b);}}
  for(const b of d.querySelectorAll('[data-tab]'))b.onclick=()=>render(b.dataset.tab);
  d.querySelector('[data-cancel]').onclick=()=>d.close();d.onclose=()=>d.remove();document.body.append(d);render('default');d.showModal();return d;
 }
 window.SANpcIconPicker={open};
})();
