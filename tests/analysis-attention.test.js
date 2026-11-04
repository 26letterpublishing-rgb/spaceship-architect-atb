const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Analysis processing uses the fading popup and completion uses the stationary banner once',()=>{
 const source=fs.readFileSync(require.resolve('../result-feedback.js'),'utf8'),calls=[],saved=new Map();
 const popups=[];const context={seen:new Set(),stored:key=>saved.has(key),sessionStorage:{setItem:(key,value)=>saved.set(key,value)},isCombatActive:()=>true,critical:(...args)=>calls.push(args),push:(...args)=>popups.push(args)};
 vm.runInNewContext(source.slice(source.indexOf('  function analysisNotice('),source.indexOf('  function observe(')),context);
 context.analysisNotice('processing',{analysisPhase:'processing',text:'Systems Analysis of White Dwarf: processing (10 combat seconds).'});
 context.analysisNotice('complete',{analysisPhase:'complete',text:'Systems Analysis: White Dwarf'});
 context.analysisNotice('complete',{analysisPhase:'complete'});context.seen.clear();context.analysisNotice('complete',{analysisPhase:'complete'});
 assert.equal(calls.length,1);assert.match(popups[0][2],/processing \(10 combat seconds\)/);assert.equal(calls[0][1],'Enemy ship systems analysis is complete');assert.equal(calls[0][2],'analysis-complete');
 context.analysisNotice('failed',{analysisPhase:'failed',text:'Target unavailable.'});assert.equal(popups[1][2],'Target unavailable.');
 const stationary=source.slice(source.indexOf("      if(item.type==='analysis-complete')"),source.indexOf("      const banner=doc.createElement('aside');banner.className='critical-flight-banner'"));assert.match(stationary,/combat-victory-banner combat-analysis-banner/);assert.match(stationary,/setTimeout\(close,6000\)/);assert.doesNotMatch(stationary,/translateX|\.animate\(/);
});

test('compact Analysis sizing is isolated from Victory and waiting banners',()=>{
 const css=fs.readFileSync(require.resolve('../result-feedback.css'),'utf8');
 assert.match(css,/\.combat-victory-banner\.combat-analysis-banner\{[^}]*width:max-content;[^}]*padding:8px 12px/);
 assert.match(css,/\.combat-victory-banner\.combat-analysis-banner strong\{[^}]*font-size:18px/);
});
