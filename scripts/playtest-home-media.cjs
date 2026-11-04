'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('node:assert/strict');
const {harness,chromium}=require('./capture-console-layout.cjs');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'sa-home-media-'));
(async()=>{let h,b;try{h=await harness();b=await chromium().launch({headless:true,channel:'chrome'});
 const fresh=await b.newPage();await fresh.addInitScript(()=>{const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);if(String(args[0]).includes('home-intro'))window.qaAudio=a;return a;};});
 await fresh.goto(h.base);await fresh.waitForTimeout(10500);
 const cdp=await fresh.context().newCDPSession(fresh);const beforeFirstClick=(await cdp.send('Runtime.evaluate',{expression:'({paused:qaAudio.paused,time:qaAudio.currentTime,activated:navigator.userActivation.hasBeenActive})',returnByValue:true,userGesture:false})).result.value;
 assert.deepEqual(beforeFirstClick,{paused:true,time:0,activated:false});
 await fresh.locator('body').click({position:{x:10,y:10}});await fresh.waitForFunction(()=>!qaAudio.paused&&qaAudio.currentTime>0);
 const firstClickPlayback=await fresh.evaluate(()=>({paused:qaAudio.paused,time:qaAudio.currentTime,context:SAAudioMix.context().state}));assert.equal(firstClickPlayback.context,'running');await fresh.close();
 const p=await b.newPage({viewport:{width:1920,height:1080}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);if(String(args[0]).includes('home-intro'))window.qaAudio=a;return a;};});
 // Animation clock acceleration is separate from the fresh first-click test.
 await p.clock.install();await p.goto(h.base);await p.clock.fastForward(10500);
 const beforeGesture=await p.evaluate(()=>({paused:qaAudio.paused,time:qaAudio.currentTime}));
 await p.locator('body').click({position:{x:10,y:10}});await p.waitForFunction(()=>!qaAudio.paused&&qaAudio.currentTime>0);await p.waitForTimeout(300);
 const audio=await p.evaluate(()=>({paused:qaAudio.paused,time:qaAudio.currentTime,context:SAAudioMix.context().state,duration:qaAudio.duration}));assert.equal(audio.context,'running');
 await p.evaluate(()=>{SAAudioMix.setPreferences({master:50,game:40});});assert.equal(await p.evaluate(()=>SAAudioMix.level('game')),.2);await p.evaluate(()=>SAAudioMix.setMuted(true));assert.equal(await p.evaluate(()=>SAAudioMix.level('game')),0);await p.evaluate(()=>SAAudioMix.setMuted(false));
 await p.clock.fastForward(220000);assert.match(await p.locator('.welcome-banner').getAttribute('src'),/-0.jpg$/,'wall-clock time cannot trigger the animation');
 // Advance actual playback, then restore normal speed before the cue. This
 // avoids assuming byte-range seeking support from the static media server.
 await p.evaluate(()=>{qaAudio.playbackRate=16;});await p.waitForFunction(()=>qaAudio.currentTime>=168,{},{timeout:25000});
 await p.evaluate(()=>{qaAudio.pause();qaAudio.playbackRate=1;window.qaFrames=[];new MutationObserver(()=>qaFrames.push({src:document.querySelector('.welcome-banner').getAttribute('src'),t:performance.now(),song:qaAudio.currentTime})).observe(document.querySelector('.welcome-banner'),{attributes:true,attributeFilter:['src']});});
 await p.waitForTimeout(500);assert.match(await p.locator('.welcome-banner').getAttribute('src'),/-0.jpg$/,'paused song must not trigger cue');
 await p.screenshot({path:path.join(out,'default.png')});
 await p.evaluate(()=>qaAudio.play());
 await p.waitForFunction(()=>qaAudio.currentTime>=170.3);await p.screenshot({path:path.join(out,'animation.png')});await p.waitForFunction(()=>qaAudio.currentTime>=171.2);
 const frames=await p.evaluate(()=>qaFrames);fs.writeFileSync(path.join(out,'frames.json'),JSON.stringify(frames,null,2));fs.writeFileSync(path.join(out,'after.json'),JSON.stringify(await p.evaluate(()=>({time:qaAudio.currentTime,paused:qaAudio.paused,ended:qaAudio.ended,errors:qaAudio.error?.message})),null,2));for(let i=1;i<=9;i++)assert(frames.some(f=>f.src.endsWith(`home-animation-frame-${i}.jpg`)),'frame '+i);assert(frames[0].song>=170&&frames[0].song<170.1,'cue follows actual song position');assert.match(await p.locator('.welcome-banner').getAttribute('src'),/-0.jpg$/);
 await p.evaluate(()=>{qaAudio.playbackRate=16;});await p.waitForFunction(()=>qaAudio.currentTime>=188);await p.evaluate(()=>{qaAudio.playbackRate=1;});await p.waitForFunction(()=>qaAudio.currentTime>=191.2);
 const repeat=await p.evaluate(()=>qaFrames.filter(f=>f.song>=190&&f.song<191));for(let i=1;i<=9;i++)assert(repeat.some(f=>f.src.endsWith(`home-animation-frame-${i}.jpg`)),'repeat frame '+i);
 await p.evaluate(()=>{window.qaEndedAt=null;window.qaRestartAt=null;qaAudio.addEventListener('ended',()=>qaEndedAt=performance.now(),{once:true});qaAudio.addEventListener('playing',()=>{if(qaEndedAt!==null&&qaRestartAt===null)qaRestartAt=performance.now();});qaAudio.playbackRate=16;});
 await p.waitForFunction(()=>qaAudio.ended,{},{timeout:20000});await p.waitForTimeout(9000);assert(await p.evaluate(()=>qaAudio.paused&&qaRestartAt===null));await p.waitForFunction(()=>qaRestartAt!==null,{},{timeout:5000});
 const restart=await p.evaluate(()=>({gap:qaRestartAt-qaEndedAt,position:qaAudio.currentTime}));assert(restart.gap>=10000&&restart.gap<11000);assert(restart.position<20);
 await p.evaluate(()=>{qaFrames=[];});await p.waitForFunction(()=>qaAudio.currentTime>=168,{},{timeout:20000});await p.evaluate(()=>{qaAudio.playbackRate=1;});await p.waitForFunction(()=>qaAudio.currentTime>=171.2);const nextCycle=await p.evaluate(()=>qaFrames);assert(nextCycle.some(f=>f.src.endsWith('home-animation-frame-1.jpg')&&f.song>=170&&f.song<170.1));
 for(const width of [1366,1280]){await p.setViewportSize({width,height:720});await p.screenshot({path:path.join(out,`home-${width}.png`)});assert(await p.locator('.v03-join button').isVisible());}
 await p.evaluate(()=>document.body.classList.remove('welcome-mode'));await p.waitForTimeout(50);assert(await p.evaluate(()=>qaAudio.paused&&!qaAudio.getAttribute('src')));
 const reduced=await b.newPage({reducedMotion:'reduce'});await reduced.clock.install();await reduced.goto(h.base);await reduced.clock.fastForward(200000);assert.match(await reduced.locator('.welcome-banner').getAttribute('src'),/-0.jpg$/);await reduced.close();
 const nav=await b.newPage();await nav.addInitScript(()=>{const Native=window.Audio;window.Audio=function(...args){const a=new Native(...args);if(String(args[0]).includes('home-intro'))window.qaAudio=a;return a;};});await nav.goto(h.base);
 await nav.evaluate(()=>addEventListener('pagehide',()=>sessionStorage.setItem('qa-menu-cleanup',JSON.stringify({paused:qaAudio.paused,src:qaAudio.getAttribute('src')}))));
 await nav.locator('.v03-actions a[href="showcase.html"]').click();await nav.waitForURL('**/showcase.html');
 const navigation=await nav.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-menu-cleanup')));assert.deepEqual(navigation,{paused:true,src:null});await nav.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({beforeFirstClick,firstClickPlayback,beforeGesture,audio,frames,repeat,restart,nextCycle,navigation,errors},null,2));console.log(out);
 }finally{await b?.close();await h?.stop();}})().catch(e=>{console.error(out,e);process.exitCode=1;});
