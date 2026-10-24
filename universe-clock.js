(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.SAUniverseClock=api;})(typeof window==='object'?window:null,()=>{
 'use strict';
 const DAY=86400,MONTH=30*DAY,YEAR=12*MONTH;
 const seconds=c=>Math.round(Math.max(0,Number(c.elapsedMinutes)||0)*60000000)/1000000;
 function settings(c){return c.universeClock||{};}
 function parts(total){let n=Math.max(0,Math.floor(total));const year=Math.floor(n/YEAR);n%=YEAR;const month=Math.floor(n/MONTH);n%=MONTH;const day=Math.floor(n/DAY);n%=DAY;const hour=Math.floor(n/3600);n%=3600;return {year,month,day,hour,minute:Math.floor(n/60),second:n%60};}
 function dateSeconds(p){for(const [key,min,max]of [['year',0,999999],['month',1,12],['day',1,30],['hour',0,23],['minute',0,59],['second',0,59]])if(!Number.isInteger(Number(p[key]))||Number(p[key])<min||Number(p[key])>max)throw Error('Enter a valid '+key+'.');return Number(p.year)*YEAR+(Number(p.month)-1)*MONTH+(Number(p.day)-1)*DAY+Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);}
 const unit=(n,name)=>`${n} ${name}${n===1?'':'s'}`;
 function displayParts(c){const cfg=settings(c);return parts(seconds(c)+(cfg.dated?Number(cfg.offsetSeconds)||0:0));}
 function format(c,log=false){const cfg=settings(c),p=displayParts(c),pad=n=>String(n).padStart(2,'0');
  if(cfg.decimals){const upper=[...(p.year?[p.year]:[]),p.month+(cfg.dated?1:0),p.day+(cfg.dated?1:0),p.hour];return [upper.join('.')+(log?'':'.'+pad(p.minute)+'.'+pad(p.second))];}
  const dateUnit=(n,name)=>cfg.dated?name+' '+n:unit(n,name),upper=[p.year?dateUnit(p.year,'Year'):'',(cfg.dated||p.month)?dateUnit(p.month+(cfg.dated?1:0),'Month'):'',(cfg.dated||p.day)?dateUnit(p.day+(cfg.dated?1:0),'Day'):''].filter(Boolean).join(' · ');
  const lower=log?unit(p.hour,'Hour'):cfg.dated?`${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`:[p.hour?unit(p.hour,'Hour'):'',p.minute?unit(p.minute,'Minute'):'',`${pad(p.second)} Seconds`].filter(Boolean).join(' · ');
  return [...(upper?[upper]:[]),lower];
 }
 function stamp(c){return {elapsedSeconds:seconds(c),label:format(c,true).join(' · ')};}
 function rate(c,online,combat,room){if(!online||settings(c).sessionActive!==true||settings(c).paused||c.roomOpen===false)return 0;if(!combat)return 1;return room?.running&&!room.hardPaused&&!room.holdPaused&&!room.pausedForTurn&&!room.attackResolution&&!room.itemResolution&&!(room.units||[]).some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length||u.pendingTimedResolutions?.length)?0.25:0;}
 return {DAY,MONTH,YEAR,seconds,parts,dateSeconds,displayParts,lines:c=>['In-Universe time:',...format(c)],stamp,rate};
});
