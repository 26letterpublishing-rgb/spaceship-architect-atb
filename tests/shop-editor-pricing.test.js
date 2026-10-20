const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const shops=require('../campaign-shops');
const source=fs.readFileSync(path.join(__dirname,'../shop-gm-ui.js'),'utf8');
function editor(shop,scope){
 const s=structuredClone(shop),fields={'[data-name]':{value:s.name},'[data-limit]':{value:''},'[data-percent]':{value:0},'[role=alert]':{}},saved=[];
 const selection=()=>scope==='all'?{map:s,key:'modifier',inherit:0}:scope==='category'?{map:s.categoryModifiers,key:'Weapons / Projectile',inherit:s.modifier}:{map:s.itemModifiers,key:'weapon:ballistic-sidearm',inherit:s.categoryModifiers['Weapons / Projectile']??s.modifier};
 const d={querySelector:k=>fields[k],close(){}},context={s,d,selection,preview(){const a=selection();fields['[data-percent]'].value=a.map[a.key]??a.inherit;},send:async body=>saved.push(structuredClone(body.shop))};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf(' function setPrice('),source.indexOf(' function preview(')),context);
 vm.runInContext(source.slice(source.indexOf(" d.querySelector('[data-percent]').oninput="),source.indexOf(" d.querySelector('[data-search]').oninput=")),context);
 vm.runInContext(source.slice(source.indexOf(' d.onclick=async'),source.indexOf(';renderStock();}',source.indexOf(' d.onclick=async'))+1),context);
 return {saved,s,input:value=>fields['[data-percent]'].oninput({target:{value}}),click:attribute=>d.onclick({target:{closest:()=>({dataset:{},hasAttribute:key=>key===attribute})}})};
}
const initial=()=>shops.normalize({id:'test',name:'Merchant',active:true,modifier:20,categoryModifiers:{'Weapons / Projectile':10},itemModifiers:{'weapon:ballistic-sidearm':-10}});
test('inherited item price stays inherited after Apply Changes and follows later category changes',async()=>{
 const e=editor(initial(),'item');await e.click('data-inherit');await e.click('data-save');const saved=e.saved[0];assert.equal(Object.hasOwn(saved.itemModifiers,'weapon:ballistic-sidearm'),false);
 saved.categoryModifiers['Weapons / Projectile']=50;assert.equal(shops.quote({shops:{list:[saved]}},'weapon:ballistic-sidearm').price,240);
});
test('inherited category price stays inherited and follows later shop changes',async()=>{
 const shop=initial();shop.itemModifiers={};const e=editor(shop,'category');await e.click('data-inherit');await e.click('data-save');const saved=e.saved[0];assert.equal(Object.hasOwn(saved.categoryModifiers,'Weapons / Projectile'),false);
 saved.modifier=50;assert.equal(shops.quote({shops:{list:[saved]}},'weapon:ballistic-sidearm').price,240);
});
test('explicit zero remains an override after saving',async()=>{
 const e=editor(initial(),'item');await e.click('data-reset');await e.click('data-save');const saved=e.saved[0];assert.equal(saved.itemModifiers['weapon:ballistic-sidearm'],0);saved.modifier=50;saved.categoryModifiers['Weapons / Projectile']=50;assert.equal(shops.quote({shops:{list:[saved]}},'weapon:ballistic-sidearm').price,160);
});
test('typed percentages save without requiring blur and can replace inherited prices',async()=>{
 const e=editor(initial(),'item');await e.click('data-inherit');e.input('-25');await e.click('data-save');assert.equal(shops.quote({shops:{list:[e.saved[0]]}},'weapon:ballistic-sidearm').price,120);
});
