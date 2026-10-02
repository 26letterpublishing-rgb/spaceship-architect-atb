const maps=require('./ship-map-core'),stations=require('./station-access'),power=require('./ship-power'),rules=require('./combat-rules');
const state=ship=>ship.ship.securityDroidState||={droids:{},receipts:[]};
const key=u=>u.characterId||u.id;
const registered=(ship,u)=>Boolean(ship.crewCharacterIds?.includes(u.characterId)||ship.crewNpcUnitIds?.includes(u.id));
const weapon={weaponId:'security-cannons',inventoryId:'security-cannons',name:'Droid ballistic cannons',category:'ranged',damage:'3D8',range:'5',toHit:'Dexterity + Projectile',chargeBonus:'',maxCharge:0};
function active(room,ship,item,d){return d.enabled!==false&&item&&stations.online(item)&&item.status!=='destroyed'&&!ship.destroyedAt&&!ship.escapedAt&&power.output(ship,room.units).en>=power.demand(ship);}
function sync(room,makeUnit){
 for(const ship of room.starships||[]){const installed=maps.installedItems(ship).filter(i=>maps.definition(i.type).securityDroid);if(!installed.length&&!ship.ship.securityDroidState)continue;
  const s=state(ship);
  for(const item of installed)if(!s.droids[item.id])s.droids[item.id]={id:'security-droid-'+ship.id+'-'+item.id,enabled:true,warning:true,exemptions:{},seen:{},currentHp:50};
  for(const [sicId,d]of Object.entries(s.droids)){
   const item=installed.find(i=>i.id===sicId);let u=room.units.find(u=>u.id===d.id);
   const layout=maps.buildLayout(ship.ship),square=d.location?.square??ship.ship.gridCells.find(sq=>!layout.footprint.get(sq)?.blocked);if(!Number.isInteger(square))continue;
   if(!u){u=makeUnit({team:'npc',characterName:'Security Droid',playerName:'GM',maximumHp:50,currentHp:d.currentHp??50,speed:10,moveSpeed:7,color:'#dcad55',physicalAttribute:10,physicalSkill:2,location:d.location||{starshipId:ship.id,square,mesh:4,stationed:false},initialAtb:d.atb||0},room.threshold||100);u.id=d.id;u.defeatedAt=d.defeatedAt;room.units.push(u);}
   if(d.repair){u.currentHp=50;u.defeatedAt=null;u.unconscious=false;d.repair=false;}
   u.securityDroid={shipId:ship.id,sicId};u.raceId='android';u.raceType='mechanical';u.allyNpc=ship.controlType==='pc';u.dexterityDice=[10,10,10];u.dodgeDice=[8,8,8];u.dodgeSkill=1;u.projectileSkill=2;u.damageReduction=0;u.moveSpeed=7;u.weapons=[{...weapon}];u.heldWeaponId=weapon.inventoryId;
   const on=active(room,ship,item,d)&&u.currentHp>0&&!u.defeatedAt;u.speed=on?10:0;u.automationMode=on?'npc':'off';u.automationSuspended=false;
   d.currentHp=u.currentHp;d.defeatedAt=u.defeatedAt;d.atb=u.atb;d.location={...u.location};
  }
 }
}
function command(room,unit,body){const a=stations.access(room,unit,body.sicId);if(!a?.definition.securityDroid||a.blocked)return {ok:false,error:'Use the Security Droid console from the Bridge or a successful hack.'};const s=state(a.ship),d=s.droids[a.id]||=( {id:'security-droid-'+a.ship.id+'-'+a.id,enabled:true,warning:true,exemptions:{},seen:{},currentHp:50});if(typeof body.receipt!=='string'||body.receipt.length<8)return {ok:false,error:'Missing command receipt.'};if(s.receipts.includes(body.receipt))return {ok:true,duplicate:true,free:true,ship:a.ship};
 if(body.kind==='enabled'&&typeof body.enabled==='boolean')d.enabled=body.enabled;
 else if(body.kind==='warning'&&typeof body.enabled==='boolean'){d.warning=body.enabled;d.seen={};}
 else if(body.kind==='exempt'&&typeof body.enabled==='boolean'){if(![...(a.ship.crewCharacterIds||[]),...(a.ship.crewNpcUnitIds||[])].includes(body.crewId))return {ok:false,error:'Only registered crew may be exempted.'};d.exemptions[body.crewId]=body.enabled;delete d.seen[body.crewId];}
 else return {ok:false,error:'Choose a Droid control.'};s.receipts=[...s.receipts,body.receipt].slice(-64);return {ok:true,free:true,ship:a.ship,text:'Security Droid settings updated.'};}
function route(ship,a,b){const base=maps.buildLayout(ship.ship),layout={...base,edge:(x,y)=>{const e=base.edge(x,y);return ship.ship.doorStates?.[e.key]==='locked'?{...e,kind:'wall'}:e;}};return maps.meshRoute(layout,a,b);}
function visible(ship,a,b){const layout=maps.buildLayout(ship.ship),xy=p=>({x:p.square%layout.columns*3+p.mesh%3,y:Math.floor(p.square/layout.columns)*3+Math.floor(p.mesh/3)}),p=xy(a),q=xy(b),n=Math.max(Math.abs(q.x-p.x),Math.abs(q.y-p.y))*4;let previous=a.square;
 for(let i=1;i<=n;i++){const x=Math.floor(p.x+(q.x-p.x)*i/n+.5),y=Math.floor(p.y+(q.y-p.y)*i/n+.5),square=Math.floor(y/3)*layout.columns+Math.floor(x/3);if(!layout.hull.has(square))return false;if(square!==previous){const e=layout.edge(previous,square);if(e.kind==='wall'||e.kind==='door'&&ship.ship.doorStates?.[e.key]!=='open')return false;previous=square;}}return true;}
function observe(room){for(const u of room.units||[]){if(!u.securityDroid||!u.speed)continue;const ship=room.starships.find(s=>s.id===u.securityDroid.shipId),d=ship&&state(ship).droids[u.securityDroid.sicId];if(!d)continue;for(const t of threats(room,ship,d,u)){if(visible(ship,u.location,t.location)&&!d.seen[key(t)])d.seen[key(t)]={serial:t.securityActionSerial||0,hostile:false};}}}
function threats(room,ship,d,u){return room.units.filter(t=>t.id!==u.id&&!t.securityDroid&&!t.shipAi&&t.currentHp>0&&!t.defeatedAt&&t.location?.starshipId===ship.id&&Number.isInteger(t.location.square)&&(!registered(ship,t)||d.exemptions[key(t)]===false));}
function action(room,unit){unit.securityActionSerial=(unit.securityActionSerial||0)+1;for(const ship of room.starships||[])for(const d of Object.values(ship.ship.securityDroidState?.droids||{})){const seen=d.seen[key(unit)];if(seen&&unit.securityActionSerial>seen.serial)seen.hostile=true;}}
function candidates(room,u){const ship=room.starships.find(s=>s.id===u.securityDroid.shipId),d=ship&&state(ship).droids[u.securityDroid.sicId];if(!d||!u.speed)return [];observe(room);
 const options=threats(room,ship,d,u).filter(t=>d.seen[key(t)]).map(t=>({t,path:route(ship,u.location,t.location)})).filter(o=>o.path).sort((a,b)=>a.path.length-b.path.length);const choice=options[0];if(!choice)return [];
 const {t,path}=choice,canFire=!d.warning||d.seen[key(t)].hostile;
 if(canFire&&visible(ship,u.location,t.location))return [{action:'playerCombatAction',kind:'fire',targetId:t.id,distance:rules.mappedDistance(room,u,t)}];
 if(path.length<=1)return [];const travel=path.slice(0,Math.min(7,path.length-1));return [{action:'playerCombatAction',kind:'move',route:travel.map(p=>({...p,environment:'starship',starshipId:ship.id})),stationOnArrival:false}];
}
function repair(ship){for(const d of Object.values(ship.ship.securityDroidState?.droids||{})){d.currentHp=50;d.repair=true;}}
module.exports={state,registered,active,sync,command,route,visible,observe,action,candidates,repair};
