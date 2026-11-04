const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 const source=fs.readFileSync(require.resolve('../weapon-console-ui'),'utf8'),frames=[],fits=[];
 const context={Promise,WeakSet,requestAnimationFrame:fn=>frames.push(fn),window:{SASpaceMap:{fitRendered:svg=>fits.push(svg)}}};
 vm.runInNewContext(source.slice(source.indexOf('  const previewFits='),source.indexOf('  const esc ='))+';globalThis.fit=fitWeaponPreview;',context);
 const svg={isConnected:true,dataset:{}},view={open:true,querySelectorAll:()=>[],ownerDocument:{}};
 return{svg,view,fits,fit:(family='rapid-laser',phazon=false,key=null)=>context.fit(svg,view,family,phazon,key),async flush(){await Promise.resolve();await Promise.resolve();for(const fn of frames.splice(0))fn();}};
}
test('Rapid and Phazon previews fit once; live keyed and other weapon cameras remain unchanged',async()=>{
 for(const [family,phazon,key,expected]of [['rapid-laser',false,null,1],['missile-launcher',true,null,1],['beam-laser',false,null,0],['rapid-laser',false,'saved-room-camera',0]]){
  const f=fixture();f.fit(family,phazon,key);f.fit(family,phazon,key);await f.flush();assert.equal(f.fits.length,expected);f.fit(family,phazon,key);await f.flush();assert.equal(f.fits.length,expected);
 }
});
test('late preview fit respects manual cameras, closed and detached views',async()=>{
 for(const change of [f=>f.svg.dataset.userViewBox='1 2 3 4',f=>f.svg.dataset.manualCamera='true',f=>f.view.open=false,f=>f.svg.isConnected=false]){const f=fixture();f.fit();change(f);await f.flush();assert.equal(f.fits.length,0);}
});
test('preview fitting waits for artwork and fonts, including failed artwork',async()=>{
 const f=fixture();let ready;f.view.ownerDocument.fonts={ready:new Promise(resolve=>ready=resolve)};f.view.querySelectorAll=()=>[{decode:()=>Promise.reject(Error('image unavailable'))}];f.fit();await f.flush();assert.equal(f.fits.length,0);ready();await f.flush();assert.equal(f.fits.length,1);
});
