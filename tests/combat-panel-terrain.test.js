const test=require('node:test'),assert=require('node:assert/strict');
const panel=require('../combat-panel-ui'),A=require('../combat-arena'),maps=require('../ship-map-core'),carry=require('../crew-carry');
test('combat categories and colors follow action purpose without losing weapon grades',()=>{
  for(const [name,category]of [['Preemptive Calculation','command'],['Gym','other'],['Repair Drone 5','repairs'],['Ripple Reflector','defense'],['Fire Beam Laser 4','weapons']])assert.equal(panel.presentation(name).category,category);
  assert.equal(panel.presentation('Fire Beam Laser 4').label,'Beam Laser 4');
  assert.equal(panel.presentation('Disable Gravity').color,panel.presentation('Nut Supplement').color);
  assert.ok(panel.presentation('Bar').small);assert.ok(panel.presentation('Hack SIC').large);
  const rows=['Fire Ion Pulse Cannon 1','Fire Beam Laser 4','Fire Ion Pulse Cannon 3','Fire Rapid Laser 1'].map(n=>[n]);
  const sorted=panel.sortEntries(rows),colors=sorted.map(e=>panel.presentation(e[0]).color);assert.equal(colors[0],colors[1]);assert.equal(colors[2],colors[3]);assert.equal(sorted.length,rows.length);
});
test('terrain names survive normalization and expansion without changing floor topology',()=>{
  for(const theme of Object.keys(A.themes)){const arena=A.normalize({theme}),expanded=A.expand(arena);assert.equal(expanded.theme,theme);assert.equal(expanded.floors.length,9);assert.equal(A.normalize(JSON.parse(JSON.stringify(expanded))).theme,theme);}
  assert.equal(A.normalize({theme:'<script>'}).theme,'plain');
});
test('surface walls and doors use identical ship markup and render each shared edge once',()=>{
  const arena=A.normalize({floors:[16,17,23,24],doors:{'16:17':{open:true}},walls:['23:24']}),layout=A.boundaryLayout(arena);
  const html=arena.floors.map(n=>maps.boundaryMarkup(layout,n,{isOpen:k=>arena.doors[k]?.open,doorAttributes:k=>({'data-arena-door':k})})).join('');
  assert.equal((html.match(/class="sa-map-door /g)||[]).length,1);assert.match(html,/sa-door-leaf/);assert.match(html,/is-open/);assert.match(html,/data-arena-door="16:17"/);
  assert.equal(layout.boundary(23,'right').kind,'wall');assert.equal(layout.boundary(24,'left').kind,'none');
});
test('surface carrying respects walls and doors, follows movement and drops on defeat',()=>{
  const carrier={id:'carrier',currentHp:10,location:{arenaId:'surface',square:16}},patient={id:'patient',characterName:'Patient',currentHp:0,location:{arenaId:'surface',square:17}};
  const room={arena:A.normalize({floors:[16,17,23,24]}),units:[carrier,patient]};
  assert.equal(carry.candidates(room,carrier).length,1);room.arena.walls=['16:17'];assert.equal(carry.candidates(room,carrier).length,0);room.arena.doors['16:17']={open:false,automatic:true};assert.equal(carry.candidates(room,carrier).length,0);room.arena.doors['16:17'].open=true;
  carry.command(room,carrier,patient.id);assert.equal(patient.carriedBy,carrier.id);carrier.location.square=23;carry.sync(room);assert.equal(patient.location.square,23);
  carry.command(room,carrier);assert.equal(patient.carriedBy,null);carry.command(room,carrier,patient.id);carrier.currentHp=0;carry.sync(room);assert.equal(patient.carriedBy,null);
  patient.location={starshipId:'ship',square:23};assert.equal(carry.candidates(room,carrier).length,0);
});
