const clock=require('./universe-clock'),conditions=require('./module-conditions');
async function handle(api,{path,req,res,body,campaign,token,sendJson}){
 if(path!=='/api/campaign/universe')return false;
 const reply=(status,data)=>{sendJson(res,status,data);return true;};
 if(req.method!=='POST'||!api.gmSession(token,campaign.code))return reply(403,{error:'GM authorization required.'});
 try{await api.updateCampaignAtomically(campaign,next=>{
  next.universeClock||={};next.settings||={};
  if(body.action==='settings'){
   if(body.dated)next.universeClock.offsetSeconds=clock.dateSeconds(body)-clock.seconds(next);
   next.universeClock.dated=!!body.dated;next.universeClock.monthNames=!!body.monthNames;next.universeClock.paused=!!body.paused;
  }else if(body.action==='session'){
   if(body.expectedSession!==next.sessionNumber)throw Error('This session changed. Refresh and try again.');
   if(body.operation==='begin'){
    if(next.universeClock.sessionActive!==true){next.universeClock.sessionActive=true;next.universeClock.paused=false;}
   }else if(body.operation==='pause'||body.operation==='resume'){
    if(next.universeClock.sessionActive!==true)throw Error('Begin the session first.');
    next.universeClock.paused=body.operation==='pause';
   }else throw Error('Unknown session control.');
  }else if(body.action==='authoring')next.settings.moduleAuthoring=body.enabled===true;
  else if(body.action==='switch'){
   const keyword=String(body.keyword||'').trim(),key=conditions.key(keyword);conditions.condition({switches:[{keyword}]});
   if(!(next.conditionalActions||[]).some(a=>a.kind==='switch'&&conditions.key(a.keyword)===key)&&!next.moduleSource?.switches?.some(k=>conditions.key(k)===key))throw Error('That switch no longer exists.');
   if(!body.requestId||String(body.requestId).length>100)throw Error('A switch request identifier is required.');
   next.switchReceipts||=[];if(next.switchReceipts.includes(body.requestId))return;
   next.moduleSwitches||={};const previous=next.moduleSwitches[key];
   if(Boolean(previous?.active)!==Boolean(body.expectedActive))throw Error('This switch changed elsewhere. Review its current state.');
   Object.defineProperty(next.moduleSwitches,key,{value:{active:!previous?.active,changedAtSeconds:clock.seconds(next)},writable:true,configurable:true,enumerable:true});
   next.switchReceipts.push(body.requestId);next.switchReceipts=next.switchReceipts.slice(-200);
   (next.privateNotes||=[]).push({id:body.requestId,kind:'system',direction:'to-gm',message:'Module switch '+keyword+' turned '+(!previous?.active?'on':'off')+'.',createdAt:new Date().toISOString(),universeTime:clock.stamp(next),readAt:null});
  }else throw Error('Unknown clock or switch action.');
 });return reply(200,{campaign:api.state(campaign,token)});}catch(e){return reply(400,{error:e.message});}
}
module.exports={handle};
