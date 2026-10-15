// Shop browsing groups are independent of saved GM stock and pricing categories.
(function(root){
 const groups=Object.freeze([
  {id:'sidearms',label:'Sidearms',pages:[1,2,4,5,6,7,8,9,10,12,13,14],color:'#e5b85b'},
  {id:'rifles',label:'Rifles & Shotguns',pages:[15,16,17,18,19,20,21,39,40,41],color:'#ec7887'},
  {id:'heavy',label:'Heavy & Special Weapons',pages:[22,24,28,29,38],color:'#c28ff5'},
  {id:'launchers',label:'Launchers & Ammunition',pages:[30,31,32,33,34,35,36,37],color:'#f29b54'},
  {id:'melee',label:'Melee Weapons',pages:[26,27,42,43,44,45,46],color:'#75dcb1'},
  {id:'control',label:'Explosives & Control Weapons',pages:[3,11,23,25,47,48,49],color:'#72cbed'}
 ]);
 function group(weapon){return groups.find(g=>g.pages.includes(Number(weapon.page)))||groups[2];}
 const api={groups,group};if(typeof module==='object')module.exports=api;if(root)root.SAWeaponGroups=api;
})(globalThis);
