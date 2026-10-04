"use strict";
const maps=require('./ship-map-core');
function cost(ship){const hull=new Set(ship.gridCells||[]).size*maps.HULL_COST+maps.triangleCells(ship).length*300;return hull+(ship.sicInventory||[]).reduce((n,i)=>n+maps.sicPrice(i,ship),0);}
function buildDelta(before,after,destroyedIds=[]){const old=new Map((before.sicInventory||[]).map(i=>[i.id,i])),next=new Map((after.sicInventory||[]).map(i=>[i.id,i]));let result=(new Set(after.gridCells||[]).size-new Set(before.gridCells||[]).size)*maps.HULL_COST+(maps.triangleCells(after).length-maps.triangleCells(before).length)*300+maps.hullUpgradeResizeCost(after,before);for(const [id,item]of next)if(!old.has(id))result+=maps.sicPrice(item,after);for(const [id,item]of old)if(!next.has(id)&&!destroyedIds.includes(id))result-=Math.ceil(maps.sicPrice(item)/(item.printed?4:2));return result;}
function spend(c,amount){if(!Number.isFinite(amount))throw Error('Invalid ship cost.');if(!c.showcase&&c.sessionNumber>0&&c.shipCredits<amount)throw Error('Not enough Group Credits.');c.shipCredits-=amount;}
module.exports={cost,buildDelta,spend};
