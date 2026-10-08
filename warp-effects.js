// Shared travel backdrop. Dice remain exclusively in the existing physical renderer.
(function(){
  let ship=null,canvas=null,frame=0,last=0,ctx,audio,gain,oscillators=[],unlocked=false,canvasAngle=0;
  const stars=Array.from({length:110},()=>({x:Math.random(),y:Math.random(),speed:.35+Math.random(),length:12+Math.random()*60}));
  const muted=()=>{try{return localStorage.getItem('sa-atb-alerts')==='off'||localStorage.getItem('sa-atb-gm-muted')==='on';}catch{return false;}};
  function sound(){
    // Only the outer app owns ambient audio; embedded ship sheets share it.
    if(window!==window.top)return;
    const enabled=!!ship&&unlocked&&!document.hidden&&!muted();
    if(enabled&&!audio){try{audio=new AudioContext();gain=audio.createGain();gain.gain.value=0;gain.connect(window.SAAudioMix.destination(audio,"ambient"));
      [43,65,130].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=i===2?.12:.35;o.connect(g);g.connect(gain);o.start();oscillators.push(o);});}catch{}}
    if(audio){if(enabled)audio.resume();gain.gain.setTargetAtTime(enabled?.065:0,audio.currentTime,.3);}
  }
  function draw(time){
    if(!canvas||!ship)return;
    const w=innerWidth,h=innerHeight;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,state=window.SACombatBridge?.state?.(),paused=state?.hardPaused||state?.holdPaused;
    const dt=reduced||paused?0:Math.min(.05,(time-last)/1000||0);last=time;
    const data=ship.ship||ship,heading=canvasAngle,angle=(heading+90)*Math.PI/180,dx=Math.cos(angle),dy=Math.sin(angle);
    canvas.dataset.direction=String(heading);ctx.clearRect(0,0,w,h);ctx.fillStyle='#030a14';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#afddff';ctx.lineWidth=1;
    for(const s of stars){s.x=(s.x+dx*dt*s.speed+.999999)%1;s.y=(s.y+dy*dt*s.speed+.999999)%1;const x=s.x*w,y=s.y*h,len=reduced?2:s.length;ctx.globalAlpha=.2+s.speed*.35;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-dx*len,y-dy*len);ctx.stroke();}ctx.globalAlpha=1;
    frame=requestAnimationFrame(draw);
  }
  function update(next){
    try{if(window!==window.top)window.top.SAWarpEffects?.update(next);}catch{}
    ship=next?.ship?.warpState?.phase==='traveling'||next?.warpState?.phase==='traveling'?next:null;
    if(ship){const data=ship.ship||ship;let angle=data.thrusterDirection;if(!Number.isFinite(angle)&&window.SAShipMap){const layout=window.SAShipMap.buildLayout(data),mount=[...layout.footprint].find(([,c])=>window.SAShipMap.definition(c.type).thruster);if(mount)angle=window.SAShipMap.exteriorFacing(layout,mount[0]);}angle=Number(angle)||0;canvasAngle=angle;const rad=(angle+90)*Math.PI/180;document.documentElement.style.setProperty('--warp-direction',(angle+90)+'deg');document.documentElement.style.setProperty('--warp-x',Math.cos(rad)*100+'vw');document.documentElement.style.setProperty('--warp-y',Math.sin(rad)*100+'vh');}
    if(ship&&!canvas){canvas=document.createElement('canvas');canvas.className='warp-starfield';canvas.setAttribute('aria-label','Stars passing at warp speed');canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:0;opacity:.7';document.body.prepend(canvas);ctx=canvas.getContext('2d');document.body.classList.add('warp-travel');last=performance.now();frame=requestAnimationFrame(draw);}
    if(!ship&&canvas){cancelAnimationFrame(frame);canvas.remove();canvas=null;document.body.classList.remove('warp-travel');}
    sound();
  }
  window.addEventListener('pointerdown',()=>{unlocked=true;sound();try{if(window!==window.top)window.top.SAWarpEffects?.unlock();}catch{}},{passive:true});window.addEventListener('storage',sound);document.addEventListener('visibilitychange',sound);
  const timer=setInterval(sound,500);window.addEventListener('pagehide',()=>{clearInterval(timer);cancelAnimationFrame(frame);oscillators.forEach(o=>o.stop());audio?.close();});
  window.SAWarpEffects={update,unlock(){unlocked=true;sound();}};
}());
