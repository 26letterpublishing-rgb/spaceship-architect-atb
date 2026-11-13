const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('utility-console.css','utf8');

function lifeImageLayout(source){
 const startMarker='/* Life Support only: unobscured machine image above live instruments. */';
 const endMarker='/* Life Support report only; preserve the existing panel and log scrolling. */';
 const start=source.indexOf(startMarker),end=source.indexOf(endMarker);
 assert.ok(start>=0,'Life Support image-layout start marker is missing');
 assert.ok(end>=0,'Life Support image-layout end marker is missing');
 assert.equal(source.lastIndexOf(startMarker),start,'Life Support image-layout start marker is duplicated');
 assert.equal(source.lastIndexOf(endMarker),end,'Life Support image-layout end marker is duplicated');
 assert.ok(end>start+startMarker.length,'Life Support image-layout markers are reversed or empty');
 const block=source.slice(start+startMarker.length,end);
 assert.ok(block.trim(),'Life Support image-layout block is empty');
 return block;
}

test('Life Support image-layout boundaries reject missing, reversed and duplicate markers',()=>{
 const start='/* Life Support only: unobscured machine image above live instruments. */',end='/* Life Support report only; preserve the existing panel and log scrolling. */';
 assert.throws(()=>lifeImageLayout(css.replace(start,'')),/start marker is missing/);
 assert.throws(()=>lifeImageLayout(css.replace(end,'')),/end marker is missing/);
 assert.throws(()=>lifeImageLayout(end+' body '+start),/reversed or empty/);
 assert.throws(()=>lifeImageLayout(start+end),/reversed or empty/);
 assert.throws(()=>lifeImageLayout(start+' \n'+end),/block is empty/);
 assert.throws(()=>lifeImageLayout(start+css),/start marker is duplicated/);
 assert.throws(()=>lifeImageLayout(css+end),/end marker is duplicated/);
});

test('Life Support control labels and raised switches are family scoped and preserve native controls',()=>{
 const block=css.split('/* Life Support controls:')[1].split('/* Life Support only:')[0];
 for(const selector of [...block.matchAll(/([^{}]+)\{/g)].map(m=>m[1].split('*/').pop().trim()))assert(selector.startsWith('body dialog.utility-console:has(.life-machine)'),selector);
 assert.match(block,/font-size:18px/);assert.match(block,/width:85px;min-width:85px;max-width:85px;height:47\.6px/);assert.match(block,/flex-direction:column/);assert.match(block,/translateX\(37\.4px\)/);
 const source=fs.readFileSync('utility-console-ui.js','utf8');for(const control of ['data-gravity','data-oxygen'])assert(source.includes(control+' type="checkbox" role="switch"'));
});
test('Life Support alone places live instruments below the unchanged machine image',()=>{
 const block=lifeImageLayout(css);assert.ok(block,'Life Support layout block');
 const selectors=[...block.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>=4);for(const s of selectors)assert.ok(s.startsWith('dialog.utility-console:has(.life-machine)'),s);
 assert.match(block,/@media\(min-width:901px\)/);assert.match(block,/\.life-machine>img\{[^}]*position:static[^}]*object-fit:contain/);assert.match(block,/\.life-instruments\{[^}]*position:static[^}]*grid-row:2/);assert.match(block,/\.gravity-chamber\{[^}]*grid-row:2/);
 assert.doesNotMatch(block,/display:none|visibility:hidden|font-size:|font:|url\(|animation:/);
});
test('Life Support removes only instrument backing and retains accessible content overflow',()=>{
 const block=lifeImageLayout(css);assert.match(block,/\.life-instruments\{[^}]*background:transparent[^}]*border:0[^}]*overflow:visible/);assert.match(block,/\.utility-scene\{[^}]*overflow:auto!important/);assert.match(block,/grid-template-rows:minmax\(96px,1fr\) auto/);
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

test('Nutrition fills its artwork viewport proportionally without separating paste or leaking resize observers',()=>{
 const source=fs.readFileSync('utility-console-ui.js','utf8');
 assert.match(source,/viewport\.append\(dispenser\)/);
 assert.match(source,/Math\.max\(width\/16,height\/9\)/);
 assert.match(source,/sceneObserver\?\.disconnect\(\)/);
 assert.match(css,/\.nut-scene-viewport\{[^}]*overflow:hidden/);
 assert.match(css,/\.nut-scene-viewport \.nut-dispenser\{[^}]*transform:translate\(-50%,-50%\)/);
 assert.match(css,/:has\(\.nut-scene-viewport\) \.utility-scene\{[^}]*grid-template-rows:minmax\(0,1fr\) auto/);
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
