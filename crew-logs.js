const crypto=require('node:crypto');
const clean=(value,max)=>String(value??'').slice(0,max);
function logs(campaign){if(!Array.isArray(campaign.crewLogs))campaign.crewLogs=[];return campaign.crewLogs;}
function visible(campaign,id,gm=false){const peers=new Set([id]);for(const ship of campaign.starships||[])if(ship.crewCharacterIds?.includes(id))for(const peer of ship.crewCharacterIds)peers.add(peer);return logs(campaign).filter(log=>gm||peers.has(log.characterId));}
function award(campaign,log){
 if(log.awardId)return;
 const id='crew-log-'+crypto.randomUUID(),now=new Date().toISOString();log.awardId=id;
 campaign.awardHistory.push({id,resource:'reverence',amount:1,targetIds:[log.characterId],before:{characters:[]},at:now,claimRequired:true,claimedCharacterIds:[],androidExperienceIds:[]});
 campaign.privateNotes.push({id:crypto.randomUUID(),characterId:log.characterId,characterName:log.characterName,direction:'to-character',kind:'award',awardId:id,rewardResource:'reverence',rewardAmount:1,rewardStatus:'pending',message:'Crew Log approved. Receive 1 Reverence for your session entry.',createdAt:now,readAt:null});
}
async function handle(api,{path,req,res,body,campaign,token,sendJson}){
 if(path!=='/api/campaign/crew-log'||req.method!=='POST')return false;
 const gm=api.gmSession(token,campaign.code),session=api.session(token,campaign.code),id=session?.characterId;
 try{
  if(!gm&&!id)throw Error('Link a character before using Crew Logs.');
  const kind=body.kind;
  if(kind==='library'){const ship=campaign.starships.find(s=>s.id===body.starshipId);if(!ship||(!gm&&!ship.crewCharacterIds?.includes(id)))throw Error('Use a Library on a ship you crew.');sendJson(res,200,{logs:logs(campaign).filter(l=>ship.crewCharacterIds?.includes(l.characterId)),entries:campaign.libraryEntries||[]});return true;}
  if(kind==='data'){
   if(!gm)throw Error('Only the GM can publish Library data.');
   const title=clean(body.title,100).trim(),text=clean(body.text,20000).trim();if(!title||!text)throw Error('Enter a title and text.');
   campaign.libraryEntries||=[];campaign.libraryEntries.push({id:crypto.randomUUID(),title,text,createdAt:new Date().toISOString()});
  }else if(kind==='approve'){
   if(!gm)throw Error('Only the GM can approve Crew Logs.');
   const log=logs(campaign).find(l=>l.id===body.id);if(!log?.submittedAt)throw Error('Submitted entry not found.');award(campaign,log);log.approvedAt||=new Date().toISOString();
  }else if(kind==='save'||kind==='submit'){
   if(!id)throw Error('Use the linked character to write a Crew Log.');
   const number=Number(body.session);if(!Number.isInteger(number)||number<0||number>campaign.sessionNumber)throw Error('Choose an existing session.');
   const connected=[...(api.clients.get(campaign.code)||[])].some(c=>api.gmSession(c.token,campaign.code));
   if(kind==='submit'&&!connected)throw Error('The GM is offline. Save or export this entry and send it later.');
   let log=logs(campaign).find(l=>l.characterId===id&&l.session===number);
   if(!log){log={id:crypto.randomUUID(),characterId:id,session:number};logs(campaign).push(log);}
   if(body.revision!==undefined&&Number(body.revision)!==Number(log.revision||0))throw Error('This entry changed elsewhere. Reload before replacing it.');
   const text=clean(body.text,20000);if(kind==='submit'&&!text.trim())throw Error('Write an entry first.');
   Object.assign(log,{name:clean(body.name,60).trim()||'Crew Log',text,characterName:campaign.characters.find(c=>c.id===id)?.character.identity?.characterName||'Character',revision:(log.revision||0)+1,updatedAt:new Date().toISOString()});
   if(kind==='submit'){if(!log.submittedAt)campaign.privateNotes.push({id:crypto.randomUUID(),characterId:id,characterName:log.characterName,direction:'to-gm',kind:'message',message:log.characterName+' submitted '+log.name+' for Session '+number+'. Review and approve in Prompt / Give → Crew Logs.',createdAt:new Date().toISOString(),readAt:null});log.submittedAt=new Date().toISOString();}
  }else throw Error('Unknown Crew Log operation.');
  await api.save(campaign);sendJson(res,200,{campaign:api.state(campaign,token)});
 }catch(error){sendJson(res,409,{error:error.message});}
 return true;
}
module.exports={handle,visible,award};
