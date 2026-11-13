(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./ship-map-core'):root.SAShipMap,node?require('./ship-distances'):root.SAShipDistances);
 if(node)module.exports=api;else root.SABlackHoleImpact=api;
})(typeof window==='object'?window:null,function(maps,distances){
 function arrival(room,o){
  for(const ship of room.starships||[]){const p=room.shipPositions?.find(p=>p.id===ship.id);if(!p||maps.gravityFieldActive(ship)||ship.dockedIn||ship.escapedAt||ship.ship.warpState?.phase==='traveling')continue;const hex=distances.roundHex(p);if(hex.q===o.q&&hex.r===o.r){ship.currentHullHp=ship.ship.currentHullHp=0;ship.navigation=null;}}
 }
 return {arrival};
});
