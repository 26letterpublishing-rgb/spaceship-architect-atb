const {randomUUID}=require('node:crypto');
const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power'),distances=require('./ship-distances');
const state=ship=>ship.ship.fieldState ||= {receipts:[],systems:{},pods:[]};
const system=(ship,id)=>{const s=state(ship);s.systems||={};return s.systems[id] ||= {};};
const impaired=item=>Boolean(item?.impaired||item?.status==='impaired'||item?.impairmentPoints>0);
const hull=ship=>new Set(ship.ship.gridCells||[]).size;
const bayOccupants=(room,ship,sicId)=>room.starships.filter(s=>s.ship.fieldState?.dockedIn?.shipId===ship.id&&s.ship.fieldState.dockedIn.sicId===sicId);
const bayCapacity=(room,ship,sicId)=>{const ships=bayOccupants(room,ship,sicId);return {ships:ships.map(s=>({id:s.id,name:s.title,hull:hull(s)})),used:ships.reduce((n,s)=>n+hull(s),0),maximum:Math.floor(hull(ship)/2),slots:4};};
const scale=ship=>hull(ship)<=26?1:hull(ship)<=50?2:hull(ship)<=100?3:hull(ship)<=200?4:5;
const point=(room,id)=>distances.positions(room.starships,room.shipPositions).find(p=>p.id===id);
const present=ship=>ship&&!ship.destroyedAt&&!ship.escapedAt&&(ship.currentHullHp==null||ship.currentHullHp>0)&&ship.ship.warpState?.phase!=='traveling';
function visibleTarget(room,access,target,gm,outside=room.outsideCombat){const observer=access.controlSource||access.ship;return target&&(target.id===observer.id||gm||(outside&&target.controlType==='pc')||observer.sensorState?.contacts?.[target.id]?.level==='detected'||room.knownContacts?.[observer.id]?.[target.id]?.level==='detected');}
function report(ship,text){state(ship).report={id:randomUUID(),text,at:Date.now()};return text;}
function place(room,ship,p){room.shipPositions=distances.positions(room.starships,room.shipPositions).map(old=>old.id===ship.id?{id:ship.id,q:p.q,r:p.r}:old);room.shipDistances=distances.fromPositions(room.starships,room.shipPositions);ship.navigation={phase:'stopped',speed:0};}
function stopUnit(unit,reason){if(unit.escapedAt===reason&&unit.defeatedAt&&unit.atb===0&&!unit.delayedAction&&!unit.timedAction&&!unit.delayTimer&&!unit.pendingShipRolls?.length)return;unit.escapedAt=reason;unit.defeatedAt=Date.now();unit.atb=0;for(const key of ['delayedAction','delayTimer','timedAction','consoleHold','shieldRestabilizing','auRestabilizing'])unit[key]=null;for(const key of ['pendingShipRolls','pendingTimedResolutions','queuedEffects','thrownEffects'])unit[key]=[];}
function resumeUnit(unit,reason){if(unit.escapedAt!==reason)return;unit.escapedAt=null;unit.defeatedAt=Number(unit.currentHp)>0?null:unit.defeatedAt;unit.atb=0;}
function validate(room,unit,sicId){const access=stations.access(room,unit,sicId);if(!access?.definition.fieldUtility||access.blocked)throw Error('Operate an available utility station or bridge.');if(access.controlled&&access.definition.utility==='escape-pods')throw Error('Escape pods require a passenger at their physical station.');if(access.definition.energyCost&&power.output(access.ship,room.units).en<power.demand(access.ship))throw Error('Restore sufficient ship power.');return access;}
function hurtPod(room,ship,item,points,campaign){
  if(item.type!=='escape-pods'||points<=0)return 0;
  const details=system(ship,item.id);details.paid||={};let count=0;
  const people=campaign?require('./ship-crew-rooms').actors(room,campaign):(room.units||[]).map(u=>({id:u.characterId||u.id,loc:u.location,get hp(){return u.currentHp;},set hp(value){u.currentHp=value;}}));
  for(const person of people)if(person.loc?.starshipId===ship.id&&maps.buildLayout(ship.ship).footprint.get(Number(person.loc.square))?.sicId===item.id){person.hp-=20*points;details.paid[person.id]=Number(item.impairmentPoints)||1;count++;}
  if(count)report(ship,'Escape pod impairment: '+count+' occupant(s) took '+20*points+' fixed HP damage.');return count;
}
function command(room,unit,body,{gm=false,outsideCombat=false,campaign,clearance=false}={}){
  try{
    for(const vessel of room.starships||[])vessel.characterLocations ||= structuredClone(campaign?.starships.find(s=>s.id===vessel.id)?.characterLocations||{});
    const access=validate(room,unit,body.sicId),ship=access.ship,type=access.definition.utility,data=state(ship),details=system(ship,access.id);
    if(ship.id!==body.starshipId)throw Error('Wrong ship.');
    const receipt=String(body.receipt||body.requestId||''),fingerprint=JSON.stringify([unit.id,body.kind,body.targetId,body.distance,body.text,body.passengers,body.enabled,body.decompressed]);
    if(!/^[\w-]{8,100}$/.test(receipt))throw Error('A utility command receipt is required.');
    const previous=data.receipts?.find(r=>r.id===receipt);if(previous){if(previous.fingerprint!==fingerprint)throw Error('That receipt belongs to another command.');return {ok:true,duplicate:true,ship,text:previous.text};}
    const approved=clearance&&gm&&body.kind==='dock'&&details.request?.targetId===body.targetId;
    if(!outsideCombat&&!approved&&(room.activeId!==unit.id||unit.delayedAction||unit.timedAction||unit.delayTimer||unit.consoleHold))throw Error('Wait for your turn and finish the current action.');
    if(!present(ship))throw Error('This ship is no longer on the battlefield.');
    const target=room.starships.find(s=>s.id===body.targetId),range=target?distances.hexDistance(point(room,ship.id),point(room,target.id)):Infinity;
    const detectable=visibleTarget(room,access,target,gm,outsideCombat);
    let text='';
    if(body.kind==='collect-object'&&(type==='tractor-beam'||type==='manipulation-arm')){
      const object=room.spaceObjects?.find(o=>o.id===body.targetId&&!o.collectedBy);
      if(!object)throw Error('That object is no longer available.');
      if(object.kind==='planet')throw Error('Planets and planetary debris cannot be collected.');
      if(type==='tractor-beam'&&impaired(access.item))throw Error('Repair the Tractor Beam before retrieving objects.');
      if(details.cooldown>0)throw Error('Wait for the arm to recover.');
      const limit=type==='tractor-beam'?2:0;
      if(distances.hexDistance(point(room,ship.id),object)>limit+1e-6)throw Error(type==='tractor-beam'?'Move within two units of the object.':'Move into the object hex.');
      if(object.kind==='mineral'){
        ship.ship.minerals||={};const amount=Number(ship.ship.minerals[object.mineral]||0)+object.quantity;
        if(!Number.isSafeInteger(amount)||amount>1000000)throw Error('Mineral storage quantity would exceed its limit.');
        ship.ship.minerals[object.mineral]=amount;
      }else{data.cargo||=[];data.cargo.push({id:object.id,name:object.name,kind:object.kind,quantity:object.quantity});}
      object.collectedBy=ship.id;object.collectedAt=Date.now();
      if(type==='manipulation-arm'&&impaired(access.item))details.cooldown=24;
      text='Recovered '+object.quantity+' '+(object.kind==='mineral'?object.mineral:object.name)+' aboard '+ship.title+'.';
    }else if(body.kind==='rescue-pod'&&(type==='docking-bay'||type==='manipulation-arm')){
      if(impaired(access.item))throw Error('Repair the recovery system first.');
      const source=room.starships.find(s=>s.ship.fieldState?.pods?.some(p=>p.id===body.targetId&&!p.recovered)),pod=source?.ship.fieldState.pods.find(p=>p.id===body.targetId);
      if(!pod||distances.hexDistance(point(room,ship.id),pod)>1e-6)throw Error('Move into the escape pod hex before recovery.');
      if(!gm&&source.id!==ship.id)throw Error('The GM must approve recovery and crew transfer from another ship.');
      const p=ship.ship.placements.find(p=>p.sicId===access.id),cell=maps.placementSquares(ship.ship,access.item,p).find(c=>ship.ship.gridCells.includes(c));
      const people=require('./ship-crew-rooms').actors(room,campaign);
      for(const [index,passenger]of pod.passengers.entries()){
        const actor=people.find(a=>a.id===passenger.id);if(!actor)continue;
        const loc={starshipId:ship.id,square:cell,mesh:[0,4,8][index],stationed:false};
        if(actor.unit){resumeUnit(actor.unit,'pod:'+pod.id);actor.unit.location=loc;}
        if(actor.record){source.crewCharacterIds=source.crewCharacterIds.filter(id=>id!==actor.id);delete source.characterLocations[actor.id];ship.crewCharacterIds=[...new Set([...ship.crewCharacterIds,actor.id])];ship.characterLocations[actor.id]=loc;}
        else{source.crewNpcUnitIds=(source.crewNpcUnitIds||[]).filter(id=>id!==actor.id);ship.crewNpcUnitIds=[...new Set([...(ship.crewNpcUnitIds||[]),actor.id])];const saved=campaign?.npcRoster?.find(n=>n.id===actor.id);if(saved)Object.assign(saved,{location:loc,escapedAt:null,defeatedAt:Number(saved.currentHp)>0?null:saved.defeatedAt,atb:0});}
      }
      pod.recovered=true;text='Escape pod recovered. Passengers are aboard '+ship.title+'.';
    }else if(type==='tractor-beam'){
      if(body.kind==='release'){details.tether=null;text='Tractor beam released.';}
      else{
        if(body.kind!=='tractor')throw Error('Choose capture or release.');
        if(impaired(access.item))throw Error('Tractor Beam does not function while impaired.');
        if(!detectable||!present(target)||target.id===ship.id||range>2+1e-6)throw Error('Choose a detected target within 2 units.');
        if(target.currentShieldHp>0)throw Error('Tractor Beam cannot grip a ship through active shields.');
        if(hull(target)>hull(ship)/2)throw Error('Target hull must be half your hull size or less.');
        if(room.starships.some(s=>Object.values(s.ship.fieldState?.systems||{}).some(d=>d.tether?.targetId===target.id)))throw Error('That target is already held by a tractor beam.');
        const length=Number(body.distance);if(!Number.isFinite(length)||length<0||length>2)throw Error('Choose a separation between 0 and 2 units.');
        const a=point(room,ship.id),b=point(room,target.id),direction=range>1e-6?{q:(b.q-a.q)/range,r:(b.r-a.r)/range}:{q:1,r:0};
        details.tether={targetId:target.id,q:direction.q*length,r:direction.r*length};place(room,target,{q:a.q+details.tether.q,r:a.r+details.tether.r});text='Tractor Beam holding '+target.title+' at '+length+' units.';
      }
    }else if(type==='manipulation-arm'){
      if(body.kind!=='manipulate')throw Error('Choose an object to manipulate.');
      if(!detectable||target.id===ship.id||range>1e-6)throw Error('The arm and target must occupy the same map hex.');
      if(details.cooldown>0)throw Error('Impaired arm recovering: '+Math.ceil(details.cooldown)+' active seconds remain.');
      const operation=String(body.text||'').trim();if(!operation||operation.length>200)throw Error('Enter an operation, up to 200 characters.');
      details.cooldown=impaired(access.item)?24:0;text='Manipulation Arm: '+operation+' / '+target.title+'. Salvage and cargo changes require GM adjudication.';
    }else if(type==='docking-bay'){
      if(impaired(access.item))throw Error('Repair the Docking Bay before ships may enter or exit.');
      if(body.kind==='bay-shield'){
        if(!outsideCombat)throw Error('Install the doorway shield outside combat.');
        if(details.shield)throw Error('Doorway shield already installed.');
        if(!(ship.ship.groupCredits>=2500))throw Error('Doorway shield costs 2,500 Group Credits.');
        ship.ship.groupCredits-=2500;if(ship.ship.confirmed)ship.ship.confirmed.groupCredits=ship.ship.groupCredits;details.shield=true;text='Energy-shield doorway installed. Decompression no longer required.';
      }else if(['bay-open','bay-close'].includes(body.kind)){
        details.doorOpen=body.kind==='bay-open';details.forcedOpen=details.doorOpen&&Boolean(access.controlled);text=details.doorOpen?(details.shield?'Exterior bay door open; atmospheric shield holding.':'Exterior bay door open. Bay and connected open rooms are venting.'):'Exterior bay door sealed.';
      }else if(body.kind==='undock'){
        const occupants=bayOccupants(room,ship,access.id),docked=occupants.find(s=>s.id===body.targetId)||(occupants.length===1?occupants[0]:null);
        if(!docked)throw Error('Choose a docked ship to release.');
        if(!details.shield&&body.decompressed!==true)throw Error('Confirm the bay is sealed and decompressed.');
        const reason='docked:'+ship.id+':'+access.id;state(docked).dockedIn=null;docked.escapedAt=null;place(room,docked,point(room,ship.id));for(const person of room.units||[])resumeUnit(person,reason);text=docked.title+' undocked.';
      }else if(['request-dock','dock','force-dock'].includes(body.kind)){
        if(ship.ship.warpState?.phase==='activating'||target?.ship.warpState?.phase==='activating')throw Error('Cancel warp activation on both ships before docking.');
        if(!detectable||!present(target)||target.id===ship.id||range>1e-6)throw Error('Move both ships into the same hex before docking.');
        const capacity=bayCapacity(room,ship,access.id);
        if(capacity.ships.length>=4||capacity.used+hull(target)>capacity.maximum)throw Error('Docking capacity: maximum four ships with combined Hull no more than half the carrier Hull.');
        if(room.starships.some(s=>s.ship.fieldState?.dockedIn?.shipId===target.id))throw Error('Undock the incoming ship\'s passengers first; nested docking is unavailable.');
        if(body.kind==='request-dock'){details.request={id:receipt,targetId:target.id,unitId:unit.id,characterId:unit.characterId||null,at:Date.now()};text='Docking request for '+target.title+'. Awaiting GM clearance.';}
        else{
          const forced=body.kind==='force-dock';
          if(forced&&(!access.controlled||!details.doorOpen))throw Error('Capture the Docking Bay and open its exterior door before forced docking.');
          if(!forced&&!gm)throw Error('The GM must confirm both ships consent to docking.');
          if(!forced&&!details.shield&&body.decompressed!==true)throw Error('Confirm the bay is sealed and decompressed.');
          const reason='docked:'+ship.id+':'+access.id;state(target).dockedIn={shipId:ship.id,sicId:access.id};target.escapedAt=reason;place(room,target,point(room,ship.id));for(const person of room.units||[])if(person.location?.starshipId===target.id)stopUnit(person,reason);details.request=null;text=target.title+(forced?' forcibly docked in ':' secured in ')+ship.title+' Docking Bay. Independent combat actions suspended.';
        }
      }else throw Error('Choose docking clearance, departure or a doorway upgrade.');
    }else if(type==='escape-pods'){
      if(body.kind!=='launch-pod')throw Error('Choose passengers and launch.');
      if(details.launched)throw Error('This escape pod has already launched.');
      const ids=body.passengers;if(!Array.isArray(ids)||!ids.length||ids.length>3||new Set(ids).size!==ids.length||!ids.includes(unit.characterId||unit.id))throw Error('Select yourself and up to two other passengers.');
      const people=require('./ship-crew-rooms').actors(room,campaign),passengers=ids.map(id=>people.find(p=>p.id===id));
      if(passengers.some(p=>!p||p.unit?.shipAi||p.loc?.starshipId!==ship.id||maps.buildLayout(ship.ship).footprint.get(Number(p.loc.square))?.sicId!==access.id||p.unit?.delayedAction||p.unit?.timedAction||p.unit?.medbayTreatment))throw Error('All passengers must be physically inside the pod and free of pending actions.');
      const pod={sicId:access.id,passengers:passengers.map(p=>({id:p.id,name:p.name})),...point(room,ship.id),at:Date.now(),impairments:Math.max(Number(access.item.impairmentPoints)||0,impaired(access.item)?1:0)};pod.id=randomUUID();
      data.pods||=[];data.pods.push(pod);details.launched=pod.id;
      let launchDamage=0;for(const person of passengers){const unpaid=Math.max(0,pod.impairments-(details.paid?.[person.id]||0));if(unpaid){person.hp-=20*unpaid;launchDamage+=20*unpaid;}if(person.unit){stopUnit(person.unit,'pod:'+pod.id);person.unit.location={environment:'escape-pod',starshipId:'',square:null,mesh:4,escapePodId:pod.id,stationed:false};}if(person.record)(ship.characterLocations||={})[person.id]={environment:'escape-pod',square:null,escapePodId:pod.id,stationed:false};else{const saved=campaign?.npcRoster?.find(n=>n.id===person.id);if(saved)Object.assign(saved,{location:person.unit.location,escapedAt:person.unit.escapedAt,defeatedAt:person.unit.defeatedAt,atb:0});}}
      text='Escape pod launched with '+passengers.map(p=>p.name).join(', ')+'. Distress beacon active.'+(launchDamage?' Impaired pod: '+launchDamage+' total fixed HP damage across its passengers.':'');
    }else if(type==='ionic-displacers'||type==='transport-scrambler'){
      if(body.kind!==type||typeof body.enabled!=='boolean')throw Error('Choose field on or off.');
      if(type==='ionic-displacers'&&body.enabled&&!details.enabled){if(impaired(access.item))throw Error('Repair Ionic Force Displacers first.');if(unit.shipAi||!power.spend(room,ship.id,7))throw Error('Activation requires 7 AU. Ship AI cannot spend AU.');details.remaining=12;}
      details.enabled=body.enabled;text=access.definition.name+(body.enabled?' active.':' deactivated.');
    }else if(type==='ripple-reflector'){
      if(body.kind!=='reflector'||typeof body.enabled!=='boolean')throw Error('Choose reflector on or off.');details.enabled=body.enabled;text='Ripple reflection '+(body.enabled?'enabled':'disabled')+(impaired(access.item)?'. Impaired: incoming damage also reaches this ship.':'.');
    }
    for(const vessel of room.starships)for(const item of maps.installedItems(vessel).filter(i=>i.type==='docking-bay'))system(vessel,item.id).dockedShips=bayOccupants(room,vessel,item.id).map(s=>({id:s.id,rank:maps.scaleRank(s),mapColor:maps.shipColor(s)}));
    report(ship,text);data.receipts=[...(data.receipts||[]),{id:receipt,fingerprint,text}].slice(-100);return {ok:true,ship,text};
  }catch(error){return {ok:false,error:error.message};}
}
function advance(room,seconds=0){
  let changed=require('./ship-countermeasures').advance(room,0);
  for(const ship of room.starships||[]){
    for(const [id,d]of Object.entries(ship.ship.fieldState?.systems||{})){
      const previous=d.cooldown||0;
      if(previous>0)d.cooldown=Math.max(0,previous-seconds);
      if(Math.ceil(previous)!==Math.ceil(d.cooldown))changed=true;
      if(d.tether){const item=maps.installedItems(ship).find(i=>i.id===id),target=room.starships.find(s=>s.id===d.tether.targetId);
        if(!item||!stations.online(item)||impaired(item)||!present(ship)||!present(target)||target.currentShieldHp>0||hull(target)>hull(ship)/2||power.output(ship,room.units).en<power.demand(ship)){d.tether=null;changed=true;report(ship,'Tractor hold released: target or beam unavailable.');}
        else{const p=point(room,ship.id);place(room,target,{q:p.q+d.tether.q,r:p.r+d.tether.r});}
      }
    }
    for(const pod of ship.ship.fieldState?.pods||[])if(!pod.recovered)for(const passenger of pod.passengers){const u=room.units?.find(u=>(u.characterId||u.id)===passenger.id);if(u){stopUnit(u,'pod:'+pod.id);u.location={environment:'escape-pod',starshipId:'',square:null,mesh:4,escapePodId:pod.id,stationed:false};}}
    const dock=ship.ship.fieldState?.dockedIn;
    if(dock){const host=room.starships.find(s=>s.id===dock.shipId),reason='docked:'+dock.shipId+':'+dock.sicId;
      if(!host||host.destroyedAt||host.currentHullHp<=0){state(ship).dockedIn=null;ship.escapedAt=null;for(const u of room.units||[])resumeUnit(u,reason);report(ship,'Carrier lost. Emergency separation; GM adjudicates wreckage consequences.');}
      else{place(room,ship,point(room,host.id));ship.escapedAt=reason;for(const u of room.units||[])if(u.location?.starshipId===ship.id&&!u.location.escapePodId)stopUnit(u,reason);}
    }
    if(ship.ship.fieldState&&(ship.ship.fieldState.position||dock||ship.ship.fieldState.pods?.length||Object.values(ship.ship.fieldState.systems||{}).some(d=>d.tether))){const p=point(room,ship.id);ship.ship.fieldState.position={q:p.q,r:p.r};}
  }
  for(const vessel of room.starships||[])for(const item of maps.installedItems(vessel).filter(i=>i.type==='docking-bay')){const details=system(vessel,item.id),ships=bayOccupants(room,vessel,item.id).map(s=>({id:s.id,rank:maps.scaleRank(s),mapColor:maps.shipColor(s)}));if(JSON.stringify(details.dockedShips||[])!==JSON.stringify(ships)){details.dockedShips=ships;changed=true;}}
  return changed;
}
function inspect(room,unit,sicId,gm=false){
  const access=validate(room,unit,sicId),ship=access.ship;
  return {gm,controlled:Boolean(access.controlled),cargo:state(ship).cargo||[],details:system(ship,sicId),report:state(ship).report?.text||'Utility ready.',
    targets:(room.spaceObjects||[]).filter(o=>!o.collectedBy&&o.kind!=='planet'&&['tractor-beam','manipulation-arm'].includes(access.definition.utility)).map(o=>({id:o.id,name:o.name+' / '+o.quantity,distance:distances.hexDistance(point(room,ship.id),o)})).concat(room.starships.filter(s=>s.id!==ship.id&&visibleTarget(room,access,s,gm)).map(s=>({id:s.id,name:s.title,distance:distances.hexDistance(point(room,ship.id),point(room,s.id))})).concat(room.starships.filter(s=>gm||s.id===ship.id).flatMap(s=>(s.ship.fieldState?.pods||[]).filter(p=>!p.recovered).map(p=>({id:p.id,name:'Escape Pod / Distress Beacon',distance:distances.hexDistance(point(room,ship.id),p)}))))),
    passengers:(room.units||[]).filter(u=>u.location?.starshipId===ship.id&&maps.buildLayout(ship.ship).footprint.get(Number(u.location.square))?.sicId===sicId).map(u=>({id:u.characterId||u.id,name:u.characterName})),
    capacity:bayCapacity(room,ship,sicId),docked:bayOccupants(room,ship,sicId).map(s=>s.title).join(', ')||null};
}
module.exports={command,advance,inspect,state,system,scale,hurtPod,bayCapacity};
