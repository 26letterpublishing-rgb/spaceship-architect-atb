(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.SASpaceObjects=api;}(typeof window!=='undefined'?window:null,function(){
  const minerals=['Aethion','Infinium','Carmot','Dark Phaeon','Endernium','Necronium','Phaeon','Drakkonite','Mirium','Argol','Paradon','Crystilium','Ragnoron','Transphaerion','Xpidinium','Umbernium','Umbrexium','Dianium','Zennium','Ruplium','Crinium','Zeltexa','Magnesium','Iron'];
  function defaultName(kind,mineral='Iron'){
    return kind==='mineral'?`${mineral} Deposit`:kind==='asteroid'?'Asteroid':kind==='planet'?'Unnamed Planet':'Named Object';
  }
  function withPositions(objects,points){
    const positions=new Map(points.map(p=>[p.id,p]));
    return objects.map(o=>{
      const p=positions.get(o.id);
      return p&&Number.isInteger(p.q)&&Number.isInteger(p.r)&&Math.abs(p.q)<=10000&&Math.abs(p.r)<=10000?{...o,q:p.q,r:p.r}:o;
    });
  }
  function suggestedPosition(occupied,kind,origin={q:0,r:2}){
    const center={q:Math.max(-10000,Math.min(10000,Math.round(Number(origin.q)||0))),r:Math.max(-10000,Math.min(10000,Math.round(Number(origin.r)||0)))};
    const radius=kind==='planet'?1:0;
    const fits=p=>Math.abs(p.q)<=10000&&Math.abs(p.r)<=10000&&occupied.every(o=>{
      const dq=p.q-o.q,dr=p.r-o.r,distance=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));
      return !Number.isFinite(distance)||distance>radius+(o.kind==='planet'?1:0);
    });
    for(let ring=0;ring<=200;ring++)for(let dq=-ring;dq<=ring;dq++)for(let dr=Math.max(-ring,-dq-ring);dr<=Math.min(ring,-dq+ring);dr++){
      if(Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))!==ring)continue;
      const p={q:center.q+dq,r:center.r+dr};if(fits(p))return p;
    }
    throw Error('Choose a free hex for the next object.');
  }
  function normalize(values=[]){
    if(!Array.isArray(values)||values.length>100)throw Error('Place at most 100 space objects.');
    const ids=new Set();return values.map(o=>{
      if(!o||!/^object-[\w-]{4,90}$/.test(o.id)||ids.has(o.id))throw Error('Each space object needs a unique identifier.');ids.add(o.id);
      if(!['mineral','asteroid','object','planet'].includes(o.kind)||typeof o.name!=='string'||!o.name.trim()||o.name.length>80)throw Error('Choose an object type and name (up to 80 characters).');
      if(!Number.isInteger(o.q)||!Number.isInteger(o.r)||Math.abs(o.q)>10000||Math.abs(o.r)>10000)throw Error('Object coordinates must be whole hexes within the map.');
      if(!Number.isInteger(o.quantity)||o.quantity<1||o.quantity>10000)throw Error('Object quantity must be between 1 and 10,000.');
      if(o.kind==='mineral'&&!minerals.includes(o.mineral))throw Error('Choose a supported mineral.');
      return {id:o.id,kind:o.kind,name:o.name.trim(),q:o.q,r:o.r,quantity:o.quantity,mineral:o.kind==='mineral'?o.mineral:null,...(o.kind==='planet'?{quantity:1,variant:['ocean','desert','ice','volcanic'].includes(o.variant)?o.variant:['ocean','desert','ice','volcanic'][[...o.id].reduce((n,c)=>n+c.charCodeAt(0),0)%4],...(Number.isFinite(o.destroyedAt)&&o.destroyedAt>0?{destroyedAt:o.destroyedAt,destroyedBy:String(o.destroyedBy||'')}:{} )}: {})};
    });
  }
  function reconcile(previous,draft,next){
    if(previous===null)return structuredClone(next);
    const old=new Map(previous.map(o=>[o.id,o])),incoming=new Map(next.map(o=>[o.id,o]));
    const merged=draft.filter(o=>!old.has(o.id)||incoming.has(o.id)).map(o=>{
      const unchanged=JSON.stringify(o)===JSON.stringify(old.get(o.id));
      return unchanged?incoming.get(o.id):o;
    });
    for(const o of next)if(!old.has(o.id)&&!merged.some(d=>d.id===o.id))merged.push(o);
    return structuredClone(merged);
  }
  function mergeDraftPositions(previous,updates,shipIds){
    const merged=new Map();
    for(const p of [...previous,...updates])if(p&&shipIds.includes(p.id)&&Number.isFinite(p.q)&&Number.isFinite(p.r)&&Math.abs(p.q)<=10000&&Math.abs(p.r)<=10000)merged.set(p.id,{id:p.id,q:Math.round(p.q),r:Math.round(p.r)});
    return [...merged.values()];
  }
  function restoreDraft(draft,current,shipIds){
    const objects=reconcile(normalize(draft.baseline),normalize(draft.objects),current);
    const positions=mergeDraftPositions([],Array.isArray(draft.positions)?draft.positions:[],shipIds);
    return {objects,positions};
  }
  return {minerals,defaultName,withPositions,suggestedPosition,normalize,reconcile,restoreDraft,mergeDraftPositions};
}));
