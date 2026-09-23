const {randomUUID,randomBytes}=require('node:crypto');
const puzzle=require('./hacking-puzzle');

const ttl=4*60*60*1000,maximum=128;
function createPracticeService(now=Date.now) {
  const sessions=new Map();
  function prune(){for(const [id,session] of sessions)if(session.expires<=now())sessions.delete(id);}
  function projection(session){
    return {id:session.id,practice:true,security:session.security,firewall:session.firewall,tier:session.tier,
      candidates:[...session.challenge.candidates],length:session.challenge.length,solved:session.solved,
      history:session.history.map(row=>({...row,guess:[...row.guess]})),expiresAt:session.expires};
  }
  function create(body,owner='local'){
    prune();
    const {security,firewall,tier}=body;
    if(!Number.isInteger(tier)||tier<1||tier>5)throw Error('Choose a Hacking Module from 1 to 5.');
    const secret=puzzle.createSecret(security,firewall),board=puzzle.challenge(secret,tier-1);
    const previous=sessions.get(body.previousToken);
    if(previous&&previous.owner===owner)sessions.delete(body.previousToken);
    if(sessions.size>=maximum||[...sessions.values()].filter(s=>s.owner===owner).length>=8)throw Error('Too many practice boards open. End an existing practice session or wait for its four-hour expiry.');
    const token=randomBytes(32).toString('hex'),session={id:randomUUID(),owner,security,firewall,tier,secret,challenge:board,solved:false,history:[],receipts:new Map(),expires:now()+ttl};
    sessions.set(token,session);return {token,board:projection(session)};
  }
  function find(token){
    prune();const session=typeof token==='string'&&sessions.get(token);
    if(!session)throw Object.assign(Error('Practice session ended. Start a new puzzle.'),{status:404});
    session.expires=now()+ttl;return session;
  }
  function get(token){return projection(find(token));}
  function submit(token,body){
    const session=find(token),receipt=body.requestId;
    if(typeof receipt!=='string'||!/^[-\w]{8,100}$/.test(receipt))throw Error('Invalid guess receipt.');
    const fingerprint=JSON.stringify(body.guess),old=session.receipts.get(receipt);
    if(old){if(old.fingerprint!==fingerprint)throw Error('A submitted guess cannot be changed.');return {...projection(session),acceptedRow:old.row.id,duplicate:true};}
    if(session.solved)throw Error('Access already granted. Start another puzzle.');
    if(session.history.length>=100)throw Error('Practice history is full. Start a new puzzle.');
    const feedback=puzzle.evaluate(session.challenge.answer,session.challenge.candidates,body.guess);
    const row={id:receipt,guess:[...body.guess],...feedback};
    session.history.push(row);session.solved=feedback.success;session.receipts.set(receipt,{fingerprint,row});
    return {...projection(session),acceptedRow:row.id};
  }
  function close(token){sessions.delete(token);return {ok:true};}
  return {create,get,submit,close};
}
module.exports={createPracticeService};
