(() => {
 'use strict';
 const hero=document.querySelector('.welcome-hero'),welcome=document.getElementById('welcomePanel');
 if(!hero||!welcome)return;
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
  const start={x:left?Math.random()*width*.12:width*(.88+Math.random()*.12),y:Math.random()*height};
  const point=document.createElement('i');point.style.background=left?'#64b8ff':'#ff6960';point.style.color=left?'#64b8ff':'#ff6960';point.style.width=point.style.height=(1.8+Math.random()*1.8)+'px';layer.append(point);
  const duration=2000+Math.random()*1000,end={x:start.x+(center.x-start.x)*.9,y:start.y+(center.y-start.y)*.9};
  const motion=point.animate([{transform:`translate(${start.x}px,${start.y}px)`,opacity:0},{opacity:.9,offset:.15},{opacity:.7,offset:.65},{transform:`translate(${end.x}px,${end.y}px)`,opacity:0}],{duration,easing:'linear'});motion.onfinish=()=>point.remove();
 }
 setInterval(star,130/1.2); // 20% more stars per second; retain their existing travel time.
})();
