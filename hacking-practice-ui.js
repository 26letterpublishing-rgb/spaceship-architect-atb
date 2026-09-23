(function(){
  'use strict';
  const $=selector=>document.querySelector(selector),key='sa-hacking-practice-v1';
  const colors=['#7dd4d2','#f3bf78','#bda4ed','#b1d679','#f197ad','#89b9ed','#d7d188','#d6a8d4'];
  let saved={};try{saved=JSON.parse(sessionStorage.getItem(key)||'{}');}catch{}
  let token=saved.token||'',board=null,draft=saved.draft||[],pending=saved.pending||null,selected=0,busy=false,expired=false;
  const color=letter=>colors[(letter.charCodeAt(0)-65)%colors.length];
  function persist(){try{sessionStorage.setItem(key,JSON.stringify({token,draft,pending}));}catch{}}
  async function request(method,body){
    const response=await fetch('/api/hacking/practice',{method,headers:{'Content-Type':'application/json','X-Practice-Token':token},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});
    const payload=await response.json();
    if(!response.ok){if(response.status===404)expired=true;throw Error(payload.error||'Practice request failed.');}
    return payload;
  }
  function tokenNode(letter){const span=document.createElement('span');span.className='hacking-token';span.textContent=letter;span.style.setProperty('--token',color(letter));return span;}
  function put(letter){
    if(!board||busy||pending||board.solved||expired)return;
    const previous=draft.indexOf(letter),replaced=draft[selected]||null;
    if(previous>=0&&previous!==selected)draft[previous]=replaced;
    draft[selected]=letter;selected=(selected+1)%board.length;persist();render();$('#slots').children[selected]?.focus();
  }
  function render(){
    $('#newPuzzle').disabled=busy;
    $('#submitGuess').disabled=busy||!board||expired||(!pending&&(board.solved||draft.filter(Boolean).length!==board.length));
    $('#submitGuess').textContent=busy?'Checking...':pending?'Retry Submit':'Submit Guess';
    $('#clearGuess').disabled=busy||!!pending||!board||board.solved||expired;
    if(!board)return;
    $('#connection').textContent=expired?'SESSION ENDED':board.solved?'ACCESS GRANTED':'PRACTICE LINK ONLINE';
    $('#attempts').textContent=`${board.history.length} attempt${board.history.length===1?'':'s'}`;
    $('#length').textContent=board.length;$('#choices').textContent=board.candidates.length;$('#reduction').textContent=board.tier-1;
    const palette=$('#palette');palette.replaceChildren();
    for(const letter of board.candidates){const button=document.createElement('button');button.type='button';button.className='hacking-token';button.textContent=letter;button.style.setProperty('--token',color(letter));button.setAttribute('aria-label',`Letter ${letter}`);button.setAttribute('aria-pressed',String(draft.includes(letter)));button.disabled=busy||!!pending||board.solved||expired;button.onclick=()=>put(letter);palette.append(button);}
    $('#guessHeading').textContent=board.solved?'Solved Code':'Current Guess';
    const slots=$('#slots');slots.replaceChildren();slots.style.setProperty('--slots',String(board.length));slots.classList.toggle('solved',board.solved);
    for(let i=0;i<board.length;i++){const button=document.createElement('button'),letter=board.solved?board.history.at(-1)?.guess[i]:draft[i];button.type='button';button.className='hacking-slot'+(letter?' filled':'');button.textContent=letter||String(i+1);if(letter)button.style.setProperty('--token',color(letter));button.setAttribute('aria-label',`Position ${i+1}: ${letter||'empty'}`);button.setAttribute('aria-pressed',String(!board.solved&&i===selected));button.disabled=busy||!!pending||board.solved||expired;button.onclick=()=>{selected=i;render();slots.children[i].focus();};button.onkeydown=event=>{
      if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();selected=(i+(event.key==='ArrowLeft'?-1:1)+board.length)%board.length;render();slots.children[selected].focus();}
      else if(['Backspace','Delete'].includes(event.key)){event.preventDefault();draft[i]=null;persist();render();slots.children[i].focus();}
      else if(board.candidates.includes(event.key.toUpperCase())){event.preventDefault();selected=i;put(event.key.toUpperCase());}
    };slots.append(button);}
    const history=$('#history');history.replaceChildren();
    if(!board.history.length){const p=document.createElement('p');p.textContent='No attempts yet.';history.append(p);}
    for(const [index,row] of [...board.history].reverse().map((row,index)=>[board.history.length-index,row])){
      const entry=document.createElement('div'),number=document.createElement('small'),guess=document.createElement('div'),counts=document.createElement('div');
      entry.className='hacking-history-row';entry.dataset.success=String(row.success);number.textContent=String(index);guess.className='hacking-history-guess';row.guess.forEach(letter=>guess.append(tokenNode(letter)));counts.className='hacking-counts';
      for(const [label,n] of [['Exact',row.exact],['Elsewhere',row.misplaced]]){const span=document.createElement('span');span.textContent=`${n} ${label}`;counts.append(span);}
      entry.append(number,guess,counts);history.append(entry);
    }
  }
  function showFeedback(){
    const last=board?.history.at(-1),output=$('#feedback');output.dataset.success=String(!!last?.success);
    output.textContent=last?(last.success?'Access granted.':`${last.exact} correctly positioned. ${last.misplaced} present elsewhere.`):'';
    output.classList.remove('signal');void output.offsetWidth;output.classList.add('signal');
  }
  async function create(){
    if(busy)return;busy=true;$('#error').textContent='';render();
    try{
      const result=await request('POST',{operation:'create',security:Number($('#security').value),firewall:Number($('#firewall').value),tier:Number($('#module').value)});
      token=result.token;board=result.board;draft=Array(board.length).fill(null);pending=null;selected=0;expired=false;
      $('#moduleArt').src=`hacking-module-tiers.svg#tier-${board.tier}`;$('#moduleArt').alt=`Hacking Module ${board.tier}`;persist();showFeedback();
    }catch(error){$('#error').textContent=error.message;}finally{busy=false;render();}
  }
  async function submit(event){
    event.preventDefault();if(busy||!board||expired)return;
    if(!pending)pending={requestId:crypto.randomUUID(),guess:[...draft]};persist();busy=true;$('#error').textContent='';render();
    try{board=await request('POST',pending);pending=null;draft=Array(board.length).fill(null);selected=0;persist();showFeedback();}
    catch(error){$('#error').textContent=expired?error.message:`${error.message} Your guess is retained.`;}
    finally{busy=false;render();}
  }
  $('#setup').onsubmit=event=>{event.preventDefault();create();};$('#guessForm').onsubmit=submit;
  $('#endPractice').onclick=async event=>{
    event.preventDefault();if(busy)return;busy=true;render();
    try{if(token)await request('DELETE');try{sessionStorage.removeItem(key);}catch{}location.assign('index.html');}
    catch(error){$('#error').textContent=error.message;busy=false;render();}
  };
  $('#clearGuess').onclick=()=>{draft=Array(board.length).fill(null);selected=0;persist();render();$('#slots').children[0]?.focus();};
  async function start(){
    if(!token){await create();return;}
    busy=true;render();
    try{board=await request('GET');if(pending&&board.history.some(row=>row.id===pending.requestId)){pending=null;draft=[];}draft=Array.from({length:board.length},(_,i)=>board.candidates.includes(draft[i])?draft[i]:null);$('#security').value=board.security;$('#firewall').value=board.firewall;$('#module').value=board.tier;$('#moduleArt').src=`hacking-module-tiers.svg#tier-${board.tier}`;$('#moduleArt').alt=`Hacking Module ${board.tier}`;persist();showFeedback();}
    catch(error){$('#error').textContent=error.message;$('#connection').textContent='CONNECTION UNAVAILABLE';}
    finally{busy=false;render();}
  }
  start();
}());
