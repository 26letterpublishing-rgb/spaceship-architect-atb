const test=require('node:test'),assert=require('node:assert/strict'),maps=require('../ship-map-core'),oxygen=require('../ship-oxygen');
test('ship without Life Support loses oxygen except within an operational cockpit',()=>{
 const s={id:'s',currentHullHp:10,ship:{gridCells:[42,43,62,63,82,83],sicInventory:[{id:'cockpit',type:'cockpit-1'}],placements:[{sicId:'cockpit',cell:42}]}};
 assert.equal(maps.oxygenEnabled(s),false);const actor={id:'p',shipId:'s',name:'Pilot',dice:[10],skill:1,hp:10,location:{square:42}};
 assert.equal(oxygen.cockpitProtected(s,actor.location),true);oxygen.sync([s],[actor]);assert.equal(s.ship.oxygenState.crew.p,undefined);
 actor.location.square=83;oxygen.sync([s],[actor]);assert.equal(s.ship.oxygenState.crew.p.phase,'air');assert.equal(s.ship.oxygenState.crew.p.remaining,0);
 actor.location.square=42;oxygen.sync([s],[actor]);assert.equal(s.ship.oxygenState.crew.p,undefined);
 s.ship.sicInventory[0].impaired=true;oxygen.sync([s],[actor]);assert.ok(s.ship.oxygenState.crew.p);
});
test('Explore variants have legal placement and positive construction EN for both sides',()=>{const all=require('../showcase-variants')();assert.equal(all.length,22);for(const s of all){assert.equal(maps.exteriorError(s.ship),'');assert.equal(require('../ship-power').constructionError(s),'');assert.ok(s.ship.class.length>15);}});

test('NPC with an equipped personal gun proposes Fire in surface combat',()=>{const engine=require('../combat-engine'),gun=require('../data/weapons.json').find(w=>w.category==='ranged'&&!w.aimRequired&&!w.requiredCharge),u={id:'gunner',team:'npc',currentHp:30,weapons:[{weaponId:gun.id,inventoryId:'gun'}],heldWeaponId:'gun',location:{starshipId:''}};engine.migrateUnitCombat(u);const room={starships:[],units:[u,{id:'pc',team:'pc',currentHp:30,location:{starshipId:''}}]};const choice=require('../ship-automation').candidates(room,u)[0];assert.equal(choice.kind,'fire');assert.equal(choice.targetId,'pc');});
