(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.SAUniverseClock=api;})(typeof window==='object'?window:null,()=>{
 'use strict';
 const DAY=86400,MONTH=30*DAY,YEAR=12*MONTH;
 const seconds=c=>Math.round(Math.max(0,Number(c.elapsedMinutes)||0)*60000000)/1000000;
 function settings(c){return c.universeClock||{};}
 function parts(total){let n=Math.max(0,Math.floor(total));const year=Math.floor(n/YEAR);n%=YEAR;const month=Math.floor(n/MONTH);n%=MONTH;const day=Math.floor(n/DAY);n%=DAY;const hour=Math.floor(n/3600);n%=3600;return {year,month,day,hour,minute:Math.floor(n/60),second:n%60};}
 function dateSeconds(p){for(const [key,min,max]of [['year',0,999999],['month',1,12],['day',1,30],['hour',0,23],['minute',0,59],['second',0,59]])if(!Number.isInteger(Number(p[key]))||Number(p[key])<min||Number(p[key])>max)throw Error('Enter a valid '+key+'.');return Number(p.year)*YEAR+(Number(p.month)-1)*MONTH+(Number(p.day)-1)*DAY+Number(p.hour)*3600+Number(p.minute)*60+Number(p.second);}
 const unit=(n,name)=>`${n} ${name}${n===1?'':'s'}`;
 function lines(c){const cfg=settings(c),p=parts(seconds(c)+(cfg.dated?Number(cfg.offsetSeconds)||0:0)),pad=n=>String(n).padStart(2,'0');if(cfg.dated){const month=cfg.monthNames?['January','February','March','April','May','June','July','August','September','October','November','December'][p.month]:'Month '+(p.month+1);return ['In-Universe time:',`Year ${p.year} · ${month} · Day ${p.day+1}`,`${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`];}const upper=[p.year?unit(p.year,'Year'):'',p.month?unit(p.month,'Month'):'',p.day?unit(p.day,'Day'):''].filter(Boolean).join(' · '),lower=[p.hour?unit(p.hour,'Hour'):'',p.minute?unit(p.minute,'Minute'):'',`${pad(p.second)} Seconds`].filter(Boolean).join(' · ');return ['In-Universe time:',...(upper?[upper]:[]),lower];}
 function stamp(c){return {elapsedSeconds:seconds(c),label:lines(c).slice(1).join(' · ')};}
 function rate(c,online,combat,room){if(!online||settings(c).sessionActive!==true||settings(c).paused||c.roomOpen===false)return 0;if(!combat)return 1;return room?.running&&!room.hardPaused&&!room.holdPaused&&!room.pausedForTurn&&!room.attackResolution&&!room.itemResolution&&!(room.units||[]).some(u=>u.delayedAction?.awaitingRoll||u.pendingShipRolls?.length||u.pendingTimedResolutions?.length)?0.25:0;}
 return {DAY,MONTH,YEAR,seconds,parts,dateSeconds,lines,stamp,rate};
});
