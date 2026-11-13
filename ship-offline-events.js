'use strict';
const {randomUUID}=require('node:crypto'),maps=require('./ship-map-core'),stations=require('./station-access');
const processId=randomUUID(),hydrating=new WeakSet(),pending=new Set();
const generation=ship=>processId+':'+(ship.sensorState?.offlineEpoch||'initial');
const installed=(ship,item)=>Boolean(item&&maps.installedItems(ship).some(i=>i===item));
function capture(ship,item){return installed(ship,item)&&Boolean(stations.online(item));}
function record(ship,item,before,{defer=false}={}){
 if(!before||!installed(ship,item)||stations.online(item)||hydrating.has(ship))return null;
 const event={id:randomUUID(),sicOffline:true,sicId:item.id,offlineGeneration:generation(ship),text:maps.definition(item.type).name+' went offline.'};
 if(defer)pending.add(event.id);
 require('./ship-sensors').report(ship,event);
 return event.id;
}
function project(ship){return {shipId:ship.id,generation:generation(ship),events:(ship.sensorState?.reports||[]).filter(e=>e.sicOffline&&e.id&&e.offlineGeneration===generation(ship)&&!pending.has(e.id)).map(e=>({id:e.id,at:e.at,sicId:e.sicId,text:ship.title+': '+e.text}))};}
function reset(ships){for(const ship of ships||[]){ship.sensorState||={};ship.sensorState.offlineEpoch=randomUUID();hydrating.add(ship);}}
function ready(ships){for(const ship of ships||[])hydrating.delete(ship);}
function publish(id){if(id)pending.delete(id);}
// A discarded transaction draft must never be adopted or projected after this call.
function discard(id){if(id)pending.delete(id);}
module.exports={capture,record,project,reset,ready,publish,discard};
