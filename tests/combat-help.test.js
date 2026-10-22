const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {resolvePublicAsset}=require('../public-assets');
const root=path.resolve(__dirname,'..');
function fixture(gm=true,topic='atb'){
  let doc;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.hidden=false;this.disabled=false;this.isConnected=true;}
    setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}removeAttribute(k){delete this.attributes[k];}
    append(...nodes){for(const n of nodes){this.children.push(n);n.parentElement=this;}}replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    before(node){this.parentElement.append(node);}focus(){doc.activeElement=this;}addEventListener(){}showModal(){this.open=true;}close(){this.open=false;this.onclose?.();}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
    click(){if(!this.disabled)this.onclick?.();} querySelector(tag){return all(this).find(n=>n.tagName===tag.toUpperCase());}
  }
  const all=n=>[n,...n.children.flatMap(all)],body=new Element('body');
  doc={body,activeElement:null,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),getElementById:id=>all(body).find(n=>n.id===id)||null,querySelector:()=>({dataset:{tabPanel:topic,characterTab:topic}})};
  for(const id of [gm?'saveCampaignBackup':'pcHeaderMail',...(gm?['gmMailButton']:[])]){const el=new Element('button');el.id=id;body.append(el);}
  const win={document:doc,addEventListener(){},SAStarshipGuide:{figure:()=>new Element('figure')}};win.parent=win;
  const c=vm.createContext({window:win,document:doc,location:{href:'http://localhost/gm.html'},URL});
  for(const file of ['starship-help-content.js','combat-help-content.js','pc-help-content.js','pc-combat-help.js','pc-help-shots.js','app-help.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  doc.getElementById('appHelp').click();
  const dialog=()=>doc.getElementById('sa-app-help');
  const nodes=()=>all(dialog());
  const button=text=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
  const heading=()=>nodes().find(n=>n.tagName==='H2').textContent;
  return {c,doc,dialog,nodes,button,heading};
}
test('GM Help retains Overview and two themed branches with remembered pages',()=>{
 const f=fixture(),dialog=f.dialog();
 assert.match(f.heading(),/Prepare, then run/);assert.equal(f.button('Previous').disabled,true);
 assert.equal(f.button('Shared Controls'),undefined);assert.equal(f.button('Using Delay'),undefined);
 for(let i=0;i<4;i++)f.button('Next').click();
 assert.equal(f.button('Next').disabled,true);
 f.button('Surface Combat').click();assert.equal(dialog.dataset.combatHelpSection,'surface');assert.equal(dialog.style.background,'#432711');
 f.button('Next').click();assert.match(f.heading(),/Build and edit/);
 f.button('Starship Combat').click();assert.equal(dialog.style.background,'#302044');f.button('Next').click();f.button('Next').click();
 f.button('Surface Combat').click();assert.match(f.heading(),/Build and edit/);
 f.button('Previous').click();assert.equal(f.button('Previous').disabled,true);f.button('Overview').click();assert.match(f.heading(),/Use the Delay/);
 assert.equal(dialog.dataset.combatHelpSection,'shared');
 f.button('Dismiss').click();assert.equal(f.dialog(),null);assert.equal(f.doc.activeElement.id,'appHelp');
});
test('all fifteen GM pages render and their image assets are publicly available',()=>{
 const f=fixture(),data=f.c.window.SACombatHelpContent;
 for(const key of ['shared','surface','starship']){
  assert.equal(data[key].length,5);
  if(key!=='shared')f.button(key==='surface'?'Surface Combat':'Starship Combat').click();
  for(let i=0;i<5;i++){
   assert.equal(f.heading(),data[key][i][0]);
   for(const image of f.nodes().filter(n=>n.tagName==='IMG'))assert.ok(fs.existsSync(resolvePublicAsset(root,new URL(image.src).pathname)),image.src);
   if(i<4)f.button('Next').click();
  }
 }
 for(const shot of Object.values(data.shots))for(const [,y,x,ty]of shot.marks)assert.ok(x>=0&&x<=shot.w&&y>=0&&y<=shot.h&&ty>=0&&ty<=shot.h);
 assert.ok(resolvePublicAsset(root,'/combat-help-content.js'));
});

test('player Combat Help and other GM topics keep their original navigation',()=>{
  const pc=fixture(false);assert.ok(pc.button('Overview'));assert.ok(pc.button('Surface Combat'));assert.ok(pc.button('Starship Combat'));pc.button('Starship Combat').click();assert.equal(pc.dialog().dataset.combatHelpSection,'starship');pc.button('Next').click();const remembered=pc.heading();pc.button('Surface Combat').click();pc.button('Starship Combat').click();assert.equal(pc.heading(),remembered);
  const shop=fixture(true,'shop');assert.equal(shop.button('Surface Combat'),undefined);const original=shop.button('Next');shop.button('Next').click();assert.equal(shop.button('Next'),original);assert.equal(shop.nodes().filter(n=>n.tagName==='IMG').length,1);
  const story=fixture(true,'story');
  for(const image of story.nodes().filter(n=>n.tagName==='IMG'))assert.ok(fs.existsSync(resolvePublicAsset(root,new URL(image.src).pathname)),image.src);
});

test('all 32 noncombat PC pages preserve their handoff sequences and load real screenshots',()=>{
 for(const [topic,count] of Object.entries({characters:8,campaign:6,starships:9,settings:4,shop:5})){
  const f=fixture(false,topic),pages=f.c.window.SAPCHelpContent[topic];assert.equal(pages.length,count);
  for(let i=0;i<count;i++){assert.equal(f.heading(),pages[i][0]);assert.ok(f.nodes().some(n=>n.tagName==='IMG'),topic+' page '+(i+1));for(const img of f.nodes().filter(n=>n.tagName==='IMG'))assert.ok(fs.existsSync(resolvePublicAsset(root,new URL(img.src).pathname)),img.src);if(i<count-1)f.button('Next').click();}
  assert.equal(f.button('Next').disabled,true);
 }
 const f=fixture(false,'starships');assert.deepEqual(Array.from(f.c.window.SAPCHelpContent.starships,p=>p[0]),['Your Starships','Ship Information and Statistics','Life Aboard Your Starship','Movement and Stations','Consoles and Ship Interactions','Ship Condition and Repairs','Equipment, Storage, and Upgrades','Crew and Ship Access','Starships During Travel and Combat']);
});
test('all 20 PC Combat pages stay within their branch and screenshot crops fit their source',()=>{
 const f=fixture(false),data=f.c.window.SAPCCombatHelp;
 for(const [key,label,count]of [['shared','Overview',5],['surface','Surface Combat',9],['starship','Starship Combat',6]]){
  f.button(label).click();assert.equal(data[key].length,count);
  for(let i=0;i<count;i++){assert.equal(f.heading(),data[key][i][0]);if(i<count-1)f.button('Next').click();}
  assert.equal(f.button('Next').disabled,true);
 }
 for(const [key,shot]of Object.entries(f.c.window.SAPCHelpShots)){assert.ok(fs.existsSync(resolvePublicAsset(root,'/'+shot.file)),key);assert.ok((shot.cropTop||0)+(shot.height||shot.h)<=shot.h,key+' crop');assert.ok(shot.w>0&&shot.h>0&&shot.width>0);}
 for(const name of ['pc-help-content.js','pc-combat-help.js','pc-help-shots.js','campaign-location.js'])assert.ok(resolvePublicAsset(root,'/'+name));
});
