(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.SAMissileAmmo=api;}(typeof window!=='undefined'?window:null,function(){
  const catalog=Object.create(null);
  for(const spread of [false,true])for(let tier=1;tier<=5;tier++){
    const id=`${spread?'spread-missiles':'missile'}-${tier}`;
    catalog[id]={id,name:`${spread?'Spread Missiles':'Missile'} ${tier}`,tier,price:(spread?[45,115,185,295,430]:[30,75,140,225,330])[tier-1],masking:(spread?4:6)+tier*2,acceleration:tier>=4?2:1,count:spread?4:1,dice:spread?1:2,cardNumber:spread?`B-${91+tier}`:tier<=3?`A-${114+tier}`:`B-${86+tier}`};
  }
  catalog['missile-flares']={id:'missile-flares',name:'Missile Flares',price:50,flares:true,count:3,cardNumber:'A-118'};
  for(const round of Object.values(catalog))round.image='sic-art-'+round.id+'.webp';
  const magazine=(ship,id)=>{const stock=ship?.ship?.missileAmmo||ship?.missileAmmo;return stock&&Object.hasOwn(stock,id)?stock[id]:{};};
  const used=(ship,id)=>Object.values(magazine(ship,id)).reduce((sum,n)=>sum+(Number.isSafeInteger(n)&&n>0?n:0),0);
  return {catalog,magazine,used};
}));
