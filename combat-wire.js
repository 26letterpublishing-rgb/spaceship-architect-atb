(function(root){
  const object=v=>v!==null&&typeof v==='object';
  function diff(before,after,path=[],changes=[]){
    if(before===after)return changes;
    if(!object(before)||!object(after)||Array.isArray(before)!==Array.isArray(after)||(Array.isArray(after)&&before.length!==after.length))changes.push([path,after]);
    else {
      for(const key of Object.keys(before))if(!Object.hasOwn(after,key))changes.push([[...path,key]]);
      for(const key of Object.keys(after))diff(before[key],after[key],[...path,key],changes);
    }
    return changes;
  }
  function apply(state,packet){
    if(!state||state.revision!==packet.base)throw new Error('Combat update needs a fresh snapshot');
    let result=state;
    for(const [path,value] of packet.changes){
      if(path.some(key=>['__proto__','prototype','constructor'].includes(key)))throw new Error('Invalid combat update');
      if(!path.length){result=value;continue;}
      const copy=v=>Array.isArray(v)?v.slice():{...v};
      result=copy(result);let node=result;
      for(const key of path.slice(0,-1)){node[key]=copy(node[key]);node=node[key];}
      if(value===undefined)delete node[path.at(-1)];else node[path.at(-1)]=value;
    }
    return result;
  }
  const api={diff,apply};if(typeof module==='object')module.exports=api;else root.SACombatWire=api;
}(typeof window==='object'?window:globalThis));
