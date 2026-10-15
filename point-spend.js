// Shared Point Spend presentation. Authoritative balances always update immediately.
(function(root){
  const states=new Map();
  const format=n=>Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:2});
  function sample(state,now){
    const elapsed=now-state.started;
    if(state.reducedMotion)return {value:state.target,delta:state.delta,opacity:elapsed<850?1:0,done:elapsed>=850};
    const progress=Math.min(1,Math.max(0,(elapsed-850)/450));
    return {value:progress>=1?state.target:Math.round(state.from+(state.target-state.from)*(1-(1-progress)**3)),delta:state.delta,opacity:Math.max(0,Math.min(1,(850-elapsed)/200)),done:elapsed>=1300};
  }
  function update(node,value,{key,scope='',suffix='',positiveGreen=false}={}){
    if(!node||!Number.isFinite(value))return;
    const id=String(scope)+':'+(key||node.id),now=performance.now();let state=states.get(id);
    if(!state){state={target:value,from:value,delta:0,started:now-2000};states.set(id,state);}
    else if(state.target!==value){const from=sample(state,now).value;Object.assign(state,{from,target:value,delta:value-state.target,started:now});}
    Object.assign(state,{node,suffix,positiveGreen,reducedMotion:!!root?.matchMedia?.('(prefers-reduced-motion: reduce)').matches});
    function paint(){
      const n=state.node;if(!n?.isConnected){state.frame=0;return;}
      const s=sample(state,performance.now());n.classList.add('point-spend-readout');
      const current=n.ownerDocument.createElement('span');current.textContent=format(s.value);current.className='point-spend-current';
      if(state.positiveGreen&&state.target>=1)current.style.color='#65e89a';
      n.replaceChildren(current,n.ownerDocument.createTextNode(state.suffix));
      if(!s.done&&state.delta){const delta=n.ownerDocument.createElement('span');delta.className='point-spend-delta';delta.textContent=(state.delta>0?'+':'−')+format(Math.abs(state.delta));delta.style.color=state.delta>0?'#65e89a':'#ff536d';delta.style.opacity=s.opacity;delta.setAttribute('aria-hidden','true');n.prepend(delta);}
      n.setAttribute('aria-label',format(state.target)+state.suffix);
      state.frame=!s.done?requestAnimationFrame(paint):0;
    }
    if(state.frame)cancelAnimationFrame(state.frame);paint();
  }
  const api={update,sample};if(typeof module==='object')module.exports=api;if(root)root.SAPointSpend=api;
})(typeof window==='object'?window:null);
