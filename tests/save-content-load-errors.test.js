const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const types=require('../save-file-types'),source=fs.readFileSync(require.resolve('../save-content-ui'),'utf8');
function fixture(){
 const notices=[],loads=[];let input,failLoad=false;
 const context={T:types,notice:m=>notices.push(m),load:async(file,config)=>{if(failLoad)throw Error('PRIVATE FILE CONTENT');loads.push({file,config});return 'opened';},document:{createElement:()=>input={files:[],click(){}}}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf(' function pick('),source.indexOf(' async function save('))+source.slice(source.indexOf(' async function chooseLoad('),source.indexOf(' async function attach(')),context);
 return {notices,loads,context,get input(){return input;},fail(){failLoad=true;},recover(){failLoad=false;}};
}
const file=(value,name='example.sa2shop')=>({name,size:40,text:async()=>JSON.stringify(value)});
const shop={format:'sa2shop',version:1,shop:{name:'Example'}};
async function select(f,files,kind='shop',target,extra){const done=f.context.chooseLoad(kind,target,extra);f.input.files=files;await f.input.onchange();return done;}
test('picker cancellation and an empty selection remain silent and do not load',async()=>{
 const f=fixture(),done=f.context.chooseLoad('shop');f.input.oncancel();await done;await select(f,[]);assert.deepEqual(f.notices,[]);assert.deepEqual(f.loads,[]);
});
test('damaged, unreadable and oversized files report safely and permit a valid retry',async()=>{
 for(const bad of [{name:'private.sa2shop',size:5,text:async()=>'PRIVATE SECRET CONTENT'}, {name:'private.sa2shop',size:5,text:async()=>{throw Error('PRIVATE PATH OR CONTENT');}}, {name:'private.sa2shop',size:40*1024*1024+1,text:async()=>{throw Error('must not read oversized file');}}]){
  const f=fixture();await select(f,[bad]);assert.equal(f.loads.length,0);assert.equal(f.notices.length,1);assert.match(f.notices[0],/read|valid/i);assert.ok(!f.notices[0].includes('PRIVATE'));assert.ok(!f.notices[0].includes('private.sa2shop'));
  await select(f,[file(shop)]);assert.equal(f.loads.length,1);
 }
});
test('wrong type, unsupported version and load preparation failure do not reject or reveal contents',async()=>{
 for(const value of [{format:'sa2story',version:1}, {...shop,version:999},{format:'PRIVATE CONTENT',version:1}]){
  const f=fixture();await select(f,[file(value)]);assert.equal(f.loads.length,0);assert.equal(f.notices.length,1);assert.ok(!f.notices[0].includes('PRIVATE'));await select(f,[file(shop)]);assert.equal(f.loads.length,1);
 }
 const f=fixture();f.fail();await select(f,[file(shop)]);assert.equal(f.notices.length,1);assert.ok(!f.notices[0].includes('PRIVATE'));f.recover();await select(f,[file(shop)]);assert.equal(f.loads.length,1);
});
test('every shared content type preserves destination, options, filename and successful return value',async()=>{
 for(const type of types.types){
  const f=fixture(),value={format:type.format,version:1},target={mapId:'map',starId:'star',planetId:'planet',hex:'2'},extra={scriptShop:true,entryId:'entry',newCopy:true};
  const result=await select(f,[file(value,'selected'+type.extension)],type.id,target,extra);
  assert.equal(result,'opened');assert.deepEqual(f.notices,[]);assert.equal(f.loads.length,1);assert.equal(f.loads[0].config.target,target);assert.equal(f.loads[0].config.scriptShop,true);assert.equal(f.loads[0].config.entryId,'entry');assert.equal(f.loads[0].config.newCopy,true);assert.equal(f.loads[0].config.fileName,'selected'+type.extension);assert.equal(f.loads[0].file.format,type.format);
 }
});
