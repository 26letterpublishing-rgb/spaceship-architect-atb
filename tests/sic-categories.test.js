const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const categories=require('../sic-categories'),maps=require('../ship-map-core'),ammunition=require('../missile-ammunition'),{resolvePublicAsset}=require('../public-assets');
const root=path.resolve(__dirname,'..');
test('category regrouping preserves every purchasable and owned card identity, including duplicates and unknown saved types',()=>{
 const catalog={...maps.catalog,...ammunition.catalog};
 const items=Object.keys(catalog).map((type,index)=>({id:'owned-'+index,type}));
 items.push({id:'another-shield',type:'shield-1'},{id:'old-save-card',type:'unknown-legacy-card'});
 const before=JSON.stringify(items),groups=categories.group(items,item=>catalog[item.type]||{}),result=groups.flatMap(group=>group.items);
 assert.equal(result.length,items.length);assert.equal(new Set(result).size,items.length);assert.equal(JSON.stringify(items),before);
 for(const item of items)assert.equal(result.filter(entry=>entry===item).length,1);
 for(const group of groups){assert.ok(group.items.length);assert.ok(group.label);assert.deepEqual(group.items,[...group.items].sort((a,b)=>items.indexOf(a)-items.indexOf(b)));}
});
test('all missile ammunition stays beside weapons and new mixed-role SICs have a usable home',()=>{
 for(const [type,definition]of Object.entries(ammunition.catalog))assert.equal(categories.category(type,definition),'weapons',type);
 for(const [type,expected]of [['ballistic-rail-repeater','weapons'],['static-shield','defense'],['hull-plating','defense'],['bar','crew'],['hibernation-chamber','crew'],['brig','security'],['hacking-bug','security'],['shield-breacher','sensors']])assert.equal(categories.category(type,maps.definition(type)),expected,type);
});
test('new market artwork and hover previews resolve to served WebPs without needing private source assets',()=>{
 assert.ok(resolvePublicAsset(root,'/sic-categories.js'));
 const files=new Set();
 for(const type of ['bar','hibernation-chamber','brig','ballistic-rail-repeater','hull-plating','heat-resistance','laser-resistance','static-shield']){
  const d=maps.definition(type);assert.ok(d.cardArt,type+' has market art');
  for(const property of ['cardArt','image','floorplanPreview','sprite'])if(d[property]){
   const url=new URL(d[property],'http://localhost/'),file=resolvePublicAsset(root,url.pathname);assert.ok(file,type+' '+property+' is public');
   const bytes=fs.readFileSync(file);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');files.add(file);
  }
 }
 assert.ok([...files].reduce((sum,file)=>sum+fs.statSync(file).size,0)<2*1024*1024,'The new card and preview images stay below 2 MiB together');
});
test('the actual builder registers Hull and Static cards and retains them when confirming or reopening a saved ship',()=>{
 const vm=require('node:vm'),source=fs.readFileSync(path.join(root,'starship.js'),'utf8'),cards=[];
 const context={window:{SAShipMap:maps,SAMissileAmmo:require('../missile-ammunition'),SADelayRules:require('../delay-rules')},SIC_CATALOG:{},document:{createElement:()=>({}),querySelector:()=>({append:card=>cards.push(card)})},clone:value=>JSON.parse(JSON.stringify(value))};
 const loop=source.indexOf('for(const [type,rules,impairment] of [');
 vm.runInNewContext(source.slice(loop,source.indexOf("for(const tier of [1,2,3,4,5,'mine']){",loop)),context);
 const start=source.indexOf('function constructionState(');vm.runInNewContext(source.slice(start,source.indexOf('function defaultDraft(',start)),context);
 const ship={gridCells:[21,22,23,24],sicInventory:[],placements:[]};
 for(const type of ['hull-plating','heat-resistance','laser-resistance','static-shield']){
  const d=context.SIC_CATALOG[type];assert.equal(d.name,maps.definition(type).name);assert.ok(d.floorplanPreview);
  const card=cards.filter(c=>c.innerHTML.includes('data-sic-card="'+type+'"'));assert.equal(card.length,1,type+' has exactly one market card');assert.ok(card[0].innerHTML.includes('data-purchase-sic="'+type+'"'));
  const attachTo=d.hullUpgrade?'hull':'shield-host';ship.sicInventory.push({id:type,type,attachTo,purchasePrice:maps.sicPrice({type},ship)});ship.placements.push({sicId:type,cell:21});
 }
 const reopened=context.constructionState(context.constructionState(ship));assert.equal(reopened.sicInventory.length,4);assert.equal(reopened.placements.length,4);
 for(const item of reopened.sicInventory){assert.equal(item.attachTo,item.type==='static-shield'?'shield-host':'hull');assert.equal(item.storage,false);assert.equal(item.pendingPurchase,false);}
});
