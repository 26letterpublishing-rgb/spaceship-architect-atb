const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const css=fs.readFileSync('console-common.css','utf8'),block=css.split('/* Shields only: bottom-left timeline, expanded existing Field Integrity. */')[1].split('/* End Shields ring layout. */')[0];
test('Shields geometry opt-in preserves other Console families and accessible maintenance overflow',()=>{
 const selectors=[...block.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>10);for(const s of selectors)assert.ok(s.startsWith('dialog.shield-console-dialog.shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(block,/@media\(min-width:901px\)/);assert.match(block,/\.shared-power\{grid-row:2!important\}/);assert.match(block,/\.shield-field\{grid-row:2\/4!important\}/);assert.match(block,/\.shield-timeline\{grid-column:1!important;grid-row:3!important/);assert.doesNotMatch(block,/\.shared-power\{[^}]*overflow:hidden/);
});
test('Shields keeps proportional canonical rings and only 3+ horizontal scrolling',()=>{
 assert.match(block,/flex-wrap:nowrap/);assert.match(block,/nth-child\(3\)\)\{overflow:auto\}/);assert.match(block,/only-child\{[^}]*--shield-ring-width:160px/);assert.match(block,/--shield-ring-width:140px/);assert.match(block,/aspect-ratio:328\/390/);assert.match(block,/grid-template-rows:26px minmax\(0,1fr\)/);assert.match(block,/font:11px\/13px Arial!important;height:26px/);assert.match(block,/-webkit-line-clamp:2/);assert.doesNotMatch(block,/transform:|font-size:0|visibility:hidden/);
});
test('Shields headings retain complete accessible identity in the existing owned redraw',()=>{
 const source=fs.readFileSync('shield-console-ui.js','utf8');assert.match(source,/SALiveDOM\.render\(get\('\[data-rings\]'\),rings\);get\('\[data-rings\]'\)\.querySelectorAll\('\.tactical-ring-group>h3'\)\.forEach\(heading=>\{heading.title=heading.textContent;heading.setAttribute\('aria-label',heading.textContent\);\}\);lastRings=rings/);
 assert.match(source,/const rings=bridge.pilotRings\(\)/);assert.match(source,/clearInterval\(timer\)/);
});
