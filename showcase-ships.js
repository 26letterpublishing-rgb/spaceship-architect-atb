// Legacy fixed-size designs retained for regression fixtures. Fresh Explore uses showcase-fleet-builder.
const maps = require('./ship-map-core');

module.exports = function showcaseShip(id, title, controlType, crewCharacterIds, startCell, crewNpcUnitIds = []) {
  const wayfinder = controlType === 'pc';
  // Columns/rows are relative to this ship's interior origin. Split mounts keep
  // weapon controls inside and the barrel outside, independent of barrel length.
  const specs = [
    ['engine-1', 'en-au-engine-6', 1, 3],
    ['cockpit', 'bridge-1', 3, 0, {stationLayout:'corners-v1'}],
    ['sensors', 'sensors-6', 0, 0],
    ['laser', `rapid-laser-${wayfinder ? 5 : 4}`, 7, -2],
    ['lock', 'lock-on-9', 7, 6],
    ['darkveil', `darkveil-${wayfinder ? 4 : 5}`, 2, 1],
    ['beam', `beam-laser-${wayfinder ? 4 : 3}`, 8, 9, {rotation:90, exteriorRotation:90}, [10,9]],
    ['ripple', `ripple-cannon-${wayfinder ? 4 : 3}`, 8, 3, {rotation:90, exteriorRotation:90}, [10,3]],
    ['ion', 'ion-pulse-cannon-1', 0, 1, {rotation:270, exteriorRotation:270}, [-2,1]],
    ['missile-launcher', 'missile-launcher-1', 0, 5, {exteriorRotation:90}, [-2,5]],
    ['life', 'life-support', 7, 1],
    ['nutrition', 'nutritional-supplement', 6, 0],
    ['exhaust', `exhaust-thruster-${wayfinder ? 3 : 2}`, 0, wayfinder ? -2 : -1],
    ['ionic', 'ionic-pulse-thruster-2', 4, -1],
    ['shield', `shield-${wayfinder ? 3 : 2}`, 7, 4],
    ['drone', 'repair-drone-1', 9, 8],
  ];
  const cell = (x,y) => startCell + y*20 + x;
  return {id,title,controlType,crewCharacterIds,crewNpcUnitIds,ship:{
    id,title,affiliation:wayfinder ? 'Exploration Crew' : 'Unknown Contact',
    class:wayfinder ? 'Patrol Explorer' : 'Stealth Raider',confirmedOnce:true,
    gridCells:maps.rectangleCells({},startCell,10,10),
    sicInventory:specs.map(([key,type,x,y,options])=>({id:`${id}-${key}`,type,status:'installed',...options})),
    placements:specs.map(([key,type,x,y,options,exterior])=>({sicId:`${id}-${key}`,cell:cell(x,y),...(exterior?{exteriorCell:cell(...exterior)}:{})})),
    missileAmmo:{[`${id}-missile-launcher`]:{'missile-1':2,'missile-flares':1}},
    doorStates:{},
  }};
};
