'use strict';
const {randomUUID}=require('node:crypto'),art=require('./token-art');
function normalize(rows){return (Array.isArray(rows)?rows:[]).slice(0,40).filter(m=>m&&art.validIcon(m.iconRace)).map(m=>({id:String(m.id||randomUUID()).slice(0,100),name:String(m.name||art.label(m.iconRace)).trim().slice(0,80),iconRace:m.iconRace,iconVariant:art.variant(m.iconVariant)}));}
function command(chart,b,validHex){
 const key=validHex(b.hex),old=chart.hexes[key]||{},markers=old.npcMarkers||[];
 if(b.operation==='add'){
  if(!art.validIcon(b.iconRace))throw Error('Choose an available NPC icon.');if(markers.length>=40)throw Error('This hex already contains 40 markers.');
  chart.hexes[key]={...old,npcMarkers:[...markers,...normalize([{...b,id:randomUUID()}])]};return;
 }
 const marker=markers.find(m=>m.id===b.markerId);if(!marker)throw Error('That marker has moved or was removed. Select it again.');
 if(b.operation==='move'){
  const to=validHex(b.toHex);if(to===key)return;const destination=chart.hexes[to]||{};if((destination.npcMarkers||[]).length>=40)throw Error('That hex already contains 40 markers.');
  chart.hexes[to]={...destination,npcMarkers:[...(destination.npcMarkers||[]),marker]};
 }else if(b.operation==='edit'){
  if(!art.validIcon(b.iconRace))throw Error('Choose an available NPC icon.');Object.assign(marker,normalize([{...b,id:marker.id}])[0]);return;
 }else if(b.operation!=='remove')throw Error('Unknown marker action.');
 chart.hexes[key]={...old,npcMarkers:markers.filter(m=>m.id!==marker.id)};
}
module.exports={normalize,command};
