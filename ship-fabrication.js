(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./ship-map-core'):root.SAShipMap);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SAFabrication=api;}(typeof window==='object'?window:null,function(maps){
  const units={second:1,sec:1,minute:60,min:60,hour:3600,hr:3600,day:86400,week:604800,month:2592000};
  const rows=[['Zennium','Zeltexa',1,'Iron',1,15],['Dianium','Crixium',1,'Magnesium',2,30],['Umbrexium','Rupium',1,'Zeltexa',2,60],['Xpidinium','Zennium',1,'Crixium',2,120],['Transpherion','Dianium',1,'Rupium',2,240],['Ragnaron','Umbrexium',1,'Zennium',2,480],['Crystilium','Xpidinium',1,'Dianium',2,960],['Paradon','Transpherion',1,'Umbrexium',2,1920],['Argol','Ragnaron',2,'Xpidinium',2,3600],['Mirium','Crystilium',4,'Transpherion',2,7200],['Drakkonite','Paradon',6,'Ragnaron',9,14400],['Phazon','Argol',7,'Crystilium',8,28800],['Necronium','Mirium',13,'Paradon',17,57600],['Endernium','Drakkonite',7,'Argol',19,129600],['Dark Phazon','Phazon',6,'Mirium',17,259200],['Carmot','Necronium',3,'Drakkonite',10,518400],['Infinium','Endernium',4,'Phazon',8,950400],['Aethion','Dark Phazon',20,'Necronium',34,2592000]];
  const recipes=rows.map(([name,a,an,b,bn,seconds])=>({name,seconds,minerals:{[a]:an,[b]:bn}}));
  const state=record=>(record.ship||record).fabricationState||=(( {systems:{},receipts:[],events:[]} ));
  const id=()=>globalThis.crypto.randomUUID();
  function recipe(type){const d=maps.catalog[type];if(!d)return null;const match=String(d.crafting||'').match(/^\s*(?:(\d+)\s+)?([A-Za-z ]+?)\s*,\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?)\.?\s*$/i);if(!match)return null;const unit=match[4].toLowerCase().replace(/s$/,'');return {type,name:d.name,minerals:{[match[2].trim()]:Number(match[1]||1)},seconds:Number(match[3])*units[unit]};}
  const aliases={'Dark Phazon':['Dark Phaeon'],Phazon:['Phaeon'],Ragnaron:['Ragnoron'],Transpherion:['Transphaerion'],Rupium:['Ruplium'],Crixium:['Crinium']};
  const mineralKeys=n=>[n,...(aliases[n]||[])];
  const affordable=(ship,r)=>Object.entries(r?.minerals||{}).every(([n,q])=>mineralKeys(n).reduce((sum,key)=>sum+Number((ship.ship||ship).minerals?.[key]||0),0)>=q);
  function consume(ship,minerals){for(const [n,q]of Object.entries(minerals)){let left=q;for(const key of mineralKeys(n)){const take=Math.min(left,Number(ship.ship.minerals[key]||0));if(take)ship.ship.minerals[key]-=take;left-=take;}}}
  const blueprints=ship=>[...new Set((ship.ship||ship).sicInventory.filter(i=>i.type==='blueprint'&&!i.pendingDisposition&&i.status!=='destroyed'&&recipe(i.blueprintType)).map(i=>i.blueprintType))];
  function reason(room,ship,item){const host=item&&maps.addonHost(ship,item);if(!host)return 'Install inside a Science Lab';if(ship.destroyedAt||ship.currentHullHp===0||ship.ship.currentHullHp===0)return 'Starship destroyed';for(const i of [item,host.item]){if(i.status==='destroyed')return 'Equipment destroyed';if(!maps.operational(i)||i.bootRemaining>0)return 'Equipment powered off or rebooting';if(i.impaired||i.impairmentPoints>0||i.status==='impaired')return 'Equipment impaired';}if(typeof module==='object'&&module.exports){const power=require('./ship-power');if(power.output(ship,room.units||[]).en<power.demand(ship))return 'Insufficient EN';}return '';}
  function notify(room,campaign,ship,text){const event={id:id(),text,at:Date.now()};state(ship).events=[...state(ship).events,event].slice(-60);ship.ship.crewRoomState||={rooms:{},receipts:[],down:{}};ship.ship.crewRoomState.report=event;for(const characterId of ship.crewCharacterIds||[]){if(!campaign)continue;campaign.privateNotes||=[];campaign.privateNotes.push({id:id(),characterId,kind:'crew-room',direction:'to-character',message:text,createdAt:new Date().toISOString(),readAt:null});}}
  function inspect(room,ship,labId){const s=state(ship);return {blueprints:blueprints(ship).map(type=>({...recipe(type),available:affordable(ship,recipe(type)),art:maps.definition(type).cardArt||maps.definition(type).image})),recipes:recipes.map(r=>({...r,available:affordable(ship,r)})),systems:maps.installedItems(ship).filter(i=>['3d-printer','mineral-processor'].includes(i.type)&&i.attachTo===labId).map(i=>({id:i.id,type:i.type,name:maps.definition(i.type).name,reason:reason(room,ship,i),queue:s.systems[i.id]?.queue||[]})),events:s.events};}
  function command(room,ship,labId,body,campaign){const data=state(ship),key=String(body.requestId||''),fingerprint=JSON.stringify([labId,body.kind,body.machineId,body.recipeType,body.jobId]);const old=data.receipts.find(r=>r.id===key);if(old){if(old.fingerprint!==fingerprint)throw Error('Receipt already used for another crafting command.');return {...old.result,duplicate:true};}
    const machine=maps.installedItems(ship).find(i=>i.id===body.machineId&&i.attachTo===labId&&['3d-printer','mineral-processor'].includes(i.type));if(!machine)throw Error('Choose a printer or processor installed in this lab.');const sys=data.systems[machine.id]||={queue:[]};let text;
    if(body.kind==='fabricate-cancel'){const job=sys.queue.find(j=>j.id===body.jobId);if(!job)throw Error('Job no longer queued.');sys.queue=sys.queue.filter(j=>j!==job);text='Job cancelled.'+(job.started?' Consumed minerals are not refunded.':'');}
    else {if(sys.queue.length>=6)throw Error('The queue holds at most six jobs, including the active job.');const r=machine.type==='3d-printer'?recipe(body.recipeType):recipes.find(r=>r.name===body.recipeType);if(!r||machine.type==='3d-printer'&&!blueprints(ship).includes(body.recipeType))throw Error('Purchase a valid blueprint first.');if(!affordable(ship,r))throw Error('Required minerals are not in ship storage.');sys.queue.push({id:id(),type:machine.type==='3d-printer'?r.type:null,name:r.name,minerals:{...r.minerals},seconds:r.seconds,remaining:r.seconds,started:false});text=r.name+' queued.';}
    advance(room,campaign,0);const result={text,spent:false};data.receipts.push({id:key,fingerprint,result});data.receipts=data.receipts.slice(-256);return result;
  }
  function active(room){return (room.starships||[]).some(s=>Object.values(s.ship.fabricationState?.systems||{}).some(x=>x.queue?.length));}
  function advance(room,campaign,seconds){
    if(!Number.isFinite(seconds)||seconds<0)return false;let changed=false;
    for(const ship of room.starships||[]){
      const data=ship.ship.fabricationState;if(!data)continue;let left=seconds;
      // Every machine shares the same timeline and mineral store. Jump between job boundaries.
      const limit=Object.values(data.systems).reduce((sum,s)=>sum+(s.queue?.length||0),0)+2;
      for(let iteration=0;iteration<limit;iteration++){
        const running=[];
        for(const [machineId,sys] of Object.entries(data.systems)){
          if(!sys.queue?.length)continue;
          const machine=ship.ship.sicInventory.find(i=>i.id===machineId),host=ship.ship.sicInventory.find(i=>i.id===machine?.attachTo);
          const destroyed=ship.destroyedAt||ship.currentHullHp===0||ship.ship.currentHullHp===0||!machine||!host||machine.status==='destroyed'||host.status==='destroyed';
          if(destroyed){notify(room,campaign,ship,'Fabrication equipment destroyed. Unfinished items and their consumed minerals were lost.');sys.queue=[];changed=true;continue;}
          const job=sys.queue[0];let blocked=reason(room,ship,machine);
          if(!blocked&&job.type&&job.remaining<=1e-7&&ship.ship.sicInventory.length>=400)blocked='SIC storage full';
          if(!blocked&&!job.started&&!affordable(ship,job))blocked='Waiting for minerals';
          if(blocked){if(job.paused!==blocked){job.paused=blocked;changed=true;}continue;}
          if(!job.started){ship.ship.minerals||={};consume(ship,job.minerals);job.started=true;changed=true;}
          if(job.paused){delete job.paused;changed=true;}running.push({job,sys});
        }
        if(!running.length)break;
        const step=Math.min(left,...running.map(({job})=>job.remaining));left=Math.max(0,left-step);
        for(const {job}of running){job.remaining=Math.max(0,job.remaining-step);if(step>0)changed=true;}
        let completed=false;
        for(const {job,sys}of running){if(job.remaining>1e-7)continue;
          if(job.type){if(ship.ship.sicInventory.length>=400){job.paused='SIC storage full';continue;}ship.ship.sicInventory.push({id:'printed-'+job.id,type:job.type,storage:true,printed:true,printedFor:null,stationLayout:'corners-v1'});ship.buildRevision=(ship.buildRevision||0)+1;notify(room,campaign,ship,'3D Printer finished crafting '+job.name+'. Added to starship storage.');}
          else{ship.ship.minerals[job.name]=Number(ship.ship.minerals[job.name]||0)+1;notify(room,campaign,ship,'Mineral Processor finished: 1 '+job.name+' added to storage.');}
          sys.queue.shift();changed=true;completed=true;
        }
        if(!completed)break;
      }
    }return changed;
  }
  return {recipe,recipes,affordable,blueprints,state,inspect,command,active,advance,reason};
}));
