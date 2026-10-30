const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('utility-console.css','utf8');
test('Life Support alone places live instruments below the unchanged machine image',()=>{
 const block=css.split('/* Life Support only: unobscured machine image above live instruments. */')[1];assert.ok(block,'Life Support layout block');
 const selectors=[...block.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>=4);for(const s of selectors)assert.ok(s.startsWith('dialog.utility-console:has(.life-machine)'),s);
 assert.match(block,/@media\(min-width:901px\)/);assert.match(block,/\.life-machine>img\{[^}]*position:static[^}]*object-fit:contain/);assert.match(block,/\.life-instruments\{[^}]*position:static[^}]*grid-row:2/);assert.match(block,/\.gravity-chamber\{[^}]*grid-row:2/);
 assert.doesNotMatch(block,/display:none|visibility:hidden|font-size:|font:|url\(|animation:/);
});
test('Life Support removes only instrument backing and retains accessible content overflow',()=>{
 const block=css.split('/* Life Support only: unobscured machine image above live instruments. */')[1];assert.match(block,/\.life-instruments\{[^}]*background:transparent[^}]*border:0[^}]*overflow:visible/);assert.match(block,/\.utility-scene\{[^}]*overflow:auto!important/);assert.match(block,/grid-template-rows:minmax\(96px,1fr\) auto/);
 const source=fs.readFileSync('utility-console-ui.js','utf8');for(const token of ['life-support-console-scene.webp','data-life-air','data-life-crew','data-life-rooms','data-life-meter','data-life-power','data-gravity-state','data-movement','data-oxygen-state'])assert.ok(source.includes(token),token);
});
test('Life Support reuses inherited Ring geometry and full heading metadata',()=>{
 const common=fs.readFileSync('console-common.css','utf8'),source=fs.readFileSync('console-common.js','utf8');assert.match(common,/dialog\.lock-console\.shared-console-layout[^\n]*\.shared-timeline\{grid-column:1!important;grid-row:3!important/);assert.match(common,/nth-child\(3\)\)\{overflow:auto\}/);assert.match(common,/aspect-ratio:328\/390/);assert.match(source,/heading\.setAttribute\('aria-label',heading.textContent\)/);
});

test('Nutrition preserves its scene and paste registration while sharing the bottom-left Ring',()=>{
 const source=fs.readFileSync('utility-console-ui.js','utf8');
 assert.match(source,/nutrition-console-scene.webp/);
 assert.match(css,/\.utility-console \.nut-dispenser\{[^}]*aspect-ratio:16\/9/);
 assert.match(css,/\.nut-dispenser-scene\{object-fit:contain\}/);
 assert.match(css,/left:46%;top:61\.6%;bottom:auto;width:8%;height:1\.8%/);
 assert.match(source,/clearTimeout\(pasteTimer\)/);
 assert.match(source,/if\(!dialog\.isConnected\)return/);
 assert.match(source,/blob\.setAttribute\('aria-label','Eat paste'\)/);
});

test('Cloaking, Gravity Absolution and Sensor Lure use migrated utility Ring structure',()=>{
 const utility=fs.readFileSync('utility-console-ui.js','utf8'),illusion=fs.readFileSync('illusion-droid-console.js','utf8');
 assert.match(utility,/selected\?\.definition.cloaking\|\|selected\?\.definition.gravityField/);
 assert.match(utility,/dialog.className='utility-console lock-console'/);
 assert.match(illusion,/v.className='utility-console lock-console illusion-droid-console'/);
 for(const source of[utility,illusion]){assert.match(source,/lock-chart utility-scene/);assert.match(source,/lock-controls utility-controls/);}
 for(const asset of['gravity-console-scene.webp','cloak-console-scene.webp'])assert.ok(utility.includes(asset));
 assert.match(illusion,/illusion\?'illusion':'security-droid'/);
});
