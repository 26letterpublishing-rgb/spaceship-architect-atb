(function(root){'use strict';
 function create(state){
  if(!state?.debugConsole||state.roomCode!=='SIMULATED-VIEWER')throw Error('Local Console fixture required.');
  const unit=state.units[0],ship=state.starships[0],data=ship.ship,primary=data.sicInventory.find(i=>i.id==='preview');let serial=0;
  const info={details:{notes:[],prisoners:[],orders:[],enabled:true,safety:true,robotBartender:true,name:'SIMULATED Ship AI',jobs:[]},skills:[{name:'Piloting',attribute:'Physical',trainingGain:1,level:2}],attributes:['Physical','Mental'],patients:[{id:unit.id,name:'Simulated patient',hp:20,maximum:30,downSeconds:0}],shipMinerals:data.minerals,fabricators:[],targets:state.starships.slice(1).map(s=>({id:s.id,title:s.title,name:s.title,eligible:true})),passengers:[{id:unit.id,name:unit.characterName}],occupants:[{id:unit.id,name:unit.characterName}],capacity:{ships:[],used:0,maximum:162},cargo:[],report:'SIMULATED / Local preview only',gm:true,rooms:[],crew:[],reports:[],title:ship.title,columns:20};
  const kinds=new Set(['inspect','note','remove','check','refresh','configure','simulate','train','exercise','order','bartender','hibernate','wake','intake','condition','release','load','treat','cancel','deposit','withdraw','tractor','release-tractor','grab','operate','dock','undock','launch-pod','reflector','ionic-force-displacers','transport-scrambler','scan','refresh-cameras']);
  function request(body){if(!kinds.has(body.kind||'inspect'))throw Error('This operation has no simulated result yet; no game request was sent.');if(!body.kind||body.kind==='inspect')return {result:structuredClone(info)};
   const text='SIMULATED: '+(body.text||body.kind);info.report=text;info.details.report={text};
   if(body.kind==='note')info.details.notes.push({id:'sample-'+(++serial),title:String(body.title||'Sample note'),text:String(body.text||''),author:'Simulated operator',authorId:unit.characterId||unit.id,checked:false});
   if(body.kind==='remove')info.details.notes=info.details.notes.filter(n=>n.id!==body.noteId);
   if(body.kind==='check'){const n=info.details.notes.find(n=>n.id===body.noteId);if(n)n.checked=Boolean(body.checked);}
   if(body.kind==='configure')Object.assign(info.details,{name:String(body.text||info.details.name),enabled:body.enabled!==false,automationMode:body.automationMode||'off'});
   if(body.kind==='simulate')Object.assign(info.details,{simulation:String(body.text||''),safety:body.enabled!==false});
   if(body.kind==='order')info.details.orders.push({text});if(body.kind==='bartender')info.details.robotBartender=Boolean(body.enabled);
   if(body.kind==='hibernate')info.details.hibernation={phase:'sleeping',occupantName:unit.characterName,activeSeconds:0};if(body.kind==='wake')info.details.hibernation=null;
   if(body.kind==='intake')info.details.prisoners.push({id:'sample-'+(++serial),name:String(body.title||'Sample prisoner'),note:String(body.text||'')});
   if(body.kind==='release'){const p=info.details.prisoners.find(p=>p.id===body.noteId);if(p)p.released=true;}
   if(body.kind==='condition')info.details.condition=String(body.text||'');
   if(body.kind==='tractor')info.details.tether={targetId:body.targetId};if(body.kind==='release-tractor')info.details.tether=null;
   if(body.kind==='launch-pod')info.details.launched=true;
   if(['reflector','ionic-force-displacers','transport-scrambler'].includes(body.kind))info.details.enabled=Boolean(body.enabled);
   return {result:{...structuredClone(info),text}};
  }
  function action(body){
   if(body.action==='playerCombatAction'&&['holdConsole','resumeConsole'].includes(body.kind)){unit.consoleHold=body.kind==='holdConsole';return {ok:true};}
   if(body.action==='playerCombatAction'&&body.kind==='moveStarship'){if(!Number.isFinite(body.destination?.q)||!Number.isFinite(body.destination?.r))throw Error('Choose a simulated destination.');const p=state.shipPositions.find(p=>p.id===ship.id);Object.assign(p,body.destination);return {ok:true};}
   if(body.action==='shipMaintenance'){primary.disabled=body.kind==='off';primary.status=primary.disabled?'powered-down':'online';return {ok:true};}
   if(['weaponCommand','shieldCommand','shipCommand','utilityCommand'].includes(body.action)){info.report='SIMULATED command preview: '+body.action;state.log.unshift({text:info.report});return {ok:true,simulated:true};}
   throw Error('This action has no simulated outcome yet; no game request was sent.');
  }
  function utility(body){if(!['gravity','oxygen','cloak','gravity-field','transport','repair-ship','devastation-charge','devastation-discharge'].includes(body.kind))return action({...body,action:'utilityCommand'});
   if(body.kind==='gravity')data.gravityEnabled=Boolean(body.enabled);if(body.kind==='oxygen')data.oxygenEnabled=Boolean(body.enabled);if(body.kind==='cloak')ship.cloaked=Boolean(body.enabled);if(body.kind==='gravity-field')data.gravityFieldEnabled=Boolean(body.enabled);
   info.report='SIMULATED '+body.kind;return {ok:true,result:{text:info.report},simulated:true};
  }
  return {request,action,utility,info};
 }
 const api={create};if(typeof module==='object')module.exports=api;else root.SAConsolePreviewActions=api;
})(typeof window==='object'?window:globalThis);
