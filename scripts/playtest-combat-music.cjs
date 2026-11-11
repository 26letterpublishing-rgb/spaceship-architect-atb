// Isolated QA: real source files; five-second excerpts by default, SA_MUSIC_FULL=1 for full-length memory assessment.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert/strict');
const fullLength=process.env.SA_MUSIC_FULL==='1';
const root=path.resolve(__dirname,'..'),catalog=require('../data/combat-music-mixes.json'),out=path.join(os.tmpdir(),fullLength?'sa-music-foundation-full-nov10':'sa-music-foundation-nov10');fs.mkdirSync(out,{recursive:true});
const folders={contact:'Alien Song',onslaught:'Final Boss in Space',eldritch:'Space Anomaly'},allowed=new Map();
for(const song of catalog.songs)for(const stem of song.stems)allowed.set('/audio/'+song.id+'/'+encodeURIComponent(stem.name),path.join(os.homedir(),'Desktop',folders[song.id],stem.file));
for(const name of ['audio-mix.js','audio-controls.js','audio-controls.css','combat-music.js','data/combat-music-mixes.json'])allowed.set('/'+name,path.join(root,name));
const html=`<!doctype html><meta charset="utf-8"><title>Isolated music foundation QA</title><link rel="stylesheet" href="/audio-controls.css"><style>body{background:#101b28;color:white;font:16px sans-serif;padding:24px;max-width:800px}button{padding:12px;margin:6px}output{display:block}</style><h1>Isolated music foundation QA</h1><p>Five-second excerpts; no combat integration or final selector design.</p><button id="play">Play selected test song</button><button id="stop">Stop</button><section class="sound-settings-card"><h2>Sound</h2></section><output id="status">Ready</output><script src="/audio-mix.js"></script><script src="/audio-controls.js"></script><script src="/combat-music.js"></script><script>
let player,selected=0,phase='shielded';window.qa={decoded:[],starts:[],errors:[]};
const catalogPromise=fetch('/data/combat-music-mixes.json').then(r=>r.json());
document.querySelector('#play').onclick=async()=>{try{
 const c=SAAudioMix.context();await c.resume();
 if(!player){const decode=c.decodeAudioData.bind(c),create=c.createBufferSource.bind(c);
 c.decodeAudioData=async bytes=>{const full=await decode(bytes);qa.decoded.push({duration:full.duration,channels:full.numberOfChannels,rate:full.sampleRate});if(${fullLength})return full;const short=c.createBuffer(full.numberOfChannels,Math.min(full.length,full.sampleRate*5),full.sampleRate);for(let i=0;i<short.numberOfChannels;i++)short.copyToChannel(full.getChannelData(i).subarray(0,short.length),i);return short;};
 c.createBufferSource=()=>{const source=create(),start=source.start.bind(source);source.start=(...args)=>{qa.starts.push(args);start(...args);};return source;};
 window.player=player=SACombatMusic.create({resolveUrl:(stem,song)=>'/audio/'+song.id+'/'+encodeURIComponent(stem.name)});
 window.analyser=c.createAnalyser();SAAudioMix.musicOutput(c).connect(analyser);
 }
 const songs=(await catalogPromise).songs;await player.play(songs[selected],phase);document.querySelector('#status').textContent=JSON.stringify(player.status());qa.completed=(qa.completed||0)+1;
 }catch(e){qa.errors.push(e.message);document.querySelector('#status').textContent=e.message;}};
 document.querySelector('#stop').onclick=()=>player.stop();
 window.energy=()=>{const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length);};
</script>`;
let browser;const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html);}const file=allowed.get(req.url);if(!file||!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'audio/mpeg');fs.createReadStream(file).pipe(res);});
const report={excerptSeconds:fullLength?null:5,fullLength,memory:[],phases:[]};
(async()=>{
 if(fullLength){ await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}}),cdp=await browser.newBrowserCDPSession();page.on('pageerror',e=>(report.errors||=[]).push(e.message));page.on('crash',()=>report.crashed=true);await page.goto('http://127.0.0.1:'+server.address().port);
 await page.evaluate(()=>{window.framesQA=[];window.longQA=[];let last=performance.now();const frame=t=>{framesQA.push(t-last);last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);new PerformanceObserver(list=>longQA.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});});
 const memory=async label=>{const ids=(await cdp.send('SystemInfo.getProcessInfo')).processInfo.map(p=>p.id).filter(Number.isInteger);const cmd='Get-Process -Id '+ids.join(',')+' -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress';const text=require('child_process').execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8',windowsHide:true});const values=JSON.parse(text||'[]'),rows=Array.isArray(values)?values:[values];const sample={label,at:Date.now(),working:rows.reduce((s,p)=>s+p.WorkingSet64,0),private:rows.reduce((s,p)=>s+p.PrivateMemorySize64,0),free:os.freemem()};report.memory.push(sample);console.log(JSON.stringify(sample));if(sample.free<1.5*2**30)throw Error('Safety stop: less than 1.5 GiB host memory free');};
 await memory('baseline');
 for(let i=0;i<3;i++){
  await page.evaluate(i=>{selected=i;phase='shielded';framesQA=[];longQA=[];},i);const started=Date.now();await page.getByRole('button',{name:'Play selected test song'}).click();
  while(await page.evaluate(()=>qa.completed||0)<i+1){await page.waitForTimeout(2000);await memory('loading-'+catalog.songs[i].id);if(Date.now()-started>120000)throw Error('Loading timeout');const errors=await page.evaluate(()=>qa.errors);if(errors.length)throw Error(errors.join(';'));}
  const count=4,starts=await page.evaluate(n=>qa.starts.slice(-n),count);assert.equal(new Set(starts.map(s=>s[0])).size,1);await page.waitForTimeout(2200);await memory('playing-'+catalog.songs[i].id);
  report.phases.push({song:catalog.songs[i].id,loadAndFadeMs:Date.now()-started,...await page.evaluate(()=>{const a=framesQA.slice().sort((a,b)=>a-b);return{status:player.status(),frameP95:a[Math.floor(a.length*.95)],frameMax:Math.max(...a),longTasks:longQA,energy:energy()};})});
  await page.evaluate(()=>player.setMix('one'));await page.waitForTimeout(1800);assert.ok(await page.evaluate(()=>energy())>0);
 }
 await page.evaluate(()=>player.dispose());await page.waitForTimeout(5000);await memory('disposed-5s');await page.waitForTimeout(10000);await memory('disposed-15s');assert.equal(await page.evaluate(()=>player.status().voices),0);assert.equal(await page.evaluate(()=>energy()),0);
 report.decoded=await page.evaluate(()=>qa.decoded);assert.equal(report.decoded.length,34);report.passed=true;
return;}
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {chromium}=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>(report.errors||=[]).push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
 for(let i=0;i<3;i++){
  await page.evaluate(i=>{selected=i;phase='shielded';},i);await page.getByRole('button',{name:'Play selected test song'}).click();await page.waitForFunction(n=>qa.completed===n,i+1,{timeout:120000});
  const count=4,starts=await page.evaluate(n=>qa.starts.slice(-n),count);assert.equal(new Set(starts.map(s=>s[0])).size,1);assert.ok(starts.every(s=>s[1]===0));
  await page.evaluate(()=>player.setMix('one'));await page.waitForTimeout(1800);assert.ok(await page.evaluate(()=>energy())>0,'real decoded music reaches output');
 }
 await page.evaluate(()=>player.setEnabled(false));await page.waitForTimeout(1800);assert.equal(await page.evaluate(()=>energy()),0);await page.evaluate(()=>player.setEnabled(true));await page.waitForTimeout(1800);assert.ok(await page.evaluate(()=>energy())>0);
 await page.getByRole('slider',{name:'Music Volume',exact:true}).fill('35');await page.getByRole('slider',{name:'Master Volume',exact:true}).fill('50');assert.equal(await page.evaluate(()=>SAAudioMix.level('music')),.175);assert.equal(await page.evaluate(()=>SAAudioMix.level('game')),.5);
 await page.evaluate(()=>SAAudioMix.setMuted(true));assert.equal(await page.evaluate(()=>SAAudioMix.level('music')),0);await page.evaluate(()=>SAAudioMix.setMuted(false));assert.equal(await page.evaluate(()=>SAAudioMix.level('music')),.175);
 await page.screenshot({path:path.join(out,'settings.png')});report.playback=await page.evaluate(()=>({status:player.status(),decoded:qa.decoded,starts:qa.starts,errors:qa.errors}));assert.deepEqual(report.playback.errors,[]);assert.equal(report.playback.decoded.length,34);
 await page.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));});assert.equal(await page.evaluate(()=>player.status().disposed),true);
 await page.reload();assert.equal(await page.getByRole('slider',{name:'Music Volume',exact:true}).inputValue(),'35');report.passed=true;
})().catch(e=>{report.failure=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.close();console.log(out);});
