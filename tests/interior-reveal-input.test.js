const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('interior reveal targets never start panning or swallow the click after pointer drift',()=>{
 for(const reveal of [false,true]){
  const handlers={},viewport={scrollLeft:20,scrollTop:30,style:{},querySelector:()=>null};
  const doc={addEventListener:(type,fn)=>handlers[type]=fn};
  const target={closest:selector=>selector.includes('.inline-map-viewport')?viewport:reveal&&selector.includes('[data-fog-square]')?{}:null};
  vm.runInNewContext(fs.readFileSync(require.resolve('../interior-pan.js'),'utf8'),{window:{},document:doc,setTimeout:()=>{}});
  const event={target,button:0,pointerId:1,clientX:20,clientY:20,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};
  handlers.pointerdown(event);const moved={...event,clientX:30,clientY:30};handlers.pointermove(moved);const clicked={...event};handlers.click(clicked);
  assert.equal(viewport.scrollLeft,reveal?20:10);assert.equal(!!clicked.stopped,!reveal);
 }
});
