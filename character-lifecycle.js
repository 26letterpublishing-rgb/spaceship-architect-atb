// Server-owned Rest decisions, contact delivery and memorial summaries.
const {randomUUID}=require('node:crypto');
const healthRating=c=>Math.max(2,Math.min(20,(c.attributes?.health||[]).reduce((n,d)=>n+(Number.isInteger(d)&&d>=0&&d<=4?d+1:0),0)));
const contactTypes=['Underworld Contact','Smuggler','Security Contact','Government Insider','Corporate Insider','Military Contact','Merchant','Dockworker','Bartender / Innkeeper','Journalist','Scientist / Researcher','Medical Contact','Explorer / Scout','Community Contact','Other'];
function contacts(c){return (Array.isArray(c.informants)?c.informants:[]).slice(0,5).map(x=>({name:String(x.name||'').trim().slice(0,100),type:String(x.type||'').trim().slice(0,100)})).filter(x=>x.name&&x.type);}
function restore(c,{hp=0,exertion=0,full=false}={}){
 c.health||={};c.resources||={};const max=Math.max(0,Number(c.computed?.maximumHp)||0),exMax=Math.max(0,Number(c.resources.exertionMax)||0);
 const beforeHp=Number(c.health.current)||0,beforeEx=Number(c.resources.exertionCurrent)||0;
 c.health.current=Math.min(max,full?max:beforeHp+Math.max(0,Number(hp)||0));
 c.resources.exertionCurrent=Math.min(exMax,full?exMax:beforeEx+Math.max(0,Number(exertion)||0));
 return {hp:c.health.current-beforeHp,exertion:c.resources.exertionCurrent-beforeEx};
}
function rest(c,medbay=false){return restore(c,{hp:medbay?Number(c.computed?.maximumHp)||0:healthRating(c),exertion:Number(c.resources?.exertionMax)||0});}
function inheritance(c){const total=Math.max(0,Math.floor(Number(c.experience?.totalGained)||0)),percent=c.identity?.raceId==='kabuto'?75:50;return {total,available:Math.max(0,Number(c.experience?.available)||0),percent,transfer:Math.floor(total*percent/100)};}
function sync(campaign){
 campaign.privateNotes||=[];
 for(const r of campaign.characters||[]){
  if(r.approved&&r.character.phase==="finalized"&&Number(r.character.health?.current)<=0)deathReview(campaign,r);
  if(r.approved&&r.character.identity?.classId==='informant'&&!r.informantsDelivered){const list=contacts(r.character);if(list.length===5){r.informantsDelivered=true;campaign.privateNotes.push({id:randomUUID(),characterId:r.id,characterName:r.character.identity?.characterName||'Informant',direction:'to-gm',kind:'informant-contacts',persistent:true,message:'Informant contacts: '+list.map(x=>x.name+' — '+x.type).join('; ')+'. Incorporate these contacts into the Story Console. The class can add another contact when entering a new star system; coordinate that with the player.',createdAt:new Date().toISOString(),readAt:null});}}
 }
}
function deathReview(campaign,record){
 if(record.deathReviewPending||record.memorial)return;
 const now=new Date().toISOString(),xp=inheritance(record.character),name=record.character.identity?.characterName||'Character';record.deathReviewPending=true;
 campaign.privateNotes.push({id:randomUUID(),characterId:record.id,characterName:name,direction:'to-gm',kind:'death-review',persistent:true,requestStatus:'pending',message:name+' may have died. Review revival and Medbay treatment before confirming. Current XP: '+xp.available+'; total gained XP: '+xp.total+'. Suggested manual transfer: '+xp.transfer+' XP ('+xp.percent+'% of total gained, rounded down). No XP is transferred automatically.'+(xp.percent===75?' A replacement Kabuto may also retain Reverence and personal Credits, but not Drama Cards.':''),createdAt:now,readAt:null});
}
module.exports={healthRating,contactTypes,contacts,restore,rest,inheritance,sync,deathReview};
