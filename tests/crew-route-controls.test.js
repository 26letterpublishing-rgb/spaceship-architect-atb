const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../ship-combat-map'),'utf8');
function harness(){
 const c={confirm:{},renders:0,render(){c.renders++},renderInlineMaps(){},document:{},inlineMarkupCache:new WeakMap(),expandedMap:null};
 const controls=source.slice(source.indexOf('  function routeControls('),source.indexOf('  let moveSubmitting'));
 const handler=source.slice(source.indexOf('  function handleRouteControls('),source.indexOf("  document.addEventListener('click',handleRouteControls"));
 vm.runInNewContext(`let routeMode='direct',waypoints=[],preview=null,moveSubmitting=false;${controls}${handler};this.markup=routeControls;this.seed=()=>{preview={locked:true};waypoints=[{square:1}]};this.state=()=>({routeMode,preview,count:waypoints.length});this.click=(mode)=>handleRouteControls({target:{closest:()=>({dataset:mode?{crewRoute:mode}:{}})},preventDefault(){},stopImmediatePropagation(){}});`,c);return c;
}
test('crew choices expose one active direct mode and no Undo control',()=>{const c=harness();assert.match(c.markup(),/data-crew-route="direct" aria-pressed="true"/);assert.match(c.markup(),/data-crew-route="custom" aria-pressed="false"/);assert.doesNotMatch(c.markup(),/Undo|data-crew-undo/);assert.match(c.markup(),/Clear Route/);});
test('clicking active mode preserves route; switching and clearing reset safely',()=>{const c=harness();c.seed();c.click('direct');assert.equal(c.state().count,1);assert.equal(c.renders,0);c.click('custom');assert.equal(c.state().count,0);assert.equal(c.state().preview,null);assert.equal(c.confirm.disabled,true);assert.match(c.markup(),/data-crew-route="custom" aria-pressed="true"/);c.seed();c.click();assert.equal(c.state().count,0);assert.equal(c.state().routeMode,'custom');});

test('clearing invalidates cached inline and enlarged controls after live preview mutations',()=>{const c=harness(),host={},expanded={};c.document.querySelectorAll=()=>[host];c.expandedMap={dialog:{querySelectorAll:()=>[expanded]}};c.inlineMarkupCache.set(host,'empty route');c.inlineMarkupCache.set(expanded,'empty route');c.seed();c.click();assert.equal(c.inlineMarkupCache.has(host),false);assert.equal(c.inlineMarkupCache.has(expanded),false);assert.equal(c.confirm.disabled,true);});
test('route styling reaches shared parent and combat documents without styling other buttons',()=>{
 const css=fs.readFileSync(require.resolve('../combat-arena.css'),'utf8');
 for(const selector of ['.map-action-modes button[data-route-mode]','.map-action-modes button[data-crew-route]','.arena-toolbar button[data-route-mode]']){assert.ok(css.includes(selector));assert.ok(css.includes(selector+'[aria-pressed=true]'));}
 assert.match(css,/border-radius:999px/);assert.match(css,/--button-accent:#39d875/);
 const shared=fs.readFileSync(require.resolve('../movement-controls.css'),'utf8');assert.match(shared,/linear-gradient/);assert.match(shared,/radial-gradient/);assert.match(shared,/inset 0 2px 1px/);assert.doesNotMatch(shared,/background:#216f43!important/);
});
