const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Lock-On inline SVG sizing override is scoped to the full Console',()=>{
 const css=fs.readFileSync('console-common.css','utf8');
 assert.match(css,/dialog\.lock-console\.shared-console-layout:not\(\.combat-order-dialog\) \.lock-scope \.space-map svg\{height:100%;min-height:0;max-height:100%\}/);
 // The historical shared rule remains; other consumers have not been globally resized.
 assert.match(fs.readFileSync('ship-pass2.css','utf8'),/\.lock-scope \.space-map svg\{height:270px;width:100%\}/);
});
test('Lock-On timeline relocation and ring sizing stay opt-in with usable overflow',()=>{
 const css=fs.readFileSync('console-common.css','utf8').split('/* Lock-On only: bottom-left timeline, full-height central target map. */')[1].split('/* End Lock-On ring layout. */')[0];
 assert.ok(css,'Lock-On layout block exists');
 assert.match(css,/@media\(min-width:901px\)/);
 const selectors=[...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>10);
 for(const selector of selectors)assert.ok(selector.startsWith('dialog.lock-console.shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),selector);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);
 assert.match(css,/\.lock-chart\{grid-row:2\/4!important\}/);
 assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);
 assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.match(css,/aspect-ratio:328\/390/);
 assert.doesNotMatch(css,/\.shared-power\{[^}]*overflow:hidden/);
});
test('Lock-On headings retain full accessible names without changing canonical crew renderer',()=>{
 const source=fs.readFileSync('console-common.js','utf8');
 assert.match(source,/if\(view.classList.contains\('lock-console'\)\)rings.querySelectorAll\('\.tactical-ring-group>h3'\)\.forEach\(heading=>\{heading.title=heading.textContent;heading.setAttribute\('aria-label',heading.textContent\);\}\)/);
 const css=fs.readFileSync('console-common.css','utf8').split('/* Lock-On only:')[1];
 assert.match(css,/font:11px\/13px Arial!important;height:26px/);
 assert.match(css,/-webkit-line-clamp:2/);
 assert.match(css,/\.tactical-ring-svg\{width:100%!important;height:100%!important/);
});
