const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ammo=require('../missile-ammunition');
const ui=fs.readFileSync(require.resolve('../missile-ui.js'),'utf8'),factory=fs.readFileSync(require.resolve('../sic-card-factory.js'),'utf8');
function cards(){const output=[];const start=factory.indexOf('for(const [type,data] of Object.entries(window.SAMissileAmmo.catalog))'),end=factory.indexOf('for(const [grade,data]',start);vm.runInNewContext(factory.slice(start,end),{window:{SAMissileAmmo:ammo},SIC_CATALOG:{},document:{createElement:()=>({}),querySelector:()=>({append:card=>output.push(card.innerHTML)})}});return output;}
function formula(round){const line=ui.split('\n').find(s=>s.includes("querySelector('[data-formula]').textContent=round?.flares"));const expression=line.slice(line.indexOf('textContent=')+12).trim().replace(/;$/,'');return vm.runInNewContext(expression,{round,window:{SAMissileAmmo:ammo}});}
test('normal card and Console descriptions match every approved ten-second tier profile',()=>{
 const html=cards();for(let tier=1;tier<=5;tier++){const round=ammo.catalog['missile-'+tier],expected=`Speed ${[2,2,3,4,5][tier-1]} units per 10 active combat seconds; +${tier} every 10 active seconds, maximum ${[7,12,18,24,30][tier-1]} at 50 seconds.`;assert.ok(html.find(s=>s.includes(`data-sic-card="missile-${tier}"`)).includes(expected));assert.ok(formula(round).includes(expected));assert.ok(html.find(s=>s.includes(`data-sic-card="missile-${tier}"`)).includes(round.image));}
});
test('Spread and Phazon wording and twelve-second launcher cooldown are unchanged',()=>{
 const html=cards();for(let tier=1;tier<=5;tier++){const r=ammo.catalog['spread-missiles-'+tier],a=tier>=4?2:1;assert.ok(html.find(s=>s.includes(`data-sic-card="${r.id}"`)).includes(`Speed ${a}, +${a} per 12 seconds; caps at ${a*5}.`));assert.ok(formula(r).includes(`Speed ${a} Units/12s; +${a} every 12 active seconds, maximum ${a*5}.`));assert.equal(r.speedProfile,undefined);}
 assert.ok(ui.includes('Speed 8 units / 12 active seconds. Cannot be shot down.'));assert.ok(factory.includes('One launch per 12 active combat seconds.'));
});
