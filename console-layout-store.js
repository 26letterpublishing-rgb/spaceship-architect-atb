(function(root){
 'use strict';
 const key='sa-alma-workspace-v2',legacyKey='sa-console-layout-proposal-warp-v1',schema='sa-alma-workspace/v2';
 const clone=v=>JSON.parse(JSON.stringify(v));
 function sync(w){for(const p of Object.values(w.layouts)){p.typeNotes=clone(w.typeNotes);for(const s of p.sections)if(Object.hasOwn(w.sectionNotes[p.consoleId]||{},s.id))s.notes=w.sectionNotes[p.consoleId][s.id];}return w;}
 function fresh(){return {schema,typeNotes:{},sectionNotes:{},layouts:{},legacySource:null};}
 function validate(w,catalog,api){
  if(!w||w.schema!==schema||!w.layouts||!w.typeNotes||!w.sectionNotes||[w.layouts,w.typeNotes,w.sectionNotes].some(x=>typeof x!=='object'||Array.isArray(x)))throw Error('Invalid ALMA workspace; saved data retained.');
  const types=new Set(catalog.consoleTypes.map(t=>t.id));
  for(const [type,note]of Object.entries(w.typeNotes))if(!types.has(type)||typeof note!=='string'||note.length>4000)throw Error('Invalid Console type note.');
  for(const [type,notes]of Object.entries(w.sectionNotes)){if(!types.has(type)||!notes||typeof notes!=='object'||Array.isArray(notes))throw Error('Invalid section notes.');for(const [id,note]of Object.entries(notes))if(!Object.values(catalog.baselines).some(b=>b.consoleId===type&&b.boxes.some(s=>s.id===id))||typeof note!=='string'||note.length>4000)throw Error('Unknown section or invalid note.');}
  const next=clone(w);for(const [id,value]of Object.entries(w.layouts)){if(!catalog.baselines[id])throw Error('Unknown Console variant.');next.layouts[id]=api.validate(value,catalog.baselines[id]);}
  return next;
 }
 function importLegacy(w,value,raw,catalog,api){
  const base=catalog.baselines['warp-drive-1'],legacy=api.validate(value,base),next=clone(w);
  next.layouts['warp-drive-1']=clone(legacy);Object.assign(next.typeNotes,legacy.typeNotes);next.sectionNotes.warp=Object.fromEntries(legacy.sections.map(s=>[s.id,s.notes]));next.legacySource=raw;return next;
 }
 function load(storage,catalog,api){const raw=storage.getItem(key);if(raw)return validate(JSON.parse(raw),catalog,api);const legacy=storage.getItem(legacyKey);return legacy?importLegacy(fresh(),JSON.parse(legacy),legacy,catalog,api):fresh();}
 function proposal(w,id,catalog,api){const base=catalog.baselines[id];if(!base)throw Error('Unknown Console variant.');const p=w.layouts[id]?api.validate(w.layouts[id],base):api.fresh(base);p.typeNotes=clone(w.typeNotes);for(const s of p.sections)if(Object.hasOwn(w.sectionNotes[base.consoleId]||{},s.id))s.notes=w.sectionNotes[base.consoleId][s.id];return p;}
 function put(w,id,p,catalog,api){const next=clone(w),base=catalog.baselines[id],valid=api.validate(p,base);next.layouts[id]=valid;next.typeNotes=clone(valid.typeNotes);next.sectionNotes[base.consoleId]||={};for(const s of valid.sections)next.sectionNotes[base.consoleId][s.id]=s.notes;return sync(next);}
 function merge(w,patch,catalog,api){
  validate(w,catalog,api);
  // Reuse the existing strict batch validation before changing any note.
  api.mergeCompletions(api.fresh(catalog.baselines['warp-drive-1']),patch,catalog.baselines['warp-drive-1']);
  const next=clone(w),applied=[],alreadyApplied=[],conflicts=[];
  for(const u of patch.updates){const target=u.consoleType+(u.scope==='section'?' / '+u.sectionId:' / type notes');let owner,field;
   if(!catalog.consoleTypes.some(t=>t.id===u.consoleType)){conflicts.push({target,reason:'Unknown Console type'});continue;}
   if(u.scope==='type'){owner=next.typeNotes;field=u.consoleType;}else{
    const base=Object.values(catalog.baselines).find(b=>b.consoleId===u.consoleType&&b.baselineId===u.baselineId&&b.boxes.some(s=>s.id===u.sectionId));
    if(!base){conflicts.push({target,reason:'Unknown section or changed baseline'});continue;}owner=next.sectionNotes[u.consoleType];field=u.sectionId;
   }
   if(!owner||typeof owner[field]!=='string'){conflicts.push({target,reason:'Original note no longer exists'});continue;}
   if(owner[field]===u.updatedNote){alreadyApplied.push(target);continue;}
   if(owner[field]!==u.originalNote){conflicts.push({target,reason:'Note changed after export; retained newer text',originalNote:u.originalNote,currentNote:owner[field]});continue;}
   owner[field]=u.updatedNote;applied.push(target);
  }
  return {state:sync(next),applied,alreadyApplied,conflicts};
 }
 function notes(w,catalog){return {schema:'sa-alma-notes/v2',scope:'Proposed changes only; production content unchanged.',consoleTypeNotes:Object.entries(w.typeNotes).map(([consoleType,notes])=>({consoleType,label:catalog.consoleTypes.find(t=>t.id===consoleType)?.label||consoleType,appliesTo:'All variants of this Console type',notes})),sectionNotes:Object.entries(w.sectionNotes).flatMap(([consoleType,sections])=>Object.entries(sections).map(([sectionId,notes])=>({consoleType,sectionId,notes,baselines:Object.entries(catalog.baselines).filter(([,b])=>b.consoleId===consoleType&&b.boxes.some(s=>s.id===sectionId)).map(([variantId,b])=>({variantId,baselineId:b.baselineId}))}))),layouts:clone(w.layouts)};}
 function exportWorkspace(w,catalog,api){const next=validate(w,catalog,api);delete next.legacySource;for(const id of Object.keys(next.layouts))next.layouts[id]=api.instructions(proposal(next,id,catalog,api),catalog.baselines[id]);return {...next,intent:'PROPOSAL ONLY: no production changes are authorized by this file alone.'};}
 const api={key,legacyKey,schema,fresh,validate,load,importLegacy,proposal,put,merge,notes,exportWorkspace};if(typeof module==='object')module.exports=api;else root.SAConsoleLayoutStore=api;
})(typeof window==='object'?window:globalThis);
