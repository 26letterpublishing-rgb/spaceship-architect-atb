(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.SASaveFiles=api;})(typeof window==='object'?window:null,()=>{
 'use strict';
 const types=[
  ['story','Story Console','.sa2story','sa2story'],['system','Star System','.sa2system','sa2-system'],
  ['galaxy','Galaxy Map','.sa2galaxy','sa2-galaxy'],['planet','Planet','.sa2planet','sa2-planet'],
  ['region','Region','.sa2region','sa2-region'],['roster','NPC / Character Roster','.sa2roster','sa2roster'],
  ['shop','Shop','.sa2shop','sa2shop'],['arena','Arena','.sa2arena','sa2-arena'],
  ['character','Character','.sa2character','spaceship-architect-2e-character'],['ship','Starship','.sa2ship','spaceship-architect-2e-starship']
 ].map(([id,label,extension,format])=>({id,label,extension,format}));
 const type=id=>types.find(t=>t.id===id);
 function identify(file){const found=types.find(t=>t.format===file?.format);if(!found)throw Error('Choose a supported content save file. Campaign and Module files are loaded from Campaign settings.');if(found.id==='character'?!Number.isInteger(file.version)||file.version<1||file.version>7:file.version!==1)throw Error('Unsupported '+found.label+' file version.');return found;}
 function filename(value,kind){let name=String(value||'').trim().split(/[\\/]/).pop();if(!name||name.length>180||/[\x00-\x1f]/.test(name))throw Error('Enter a file name, up to 180 characters.');let selected=type(kind);const full=types.find(t=>name.toLowerCase().endsWith(t.extension+'.json'));if(full)name=name.slice(0,-5);const recognized=types.find(t=>name.toLowerCase().endsWith(t.extension));if(recognized)return {name,type:recognized.id};if(!selected)throw Error('Choose a save type.');if(/\.[a-z0-9]+$/i.test(name))throw Error('That extension is not supported. Choose the save type and paste its file name.');return {name:name+selected.extension,type:selected.id};}
 function fileCommand(value){
  const f=filename(value.fileName,value.type),out={label:String(value.label||f.name).trim().slice(0,100),fileName:f.name,type:f.type};
  if(value.alternatives!==undefined&&(!Array.isArray(value.alternatives)||value.alternatives.length>30))throw Error('Use up to 30 alternate files.');
  if(value.alternatives?.length)out.alternatives=value.alternatives.map(v=>{const n=filename(v.fileName,f.type);if(n.type!==f.type)throw Error('Alternatives must use the same save type.');const C=typeof module==='object'?require('./module-conditions'):window.SAModuleConditions,when=C.condition(v.when);if(!when.switches.length&&when.afterSeconds===undefined)throw Error('Choose a switch or time condition.');return {fileName:n.name,type:n.type,when};});
  return out;
 }
 function encodeCommand(value){return 'File:'+encodeURIComponent(JSON.stringify(fileCommand(value)));}
 function decodeCommand(raw){if(!raw.startsWith('File:'))return null;try{return fileCommand(JSON.parse(decodeURIComponent(raw.slice(5))));}catch{return null;}}
 function references(file){const out=[];if(file.moduleVariant)out.push(fileCommand({fileName:file.moduleVariant.baseFile,type:identify(file).id}));const walk=(v,depth=0)=>{if(depth>40)return;if(typeof v==='string'){for(const match of v.matchAll(/::(File:[^]*?)::/g)){const command=decodeCommand(match[1]);if(command)out.push(command,...(command.alternatives||[]));}}else if(v&&typeof v==='object'){if(v.source==='file'||v.source==='module'){try{const cmd=fileCommand(v);out.push(cmd,...(cmd.alternatives||[]));}catch{}}if(Array.isArray(v.alternatives))for(const r of v.alternatives){try{out.push(fileCommand(r));}catch{}}for(const [k,next]of Object.entries(v))if(!['legacyGrid','resizeBackup'].includes(k))walk(next,depth+1);}};walk(file);return [...new Map(out.map(r=>[r.fileName.toLowerCase(),r])).values()];}
 return {types,type,identify,filename,fileCommand,encodeCommand,decodeCommand,references};
});
