// Explicit fixture replacement mirrors the GM's typed-name confirmation.
module.exports=async(base,body)=>{
 if(!['prepareEncounter','clearEncounter'].includes(body.action))return body;
 const q=`code=${body.roomCode}&token=${body.gmToken}`;
 const [campaign,state]=await Promise.all([fetch(base+'/api/campaign/state?'+q).then(r=>r.json()),fetch(base+`/api/state?room=${body.roomCode}&token=${body.gmToken}`).then(r=>r.json())]);
 return {...body,confirmCampaignName:campaign.name,expectedEncounterId:state.encounterId};
};
