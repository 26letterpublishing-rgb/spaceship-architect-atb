'use strict';
const crypto=require('node:crypto'),zlib=require('node:zlib'),types=require('./save-file-types');
const MAX_FILE=16*1024*1024,MAX_TOTAL=64*1024*1024,MAX_PACKAGE=40*1024*1024;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function metadata(options){const title=String(options.title||'').trim().slice(0,120);if(!title)throw Error('Enter a module title.');return {title,author:String(options.author||'').slice(0,120),version:String(options.version||'1.0').slice(0,40),instructions:String(options.instructions||'').slice(0,12000)};}
function unpack(entry){if(entry.encoding!=='gzip-base64'||typeof entry.data!=='string')throw Error('Unsupported packaged file encoding.');let bytes;try{bytes=zlib.gunzipSync(Buffer.from(entry.data,'base64'),{maxOutputLength:MAX_FILE});}catch{throw Error('A packaged file is damaged or exceeds 16 MB.');}if(bytes.length!==entry.bytes||hash(bytes)!==entry.digest)throw Error('Packaged file checksum does not match: '+entry.fileName);let file;try{file=JSON.parse(bytes.toString('utf8'));}catch{throw Error('Invalid saved file: '+entry.fileName);}if(types.identify(file).id!==entry.type)throw Error('Packaged file type does not match its index.');return file;}
function identity(metadata,entries){return hash(JSON.stringify({metadata,entries:entries.map(({id,fileName,type,digest,start,destination})=>({id,fileName,type,digest,start,destination}))}));}
function create(options){
 if(!Array.isArray(options.files)||!options.files.length||options.files.length>500)throw Error('Add between 1 and 500 saved files.');
 const names=new Set(),digests=new Set();let total=0;const entries=options.files.map((item,index)=>{
  const kind=types.identify(item.file),named=types.filename(item.fileName,kind.id);if(named.type!==kind.id)throw Error('The extension does not match '+item.fileName);
  if(names.has(named.name.toLowerCase()))throw Error('Two files have the same name: '+named.name);names.add(named.name.toLowerCase());
  require('./campaign-content').validate(item.file);if(item.start&&item.file.moduleVariant)throw Error('Alternate files cannot Load at Start. Use a default file instead.');const bytes=Buffer.from(JSON.stringify(item.file));total+=bytes.length;if(bytes.length>MAX_FILE||total>MAX_TOTAL)throw Error('Use files up to 16 MB each, totaling no more than 64 MB.');const digest=hash(bytes);if(digests.has(digest))throw Error('The same content was added more than once: '+named.name);digests.add(digest);
  return {id:'entry-'+index,fileName:named.name,type:kind.id,bytes:bytes.length,digest,start:item.start===true,destination:cleanDestination(item.destination),encoding:'gzip-base64',data:zlib.gzipSync(bytes).toString('base64'),references:types.references(item.file)};
 });
 const external=entries.flatMap(e=>e.references.filter(r=>!names.has(r.fileName.toLowerCase())).map(r=>({from:e.fileName,...r})));
 if(external.length&&!options.allowExternal)throw Error('Missing files: '+[...new Set(external.map(r=>r.fileName))].join(', ')+'. Add them, or explicitly allow external file prompts.');
 const info=metadata(options),file={format:'spaceship-architect-adventure',version:2,id:identity(info,entries),metadata:info,entries,external};if(JSON.stringify(file).length>MAX_PACKAGE)throw Error('This Module exceeds the 40 MB package limit.');return file;
}
function cleanDestination(d={}){return Object.fromEntries(['galaxy','star','planet','hex','regionId'].filter(k=>d?.[k]!=null&&d[k]!=='').map(k=>[k,String(d[k]).slice(0,180)]));}
function read(file){
 if(file?.format!=='spaceship-architect-adventure'||file.version!==2||!Array.isArray(file.entries)||!file.entries.length||file.entries.length>500)throw Error('Choose a supported Module package.');
 if(JSON.stringify(file).length>MAX_PACKAGE)throw Error('This Module exceeds 40 MB.');const info=metadata(file.metadata),names=new Set(),ids=new Set();let total=0;
 for(const e of file.entries){if(!e||typeof e.id!=='string'||e.id.length>100||ids.has(e.id)||!types.type(e.type)||!Number.isInteger(e.bytes)||e.bytes<1||e.bytes>MAX_FILE||typeof e.digest!=='string'||!/^[a-f0-9]{64}$/.test(e.digest))throw Error('Invalid Module index.');ids.add(e.id);const name=types.filename(e.fileName,e.type);if(name.name!==e.fileName||name.type!==e.type||names.has(name.name.toLowerCase()))throw Error('Invalid or duplicate packaged filename.');names.add(name.name.toLowerCase());total+=e.bytes;if(total>MAX_TOTAL)throw Error('The expanded Module exceeds 64 MB.');const content=unpack(e);require('./campaign-content').validate(content);if(e.start&&content.moduleVariant)throw Error('Alternate files cannot Load at Start.');}
 if(file.id!==identity(info,file.entries))throw Error('The Module index has changed or is damaged.');
 return {...file,metadata:info};
}
function index(file){const switches=new Set();const entries=file.entries.map(e=>{const content=unpack(e),moduleVariant=require('./module-conditions').variant(content.moduleVariant);for(const a of content.actions||[])if(a.kind==='switch')switches.add(a.keyword);for(const s of moduleVariant?.when.switches||[])switches.add(s.keyword);if(moduleVariant?.when.sinceSwitch)switches.add(moduleVariant.when.sinceSwitch);return {id:e.id,fileName:e.fileName,type:e.type,bytes:e.bytes,digest:e.digest,start:e.start,destination:cleanDestination(e.destination),...(moduleVariant?{moduleVariant}:{})};});return {id:file.id,...file.metadata,entries,switches:[...switches],external:file.external||[]};}
function start(c,file,helpers){const pkg=read(file);c.moduleSource=index(pkg);c.module=pkg.metadata;const order=['galaxy','system','planet','region','character','roster','ship','shop','story','arena'];for(const e of [...pkg.entries].filter(e=>e.start).sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type)))require('./campaign-content').load(c,{file:unpack(e),key:pkg.id+'/'+e.id,destination:e.destination,starting:true,confirmReplace:true},helpers);return c;}
module.exports={create,read,unpack,index,start,hash,MAX_FILE,MAX_TOTAL};
