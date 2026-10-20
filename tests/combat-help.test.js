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
    click(){if(!this.disabled)this.onclick?.();}
  }
  const all=n=>[n,...n.children.flatMap(all)],body=new Element('body');
  doc={body,activeElement:null,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),getElementById:id=>all(body).find(n=>n.id===id)||null,querySelector:()=>({dataset:{tabPanel:topic,characterTab:topic}})};
  for(const id of [gm?'saveCampaignBackup':'pcHeaderMail',...(gm?['gmMailButton']:[])]){const el=new Element('button');el.id=id;body.append(el);}
  const win={document:doc,addEventListener(){},SAStarshipGuide:{figure:()=>new Element('figure')}};win.parent=win;
  const c=vm.createContext({window:win,document:doc,location:{href:'http://localhost/gm.html'},URL});
  for(const file of ['starship-help-content.js','combat-help-content.js','app-help.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
  doc.getElementById('appHelp').click();
  const dialog=()=>doc.getElementById('sa-app-help');
  const nodes=()=>all(dialog());
  const button=text=>nodes().find(n=>n.tagName==='BUTTON'&&n.textContent===text);
  const heading=()=>nodes().find(n=>n.tagName==='H2').textContent;
  return {c,doc,dialog,nodes,button,heading};
}
test('GM Help navigates shared and selected combat pages without losing section positions',()=>{
  const f=fixture(),dialog=f.dialog();
  assert.match(f.heading(),/Prepare, then run/);assert.equal(f.button('Previous').disabled,true);
  f.button('Using Delay').click();assert.equal(f.nodes().filter(n=>n.tagName==='IMG').length,2);
  f.button('Next').click();assert.match(f.heading(),/^Surface Combat/);
  f.button('Arena Tools').click();assert.match(f.heading(),/Build and edit/);
  assert.equal(f.doc.activeElement.textContent,'Arena Tools');
  f.button('Starship Combat').click();f.button('Space Map').click();assert.equal(f.nodes().filter(n=>n.tagName==='IMG').length,2);
  f.button('Surface Combat').click();assert.match(f.heading(),/Build and edit/);
  f.button('Shared Controls').click();assert.match(f.heading(),/Use the Delay/);
  f.button('Starship Combat').click();assert.match(f.heading(),/Arrange the space/);
  f.button('Running Combat').click();assert.equal(f.button('Next').disabled,true);
  f.button('Previous').click();assert.match(f.heading(),/Stations, consoles/);
  assert.equal(f.dialog(),dialog);assert.equal(dialog.open,true);
  f.button('Dismiss').click();assert.equal(f.dialog(),null);assert.equal(f.doc.activeElement.id,'appHelp');
});
test('all fifteen GM pages render and their image assets are publicly available',()=>{
  const f=fixture(),data=f.c.window.SACombatHelpContent;
  for(const [key,label] of [['shared','Shared Controls'],['surface','Surface Combat'],['starship','Starship Combat']]){
    assert.equal(data[key].length,5);f.button(label).click();
    for(const page of data[key]){
      f.button(page[3]).click();assert.equal(f.heading(),page[0]);
      const images=f.nodes().filter(n=>n.tagName==='IMG');
      for(const image of images){const file=resolvePublicAsset(root,new URL(image.src).pathname);assert.ok(file&&fs.existsSync(file),image.src);assert.ok(image.alt);}
    }
  }
  for(const shot of Object.values(data.shots))for(const [,y,x,ty]of shot.marks){assert.ok(x>=0&&x<=shot.w&&y>=0&&y<=shot.h&&ty>=0&&ty<=shot.h);}
  const html=fs.readFileSync(path.join(root,'gm.html'),'utf8');
  assert.equal(html.split('src="combat-help-content.js"').length-1,1);
  assert.ok(html.indexOf('src="combat-help-content.js"')<html.indexOf('src="app-help.js"'));
  assert.ok(resolvePublicAsset(root,'/combat-help-content.js'));
});
test('player Combat Help and other GM topics keep their original navigation',()=>{
  const pc=fixture(false);assert.equal(pc.button('Shared Controls'),undefined);assert.equal(pc.heading(),'Prepare and begin combat');pc.button('Next').click();assert.equal(pc.heading(),'Actions and dice');assert.equal(pc.button('Next').disabled,true);
  const shop=fixture(true,'shop');assert.equal(shop.button('Surface Combat'),undefined);const original=shop.button('Next');shop.button('Next').click();assert.equal(shop.button('Next'),original);assert.equal(shop.nodes().filter(n=>n.tagName==='IMG').length,1);
  const story=fixture(true,'story');
  for(const image of story.nodes().filter(n=>n.tagName==='IMG'))assert.ok(fs.existsSync(resolvePublicAsset(root,new URL(image.src).pathname)),image.src);
});
