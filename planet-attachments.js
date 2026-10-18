'use strict';
// Hex attachments reuse the portable formats and their existing import paths.
function normalize(raw={}) {
  const out={};
  for(const kind of ['npc','encounter','story']) {
    if(!raw[kind])continue;
    const file=raw[kind];
    if(JSON.stringify(file).length>2000000)throw Error('Each location attachment must be smaller than 2 MB.');
    if(kind==='story')require('./story-files').parse(file);
    if(kind==='encounter'&&require('./arena-files').parse(file).mode!=='surface')throw Error('Attach a surface combat encounter.');
    if(kind==='npc'&&(file.format!=='sa2roster'||file.version!==1||!Array.isArray(file.npcs)||!file.npcs.length||file.npcs.length>100||file.npcs.some(n=>!n?.name)))throw Error('Choose a saved roster containing NPCs.');
    out[kind]=kind==='npc'?{format:'sa2roster',version:1,characters:[],npcs:file.npcs.map(n=>({...structuredClone(n),allyNpc:true}))}:structuredClone(file);
  }
  return out;
}
module.exports={normalize};
