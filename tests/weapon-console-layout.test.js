const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Beam/Rapid ring layout is explicitly family-scoped and preserves processor allocation',()=>{
 const all=fs.readFileSync('console-common.css','utf8'),css=all.split('/* Beam/Rapid only:')[1].split('/* End Beam/Rapid ring layout. */')[0].split('*/').slice(1).join('*/');
 for(const s of [...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@')))assert.ok(s.startsWith('dialog.weapon-console:is([data-weapon-family="beam-laser"],[data-weapon-family="rapid-laser"]).shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);assert.match(css,/\.weapon-plot\{grid-row:2\/4!important\}/);assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);assert.match(css,/aspect-ratio:328\/390/);assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.doesNotMatch(css,/weapon-processor|weapon-feed|weapon-controls|font-size/);assert.match(all,/grid-template-rows:96px minmax\(240px,1fr\) 210px 55px!important/);
 assert.match(all,/\.weapon-processor\{grid-column:1;grid-row:4;overflow:auto!important\}/);
});
test('weapon family marker comes from resolved definition; heading metadata is narrowly opt-in',()=>{
 const renderer=fs.readFileSync('weapon-console-ui.js','utf8'),common=fs.readFileSync('console-common.js','utf8');
 assert.match(renderer,/const family=initial.definition.weaponFamily\|\|'rapid-laser';view.dataset.weaponFamily=family;/);
 assert.match(common,/view.classList.contains\('weapon-console'\)&&\['beam-laser','rapid-laser'\]\.includes\(view.dataset.weaponFamily\)/);
 assert.match(common,/heading.title=heading.textContent;heading.setAttribute\('aria-label',heading.textContent\)/);
});

test('Ripple/Ion/Missile ring layout is explicitly family-scoped and preserves processor allocation',()=>{
 const all=fs.readFileSync('console-common.css','utf8'),css=all.split('/* Ripple/Ion/Missile only:')[1].split('/* End Ripple/Ion/Missile ring layout. */')[0].split('*/').slice(1).join('*/');
 for(const s of [...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@')))assert.ok(s.startsWith('dialog.weapon-console:is([data-weapon-family="ripple-cannon"],[data-weapon-family="ion-pulse-cannon"],[data-weapon-family="missile-launcher"]).shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);assert.match(css,/\.weapon-plot\{grid-row:2\/4!important\}/);assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);assert.match(css,/aspect-ratio:328\/390/);assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.doesNotMatch(css,/weapon-processor|weapon-feed|weapon-controls|font-size/);assert.match(all,/grid-template-rows:96px minmax\(240px,1fr\) 210px 55px!important/);
 assert.match(all,/\.weapon-processor\{grid-column:1;grid-row:4;overflow:auto!important\}/);
});

test('Ripple/Ion/Missile heading metadata is explicitly scoped',()=>{const common=fs.readFileSync('console-common.js','utf8');assert.ok(common.includes("view.classList.contains('weapon-console')&&['ripple-cannon','ion-pulse-cannon','missile-launcher'].includes(view.dataset.weaponFamily)"));});

test('Rail/Devastation ring layout is explicitly family-scoped and preserves processor allocation',()=>{
 const all=fs.readFileSync('console-common.css','utf8'),css=all.split('/* Rail/Devastation only:')[1].split('/* End Rail/Devastation ring layout. */')[0].split('*/').slice(1).join('*/');
 for(const s of [...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@')))assert.ok(s.startsWith('dialog.weapon-console:is([data-weapon-family="ballistic-rail-cannon"],[data-weapon-family="ballistic-rail-repeater"],[data-weapon-family="devastation-laser"]).shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);assert.match(css,/\.weapon-plot\{grid-row:2\/4!important\}/);assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);assert.match(css,/aspect-ratio:328\/390/);assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.doesNotMatch(css,/weapon-processor|weapon-feed|weapon-controls|font-size/);assert.match(all,/grid-template-rows:96px minmax\(240px,1fr\) 210px 55px!important/);
 assert.match(all,/\.weapon-processor\{grid-column:1;grid-row:4;overflow:auto!important\}/);
});


test('Rail/Devastation metadata is explicitly scoped',()=>{assert.ok(fs.readFileSync('console-common.js','utf8').includes("view.classList.contains('weapon-console')&&['ballistic-rail-cannon','ballistic-rail-repeater','devastation-laser'].includes(view.dataset.weaponFamily)"));});

test('Phazon/Mine/Disruptor ring layout is explicitly family-scoped and preserves processor allocation',()=>{
 const all=fs.readFileSync('console-common.css','utf8'),css=all.split('/* Phazon/Mine/Disruptor only:')[1].split('/* End Phazon/Mine/Disruptor ring layout. */')[0].split('*/').slice(1).join('*/');
 for(const s of [...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@')))assert.ok(s.startsWith('dialog.weapon-console:is([data-weapon-family="phazon-torpedo"],[data-weapon-family="mine-launcher"],[data-weapon-family="ion-disruptor"]).shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);assert.match(css,/\.weapon-plot\{grid-row:2\/4!important\}/);assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);assert.match(css,/aspect-ratio:328\/390/);assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.doesNotMatch(css,/weapon-processor|weapon-feed|weapon-controls|font-size/);assert.match(all,/grid-template-rows:96px minmax\(240px,1fr\) 210px 55px!important/);
 assert.match(all,/\.weapon-processor\{grid-column:1;grid-row:4;overflow:auto!important\}/);
});


test('Phazon/Mine/Disruptor metadata is explicitly scoped',()=>{assert.ok(fs.readFileSync('console-common.js','utf8').includes("view.classList.contains('weapon-console')&&['phazon-torpedo','mine-launcher','ion-disruptor'].includes(view.dataset.weaponFamily)"));});

test('shared Console metadata script remains executable JavaScript',()=>{new (require('node:vm').Script)(fs.readFileSync('console-common.js','utf8'));});
