(() => {
 'use strict';
 function createDebugUnlock(reveal){
  const sequence=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];let keys=[],unlocked=false;
  return (event,{active=true,editable=false}={})=>{
   if(unlocked)return false;
   if(!active||editable||event.ctrlKey||event.metaKey||event.altKey||event.isComposing){keys=[];return false;}
   if(event.repeat)return false;
   const key=event.key?.length===1?event.key.toLowerCase():event.key;
   keys.push(key);while(keys.length&&!keys.every((value,index)=>sequence[index]===value))keys.shift();
   if(keys.length)event.preventDefault?.();
   if(keys.length===sequence.length){unlocked=true;reveal();return true;}return false;
  };
 }
 function installDebugUnlock(document,window,welcome){
 if(window.SARuntimeConfig?.debugTools!==true)return false;
 const debug=document.createElement('a');debug.className='home-debug';debug.href='console-viewer.html';debug.textContent='Debug';debug.setAttribute('aria-label','Debug Console viewer');welcome.append(debug);
 debug.hidden=true;debug.style.display='none';
 const unlock=createDebugUnlock(()=>{debug.hidden=false;debug.style.display='';try{window.SAAudioMix?.unlock?.();window.SAAudioMix?.turnDing?.();}catch{}});
 document.addEventListener('keydown',event=>unlock(event,{active:!document.hidden&&document.body.classList.contains('welcome-mode'),editable:Boolean(event.target?.isContentEditable||event.target?.closest?.('input,textarea,select,[contenteditable]'))}));
 return true;
 }
 function installMenuMedia(window,document,banner){
  const start=window.performance.now(),base='home-animation-frame-0.jpg',frames=[];
  let stopped=false,ready=false,loading=false,framesDone=false,attempting=false,started=false,animation=0,generation=0,restartTimer=null;
  const timers=[],audio=new window.Audio('home-intro-song.m4a');audio.preload='auto';
  const active=()=>!stopped&&document.body.classList.contains('welcome-mode');
  const visible=()=>active()&&!document.hidden;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const mix=window.SAAudioMix;
  function play(){
   if(!visible()||window.performance.now()-start<10000||restartTimer!==null||attempting||(started&&(!audio.paused||audio.ended))||!mix?.level('game'))return;
   // Resume and play in the same activation turn. Context resume is asynchronous;
   // checking its state synchronously would consume the first gesture silently.
   if(window.navigator?.userActivation?.hasBeenActive===false)return;
   mix.trackMedia(audio,1,'game');
   const context=mix.context();
   attempting=true;
   Promise.all([context&&context.state!=='running'?context.resume():Promise.resolve(),audio.play()]).then(()=>{if(!visible()||!mix.level('game'))audio.pause();else{started=true;syncFrames();}},()=>{audio.pause();}).finally(()=>{attempting=false;});
  }
  function releaseFrames(){generation++;framesDone=true;ready=false;for(const image of frames)image.removeAttribute('src');frames.length=0;}
  function songEnded(){
   if(!active()||restartTimer!==null)return;
   window.cancelAnimationFrame(animation);animation=0;banner.src=base;releaseFrames();
   restartTimer=window.setTimeout(()=>{
    restartTimer=null;if(!active())return;
    audio.currentTime=0;started=false;framesDone=false;loading=false;play();
   },10000);
  }
  function tick(){
   animation=0;syncFrames();
  }
  async function preloadFrames(){
   loading=true;const cycle=generation;
   try{for(let i=1;i<=9;i++){if(!active()||framesDone||cycle!==generation)return;const image=new window.Image();image.src=`home-animation-frame-${i}.jpg`;await image.decode();if(!active()||framesDone||cycle!==generation){image.removeAttribute('src');return;}frames.push(image);}ready=true;syncFrames();}catch{if(cycle===generation)releaseFrames();}
  }
  function syncFrames(){
   if(!active()||framesDone)return;
   const position=audio.currentTime;
   if(!Number.isFinite(position))return;
   if(reduced.matches){window.cancelAnimationFrame(animation);animation=0;banner.src=base;releaseFrames();return;}
   if(!visible()||audio.paused){window.cancelAnimationFrame(animation);animation=0;return;}
   // Keep preload and the cue on the media clock, including delayed autoplay,
   // buffering and pauses. Reuse decoded frames for the 20-second repeats;
   // release them at song end. RAF runs only near each one-second cue.
   if(position>=140&&!loading)void preloadFrames();
   const phase=position>=170?(position-170)%20:-1;
   if(phase>=0&&phase<1&&ready){
    const src=frames[Math.min(8,Math.floor(phase*9))].src;
    if(banner.src!==src)banner.src=src;
   }else if(!banner.src.endsWith(base))banner.src=base;
   if(position>=169&&(phase<1||phase>=19)&&!animation)animation=window.requestAnimationFrame(tick);
  }
  function stop(){
   if(stopped)return;stopped=true;timers.forEach(id=>window.clearTimeout(id));
   if(restartTimer!==null)window.clearTimeout(restartTimer);restartTimer=null;
   window.cancelAnimationFrame(animation);audio.pause();mix?.releaseMedia(audio);
   audio.removeAttribute('src');audio.load();banner.src=base;releaseFrames();
   observer.disconnect();document.removeEventListener('pointerup',play);document.removeEventListener('keydown',play);
   document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',stop);
   for(const event of ['timeupdate','playing','pause','seeked'])audio.removeEventListener(event,syncFrames);
   audio.removeEventListener('ended',songEnded);
  }
  function visibility(){if(document.hidden){audio.pause();window.cancelAnimationFrame(animation);animation=0;banner.src=base;}else play();}
  const observer=new window.MutationObserver(()=>{if(!active())stop();});
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('pointerup',play);document.addEventListener('keydown',play);
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',stop);
  for(const event of ['timeupdate','playing','pause','seeked'])audio.addEventListener(event,syncFrames);
  audio.addEventListener('ended',songEnded);
  timers.push(window.setTimeout(play,10000));
  return {stop};
 }
 if(typeof module==='object'){module.exports={createDebugUnlock,installDebugUnlock,installMenuMedia};return;}
 const hero=document.querySelector('.welcome-hero'),welcome=document.getElementById('welcomePanel');
 if(!hero||!welcome)return;
 installMenuMedia(window,document,hero.querySelector('.welcome-banner'));
 installDebugUnlock(document,window,welcome);
 const layer=document.createElement('div');layer.className='home-star-layer';layer.setAttribute('aria-hidden','true');hero.append(layer);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let joinButton;
 function decorate(){const form=welcome.querySelector('.v03-join');if(!form||form.querySelector('.home-panel-frame'))return;
  const frame=document.createElement('img');frame.className='home-panel-frame';frame.src='home-panel-frame.svg';frame.alt='';frame.setAttribute('aria-hidden','true');form.prepend(frame);
  joinButton=form.querySelector('button');const stars=document.createElement('span');stars.className='home-button-stars';stars.setAttribute('aria-hidden','true');
  for(let i=0;i<12;i++){const dot=document.createElement('i');dot.style.left=(4+Math.random()*92)+'%';dot.style.top=(10+Math.random()*80)+'%';dot.style.animationDelay=(-Math.random()*4)+'s';stars.append(dot);}joinButton.append(stars);
 }
 let angle=90,velocity=0,target=8,nextTarget=0,last=0;
 function rotate(now){const dt=last?Math.min((now-last)/1000,.05):0;last=now;
  if(joinButton&&!document.hidden&&document.body.classList.contains('welcome-mode')&&!reduced.matches){
   if(now>nextTarget){target=(Math.random()<.5?-1:1)*(7+Math.random()*10);nextTarget=now+5000+Math.random()*5000;}
   velocity+=(target-velocity)*(1-Math.exp(-dt/1.8));
   if(!joinButton.classList.contains('home-activating')){angle=(angle+velocity*dt)%360;joinButton.style.setProperty('--join-angle',angle+'deg');}
  }
  requestAnimationFrame(rotate);
 }
 requestAnimationFrame(rotate);
 function layout(){decorate();const menu=welcome.querySelector('.v03-menu');if(!menu)return;const width=innerWidth,height=innerHeight;
  // Keep the artwork's subtitle above the menu; the two layers remain independent.
  const imageHeight=Math.max(height,width*1080/1920),subtitleBottom=imageHeight*.31;
  const top=Math.max((height-menu.offsetHeight)/2,subtitleBottom+14);
  welcome.style.setProperty('--home-menu-top',Math.round(top)+'px');
 }
 new ResizeObserver(layout).observe(welcome);
 new MutationObserver(layout).observe(welcome,{childList:true});
 const ready=()=>{layout();document.body.classList.remove('home-starting');};
 Promise.all([document.fonts?.load('600 38px Orbitron'),hero.querySelector('img')?.decode?.().catch(()=>{})]).then(ready,ready);
 window.addEventListener('resize',layout);layout();
 function star(){if(document.hidden||reduced.matches||!document.body.classList.contains('welcome-mode'))return;
  const width=innerWidth,height=innerHeight,left=Math.random()<.5,scale=Math.max(width/1920,height/1080),center={x:width/2,y:1080*scale*.55};
  const end={x:left?Math.random()*width*.12:width*(.88+Math.random()*.12),y:Math.random()*height};
  const point=document.createElement('i');point.style.background=left?'#64b8ff':'#ff6960';point.style.color=left?'#64b8ff':'#ff6960';point.style.width=point.style.height=(2.4+Math.random()*1.8)+'px';layer.append(point);
  const duration=2000+Math.random()*1000,start={x:end.x+(center.x-end.x)*.9,y:end.y+(center.y-end.y)*.9};
  const motion=point.animate([{transform:`translate(${start.x}px,${start.y}px)`,opacity:0},{opacity:.9,offset:.15},{opacity:.7,offset:.65},{transform:`translate(${end.x}px,${end.y}px)`,opacity:0}],{duration,easing:'linear'});motion.onfinish=()=>point.remove();
 }
 setInterval(star,130/1.2); // 20% more stars per second; retain their existing travel time.
})();
