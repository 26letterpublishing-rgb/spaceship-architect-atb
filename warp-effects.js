// Warp presentation belongs to a visible Warp Drive console, never the campaign page.
(function(){
  let ship=null,host=null,canvas=null,ctx=null,frame=0,last=0,observer=null,unlocked=false,audio,gain;
  const stars=Array.from({length:72},()=>({angle:Math.random()*Math.PI*2,depth:Math.random(),speed:.12+Math.random()*.22}));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function visible(){return host?.isConnected&&host.closest('dialog')?.open&&!document.hidden&&window.SAExploreSession?.active?.()!==false&&host.getClientRects().length>0;}
  function sound(){
    let muted=true;try{muted=localStorage.getItem('sa-atb-alerts')==='off'||localStorage.getItem('sa-atb-gm-muted')==='on';}catch{}
    const enabled=!!ship&&visible()&&unlocked&&!muted;
    if(enabled&&!audio){try{audio=new AudioContext();gain=audio.createGain();gain.gain.value=0;gain.connect(window.SAAudioMix.destination(audio,'ambient'));[43,65,130].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;g.gain.value=i===2?.12:.35;o.connect(g);g.connect(gain);o.start();});}catch{}}
    if(audio&&gain){if(enabled&&audio.state==='suspended')void audio.resume();gain.gain.setTargetAtTime(enabled?.065:0,audio.currentTime,.2);}
  }
  function resize(){if(!canvas)return;canvas.width=Math.max(1,Math.min(1100,host.clientWidth));canvas.height=Math.max(1,Math.min(700,host.clientHeight));}
  function draw(time){
    frame=0;if(!canvas||!ship||!visible()){sound();return;}
    if(time-last<1000/30){frame=requestAnimationFrame(draw);return;}
    const state=window.SACombatBridge?.state?.(),paused=!state?.practice&&(state?.hardPaused||state?.holdPaused);
    const dt=reduced.matches||paused?0:Math.min(.06,(time-last)/1000||0);last=time;
    const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,radius=Math.hypot(w,h)*.6;
    ctx.fillStyle='#030914';ctx.fillRect(0,0,w,h);ctx.lineWidth=1.4;ctx.strokeStyle='#c4edff';
    for(const star of stars){star.depth+=dt*star.speed;if(star.depth>1){star.depth=.015;star.angle=Math.random()*Math.PI*2;}const r=star.depth*star.depth*radius,tail=reduced.matches?1:Math.max(1,r*.10),dx=Math.cos(star.angle),dy=Math.sin(star.angle);ctx.globalAlpha=Math.min(.85,.15+star.depth);ctx.beginPath();ctx.moveTo(cx+dx*Math.max(0,r-tail),cy+dy*Math.max(0,r-tail));ctx.lineTo(cx+dx*r,cy+dy*r);ctx.stroke();}
    ctx.globalAlpha=1;if(!reduced.matches&&!paused)frame=requestAnimationFrame(draw);
  }
  function wake(){sound();if(canvas&&!frame&&visible()){last=performance.now()-34;frame=requestAnimationFrame(draw);}}
  function clear(){cancelAnimationFrame(frame);frame=0;observer?.disconnect();observer=null;canvas?.remove();canvas=null;ctx=null;host=null;ship=null;sound();}
  function update(next,scene){
    if(!scene||!(next?.ship||next)?.warpState|| (next.ship||next).warpState.phase!=='traveling'){clear();return;}
    ship=next;
    if(scene!==host){clear();ship=next;host=scene;canvas=scene.ownerDocument.createElement('canvas');canvas.className='warp-starfield';canvas.setAttribute('aria-hidden','true');host.append(canvas);ctx=canvas.getContext('2d',{alpha:false});observer=new ResizeObserver(resize);observer.observe(host);resize();}
    wake();
  }
  window.addEventListener('pointerdown',()=>{unlocked=true;sound();},{passive:true});
  window.addEventListener('storage',sound);document.addEventListener('visibilitychange',wake);window.addEventListener('sa-perspective-visibility',wake);reduced.addEventListener('change',wake);
  window.addEventListener('pagehide',()=>{clear();void audio?.close();});
  window.SAWarpEffects={update,clear};
}());
