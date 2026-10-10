(function(){
 'use strict';
 const axes=[['Benevolent','Ruthless'],['Virtuous','Treacherous'],['Civil','Savage'],['Powerful','Weak'],['Cunning','Exploitable']];
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function dialog(title){const d=document.createElement('dialog');d.className='reputation-dialog';d.setAttribute('aria-label',title);d.innerHTML='<h2>'+esc(title)+'</h2><div data-content></div><p data-error role="status"></p><div class="dialog-actions"><button data-cancel type="button">Cancel</button><button data-confirm type="button">Confirm</button></div>';d.querySelector('[data-cancel]').onclick=()=>d.close();document.body.append(d);d.showModal();return d;}
 const current=state=>state?.reputation?.contacts?.[state.reputation.activeKey];
 function comparison(r){return r?`<div class="reputation-result"><span>${esc(r.shipName)}</span><span>Original <b>${r.raw}</b></span><span>With Reputation <b>${r.adjusted}</b> (${r.modifier>=0?'+':''}${r.modifier})</span><span class="reputation-recognition ${r.recognized?'success':'failed'}">Recognition ${r.roll} / Popularity ${r.popularity}%</span><small>GM decides which total applies.</small></div>`:'';}
 function attitude(state,send){return new Promise(resolve=>{
  const contact=current(state),npcId=contact?.npcId||'general',npc=state.starships.find(s=>s.id===npcId),values=[...(state.reputation?.attitudes?.[npcId]||[0,0,0,0,0])];
  const d=dialog('NPC Affinity & Bias'),content=d.querySelector('[data-content]');let saved=false;
  content.innerHTML=`<p>${esc(npc?.title||'Current social interaction')} · remembered until End Session.</p>`;
  axes.forEach((pair,i)=>{const row=document.createElement('div');row.className='reputation-axis';function paint(){row.innerHTML=[1,0,-1].map(v=>`<button type="button" data-choice="${v}" class="${values[i]===v?'active':''}" aria-pressed="${values[i]===v}">${esc(v===1?pair[0]:v===-1?pair[1]:'Indifferent')}<small>${!values[i]||!v?'':values[i]===v?'Affinity':'Bias'}</small></button>`).join('');row.querySelectorAll('button').forEach(b=>b.onclick=()=>{values[i]=Number(b.dataset.choice);paint();});}paint();content.append(row);});
  const receipt=crypto.randomUUID();d.querySelector('[data-confirm]').onclick=async()=>{const b=d.querySelector('[data-confirm]');b.disabled=true;try{await send('reputation',{kind:'attitude',npcId,values,receipt});saved=true;d.close();}catch(e){d.querySelector('[data-error]').textContent=e.message;}finally{b.disabled=false;}};
  d.onclose=()=>{d.remove();resolve(saved);};
 });}
 function impactRoll(sides){return new Promise((resolve,reject)=>{
  const d=dialog('Session Impact — D'+sides),frame=document.createElement('iframe'),id=crypto.randomUUID();frame.title='Session Impact standard dice';frame.style.cssText='width:100%;height:min(650px,72vh);border:0';frame.src='character.html?shipRoll=1';d.querySelector('[data-content]').append(frame);d.querySelector('[data-confirm]').hidden=true;let score=null;
  const receive=e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow)return;const data=e.data;if(data?.type==='sa-ship-skill-ready')frame.contentWindow.postMessage({type:'sa-ship-skill-open',rollId:id,sides:[sides],bonus:0,exertionAvailable:0,skill:'Persuasion',attributeLabel:'Session Impact',difficultyLabel:'Impact die — adds Popularity',name:'Session Impact',title:'Roll D'+sides+' for Popularity',rollTitle:'Session Impact',cancelable:true,immediateResult:true},location.origin);if(data?.rollId===id&&data.type==='sa-ship-skill-result'){score=Number(data.score);d.close();}if(data?.type==='sa-ship-skill-cancel')d.close();};
  window.addEventListener('message',receive);d.onclose=()=>{window.removeEventListener('message',receive);d.remove();resolve(Number.isInteger(score)&&score>=1&&score<=sides?score:null);};
  frame.onerror=()=>{d.querySelector('[data-error]').textContent='Dice could not load. Cancel and try again.';};
 });}
 async function endSession(state){
  const ships=state.starships.filter(s=>s.crewCharacterIds?.some(id=>state.characters.some(c=>c.id===id)));
  const selected=await new Promise(resolve=>{const d=dialog('End Session '+state.sessionNumber);let value=null;d.querySelector('[data-content]').innerHTML=`<p>Choose which ships receive the session bonuses.</p><fieldset>${ships.map(s=>`<label><input type="checkbox" data-ship="${esc(s.id)}" checked>${esc(s.title)}</label>`).join('')||'<p>No ships have registered PC crew.</p>'}</fieldset><label>Session impact die<select data-impact>${[4,6,8,10,12,20].map(n=>`<option value="${n}">D${n}</option>`).join('')}</select></label>`;d.querySelector('[data-confirm]').textContent='Continue';d.querySelector('[data-confirm]').onclick=()=>{value={shipIds:[...d.querySelectorAll('[data-ship]:checked')].map(i=>i.dataset.ship),impactSides:Number(d.querySelector('[data-impact]').value)};d.close();};d.onclose=()=>{d.remove();resolve(value);};});
  if(!selected)return null;if(!selected.shipIds.length)return selected;
  const score=await impactRoll(selected.impactSides);if(score===null)return null;
  return new Promise(async resolve=>{const d=dialog('Choose the Reputation change');let value=null;const content=d.querySelector('[data-content]');content.innerHTML=`<p>Impact roll: <strong>${score}</strong>. Each selected ship gains up to ${score} Popularity points (maximum 100%). Choose a side below to move that Reputation slider one dot toward it.</p>`;try{
   // Copy the actual ship-sheet chart so this is the same familiar dot interface.
   const html=await fetch('starship.html').then(r=>r.text()),svg=new DOMParser().parseFromString(html,'text/html').querySelector('.desktop-reputation-chart');
   svg.classList.add('reputation-chart-copy');svg.querySelector('.desktop-popularity')?.remove();svg.setAttribute('viewBox','0 0 620 190');svg.querySelectorAll('.reputation-row>text').forEach(label=>label.setAttribute('y','0'));
   svg.querySelectorAll('.reputation-row > g').forEach((row,i)=>{for(let n=0;n<=10;n++){const dot=document.createElementNS('http://www.w3.org/2000/svg','g');dot.classList.add('reputation-position');dot.setAttribute('transform',`translate(${n*29} 0)`);dot.setAttribute('tabindex','0');dot.setAttribute('role','button');dot.setAttribute('aria-label',n===5?'Neutral — choose a side':axes[i][n<5?0:1]+' +'+Math.abs(n-5));dot.innerHTML=`<circle r="9.5" fill="#151d28" stroke="#fff"/><text y="3" text-anchor="middle" fill="white" font-size="9">${n===5?'0':'+'+Math.abs(n-5)}</text>`;const choose=()=>{if(n===5)return;svg.querySelectorAll('.selected').forEach(e=>e.classList.remove('selected'));dot.classList.add('selected');value={...selected,impactResult:score,reputationRow:i,reputationDirection:n<5?-1:1};d.querySelector('[data-confirm]').disabled=false;};dot.onclick=choose;dot.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}};row.append(dot);}});content.append(svg);
  }catch(e){d.querySelector('[data-error]').textContent='Could not load the Reputation chart. Cancel and try again.';}
  d.querySelector('[data-confirm]').disabled=true;let confirmed=false;d.querySelector('[data-confirm]').onclick=()=>{confirmed=true;d.close();};d.onclose=()=>{d.remove();resolve(confirmed?value:null);};
  });
 }
 window.SAReputationUI={current,comparison,attitude,endSession};
}());
