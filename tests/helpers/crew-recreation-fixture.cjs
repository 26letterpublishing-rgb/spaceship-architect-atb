const base=require('./crew-room-fixture.cjs');
module.exports=function(){
  const f=base();f.room.outsideCombat=true;
  f.ship.ship.sicInventory=f.ship.ship.sicInventory.filter(i=>i.id!=='vr');f.ship.ship.placements=f.ship.ship.placements.filter(p=>p.sicId!=='vr');
  for(const [id,type,cell]of [['bar','bar',27],['sleep','hibernation-chamber',105],['brig','brig',125]]){f.ship.ship.sicInventory.push({id,type,status:'installed'});f.ship.ship.placements.push({sicId:id,cell});}
  f.seat('bar');return f;
};
