const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../starship'),'utf8');
function fixture(){
  let listener,closed=0;
  const code=source.match(/panel\.addEventListener\("click",e=>\{[^\n]+?\}\);/)[0];
  vm.runInNewContext(code,{panel:{addEventListener:(_,fn)=>listener=fn},closeSicCard:()=>closed++});
  function element(tag,parent=null,classes=[]){return {tag,parent,classes,closest(selector){
    const [ancestor,leaf]=selector.includes(' ')?selector.split(' '):[null,selector];
    for(let n=this;n;n=n.parent){if(n.tag!==leaf)continue;if(!ancestor)return n;
      for(let p=n.parent;p;p=p.parent)if(p.classes.includes(ancestor.slice(1)))return n;
    }return null;
  }};}
  const panel=element('aside'),legend=element('legend',panel),toggle=element('button',legend),actions=element('div',panel,['inventory-sic-actions']),action=element('button',actions);
  return {click:target=>listener({target}),count:()=>closed,toggle,action,element,actions};
}
test('repeated category disclosure activations do not close the owned card',()=>{
  const f=fixture();for(let i=0;i<4;i++)f.click(f.toggle);assert.equal(f.count(),0);
  f.click(f.element('span',f.toggle));assert.equal(f.count(),0);
});
test('inventory action and nested rotation icon activation retain automatic close',()=>{
  const f=fixture();f.click(f.action);assert.equal(f.count(),1);
  f.click(f.element('rect',f.element('svg',f.action)));assert.equal(f.count(),2);
});
test('non-action inputs and action-container whitespace never dismiss the card',()=>{
  const f=fixture();f.click(f.element('input',f.actions));f.click(f.actions);assert.equal(f.count(),0);
});
