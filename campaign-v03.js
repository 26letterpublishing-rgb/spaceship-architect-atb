'use strict';
const crypto = require('node:crypto');
const copy = value => structuredClone(value);
const id = prefix => prefix + '-' + crypto.randomUUID();
const cleanCharacter = source => {
  const character = copy(source?.character || source);
  if (!character || typeof character !== 'object' || Array.isArray(character)) throw Error('Choose a character data file.');
  delete character.access; delete character.campaignLink;
  return character;
};
function issue(api, campaign, role, playerId = null, characterId = null) {
  const token = api.newSession(campaign.code, role, characterId);
  const session = api.sessions.get(token);
  session.playerId = playerId;
  campaign.runtimeSessions ||= {};
  campaign.runtimeSessions[token] = session;
  return token;
}
function link(api, campaign, player, record) {
  if (player.characterId && player.characterId !== record.id) throw Error('Abandon your current character before linking another.');
  if ((campaign.players || []).some(p => p.id !== player.id && p.characterId === record.id)) throw Error('That character is already linked to another player.');
  player.characterId = record.id;
  record.character.identity ||= {};
  record.character.identity.playerName = player.name;
  for (const session of Object.values(campaign.runtimeSessions || {})) if (session.playerId === player.id) {
    session.role = 'character'; session.characterId = record.id;
  }
  for (const session of api.sessions.values()) if (session.code === campaign.code && session.playerId === player.id) {
    session.role = 'character'; session.characterId = record.id;
  }
}
async function handle(api, context) {
  const {path, req, res, body, code, token, sendJson, defaultCampaign, normalizeCampaign, campaignCode, normalizeStarshipRecord, shipMap, shipPower} = context;
  if (!path.startsWith('/api/campaign/v03/')) return false;
  const action = path.slice('/api/campaign/v03/'.length);
  const reply = (status, value) => { sendJson(res,status,value); return true; };
  try {
    if (req.method !== 'POST') return reply(405,{error:'Use POST for room actions.'});
    if (action === 'create') {
      if (!String(body.name || '').trim()) throw Error('Enter a campaign name.');
      let campaign;
      for(let attempt=0;attempt<200;attempt++) {
        campaign = defaultCampaign({code:campaignCode(), name:body.name, gmCode:crypto.randomBytes(32).toString('hex')});
        Object.assign(campaign,{interfaceVersion:'0.3',roomOpen:true,players:[],imports:[],runtimeSessions:{}});
        if(await api.store.create(campaign)) break;
        campaign = null;
      }
      if(!campaign) throw Error('Unable to allocate a room code.');
      api.campaignCache.set(campaign.code,campaign);
      const nextToken=issue(api,campaign,'gm'); await api.save(campaign);
      return reply(201,{token:nextToken,campaign:api.state(campaign,nextToken)});
    }
    if(action === 'load') {
      const source=body.backup;
      if(source?.format !== 'spaceship-architect-campaign' || source.campaign?.interfaceVersion !== '0.3' || !Array.isArray(source.campaign?.characters)) throw Error('Choose a v0.3 campaign file.');
      const incoming=normalizeCampaign(copy(source.campaign));
      if(!/^[A-Z0-9]{4}$/.test(incoming.code)) throw Error('The campaign file has an invalid room code.');
      const existing=await api.campaign(incoming.code);
      if(existing?.roomOpen && !['join','replace'].includes(body.choice)) return reply(200,{requiresChoice:true,code:incoming.code,name:existing.name});
      const campaign=body.choice==='join' && existing?.roomOpen ? existing : incoming;
      if(campaign===incoming) {
        campaign.players=existing?.players || []; campaign.runtimeSessions=existing?.runtimeSessions || {};
        for(const player of campaign.players) if(!campaign.characters.some(c=>c.id===player.characterId)) player.characterId=null;
        for(const session of Object.values(campaign.runtimeSessions)) if(session.playerId) {
          session.characterId=campaign.players.find(p=>p.id===session.playerId)?.characterId || null;
          session.role=session.characterId?'character':'viewer';
        }
        for(const [key, session] of api.sessions) if(session.code===campaign.code) api.sessions.delete(key);
        api.campaignCache.set(campaign.code,campaign);
        api.restoreEncounter(campaign.code,campaign.encounter);
      }
      campaign.roomOpen=true;
      const nextToken=issue(api,campaign,'gm'); await api.save(campaign);
      return reply(200,{token:nextToken,campaign:api.state(campaign,nextToken)});
    }
    const campaign=await api.campaign(code);
    // Explore rooms use temporary legacy sessions but the same galaxy editor.
    // Only this authenticated map action crosses the version gate; imports,
    // ownership and room management retain the ordinary v0.3 requirements.
    const showcaseMap=['starmap','ship/duplicate'].includes(action)&&campaign?.showcase===true;
    if(!campaign || campaign.interfaceVersion!=='0.3'&&!showcaseMap) return reply(404,{error:'That v0.3 room is not available.'});
    if(!campaign.roomOpen&&!showcaseMap) return reply(410,{error:'The GM has closed this room.'});
    campaign.players ||= []; campaign.imports ||= []; campaign.runtimeSessions ||= {};
    if(action==='join') {
      const name=String(body.name || '').trim(); if(!name) throw Error('Enter your first name.');
      const player={id:id('player'),name,characterId:null}; campaign.players.push(player);
      const nextToken=issue(api,campaign,'viewer',player.id); await api.save(campaign);
      return reply(200,{token:nextToken,campaign:api.state(campaign,nextToken)});
    }
    const session=api.session(token,code); if(!session) return reply(403,{error:'Join the room first.'});
    const gm=session.role==='gm';
    const player=campaign.players.find(p=>p.id===session.playerId);
    if(action==='starmap'){
      const result=require('./campaign-starmaps').command(campaign,body,{gm,characterId:session.characterId,combatActive:!api.canPassTime(code)});
      if(result.quote)return reply(200,result);
    } else if(action==='claim' || action==='assign') {
      if(action==='assign' && !gm) return reply(403,{error:'GM access required.'});
      const recipient=action==='assign'?campaign.players.find(p=>p.id===body.playerId):player;
      const record=campaign.characters.find(c=>c.id===body.characterId);
      if(!recipient || !record) throw Error('Choose a player and character.');
      if(!gm && String(body.password ?? '')!==record.pcCode) return reply(403,{error:'Character password is incorrect.'});
      link(api,campaign,recipient,record);
    } else if(action==='abandon') {
      if(!player) throw Error('No player is linked.'); player.characterId=null;
      for(const s of Object.values(campaign.runtimeSessions)) if(s.playerId===player.id){s.role='viewer';s.characterId=null;}
      for(const s of api.sessions.values()) if(s.code===code&&s.playerId===player.id){s.role='viewer';s.characterId=null;}
    } else if(action==='character/create') {
      if(!player || player.characterId) throw Error('An unlinked player must create this character.');
      const character=cleanCharacter(body.character);if(character.phase!=='finalized')throw Error('Finish character creation before joining.'); character.id=id('character');
      const record={id:character.id,pcCode:String(body.password??''),character,approved:true,createdAt:new Date().toISOString()};
      campaign.characters.push(record); link(api,campaign,player,record);
    } else if(action==='import') {
      const kind=body.kind==='ship'?'ship':'character';
      if(!gm && (!player || kind==='character' && player.characterId)) throw Error('Abandon your current character before importing another.');
      const data=kind==='character'?cleanCharacter(body.data):copy(body.data?.starship || body.data?.ship || body.data);
      if(kind==='character' && (!data.identity || !data.attributes || !String(data.identity.characterName||'').trim())) throw Error('Choose a character file containing a name and attributes.');
      if(kind==='ship' && !data?.confirmedOnce) throw Error('Confirm ship construction before importing.');
      if(kind==='ship')data.constructionCost=require('./ship-budget').cost(data);
      campaign.imports.push({id:id('import'),kind,data,playerId:player?.id,status:'pending',requestedAt:new Date().toISOString()});
    } else if(action==='ship/duplicate') {
      if(!gm)throw Error('Only the GM may duplicate a starship.');
      const original=campaign.starships.find(s=>s.id===body.shipId);if(!original)throw Error('Starship not found.');
      const source=copy(original.ship);source.id=id('ship');source.title=(original.title||'Starship')+' (Copy)';delete source.campaignLink;
      for(const key of ['characterLocations','crewCharacterIds','crewNpcUnitIds'])source[key]=key==='characterLocations'?{}:[];
      for(const key of ['remoteState','triangulatorState','cleanserState','navigation','warpState','destructState','fieldState','encounterState','sensorState','intruderState','transporterState'])delete source[key];
      campaign.starships.push(normalizeStarshipRecord({id:source.id,title:source.title,ship:source,controlType:original.controlType,crewCharacterIds:[],crewNpcUnitIds:[],characterLocations:{}}));
    } else if(action==='import/respond') {
      if(!gm) return reply(403,{error:'GM approval required.'});
      const request=campaign.imports.find(r=>r.id===body.requestId && r.status==='pending'); if(!request) throw Error('That request has already been handled.');
      if(body.approve) {
        if(request.kind==='ship') {
          const source=copy(request.data);source.id=id('ship'); delete source.campaignLink;
          const record=normalizeStarshipRecord({id:source.id,ship:source,controlType:'pc',crewCharacterIds:[]});
          const error=shipMap.exteriorError(source)||shipPower.constructionError(record);if(error)throw Error(error);
          record.ship.constructionCost=require('./ship-budget').cost(record.ship);if(typeof body.useGroupCredits!=='boolean')throw Error('Choose whether to purchase this ship using Group Credits.');if(body.useGroupCredits)require('./ship-budget').spend(campaign,record.ship.constructionCost);record.ship.groupCredits=campaign.shipCredits;campaign.starships.push(record); request.shipId=record.id;
        }
        if(request.kind==='character') { request.data.phase='finalized'; request.data.pendingRoll=null; request.data.advancementOpen=false; }
        request.status='approved';
      } else request.status='rejected';
    } else if(action==='import/finish') {
      if(!player || player.characterId) throw Error('An unlinked player must finish this import.');
      const request=campaign.imports.find(r=>r.id===body.requestId&&r.playerId===player.id&&r.kind==='character'&&r.status==='approved');
      if(!request) throw Error('An approved character import is required.');
      const character=cleanCharacter(request.data); character.id=id('character');
      const record={id:character.id,pcCode:String(body.password??''),character,approved:true,imported:true,createdAt:new Date().toISOString()};
      campaign.characters.push(record);request.status='completed';link(api,campaign,player,record);
    } else if(action==='leave') {
      if(!player) throw Error('No player is linked.');
      player.characterId=null;
      for(const [key,value] of Object.entries(campaign.runtimeSessions)) if(value.playerId===player.id){delete campaign.runtimeSessions[key];api.sessions.delete(key);}
    } else if(action==='close') {
      if(!gm) return reply(403,{error:'GM access required.'}); campaign.roomOpen=false;
      api.deleteEncounter(code);
    } else if(action==='change-code') {
      if(!gm) return reply(403,{error:'GM access required.'});
      let nextCode;do{nextCode=campaignCode();}while(await api.store.get(nextCode));
      const old=copy(campaign);old.roomOpen=false;old.redirectCode=nextCode;old.runtimeSessions={};await api.save(old);
      campaign.code=nextCode;campaign.roomOpen=true;
      for(const session of Object.values(campaign.runtimeSessions||{}))session.code=nextCode;
      for(const s of api.sessions.values()) if(s.code===code){s.code=nextCode;}
      for(const [key,s]of api.sessions)if(s.code===nextCode)campaign.runtimeSessions[key]=s;
      api.deleteEncounter(code);api.restoreEncounter(nextCode,campaign.encounter);
      await api.save(campaign);return reply(200,{code:nextCode,token,campaign:api.state(campaign,token)});
    } else return reply(404,{error:'Unknown room action.'});
    await api.save(campaign);
    return reply(200,{token,campaign:api.state(campaign,token)});
  } catch(error){return reply(400,{error:error.message});}
}
module.exports={handle,cleanCharacter,link};
