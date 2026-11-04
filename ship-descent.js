"use strict";
// Combat cannot be escaped by landing. Campaign travel uses planet-travel instead.
const message='Ships cannot escape combat by landing on a planet.';
function queue(){return {ok:false,error:message};}
function advance(room){
  for(const ship of room.starships||[]){const d=ship.ship?.descentState;if(d?.phase!=='descending')continue;
    d.phase='interrupted';d.remaining=0;d.awaitingGm=false;d.message=message;
  }
  return [];
}
module.exports={queue,advance};
