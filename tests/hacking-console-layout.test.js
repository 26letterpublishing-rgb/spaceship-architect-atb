const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('Hacking-only Ring migration preserves service overflow and expands Password board',()=>{
 const css=fs.readFileSync('console-common.css','utf8').split('/* Hacking only:')[1].split('/* End Hacking ring layout. */')[0].split('*/').slice(1).join('*/');
 const selectors=[...css.matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@'));
 assert.ok(selectors.length>10);for(const s of selectors)assert.ok(s.startsWith('dialog.hacking-console.shared-console-layout[data-console-owner]:not(.combat-order-dialog)'),s);
 assert.match(css,/\.shared-power\{grid-row:2!important\}/);assert.match(css,/\.hacking-board\{grid-row:2\/4!important\}/);
 assert.match(css,/\.shared-timeline\{grid-column:1!important;grid-row:3!important/);
 assert.match(css,/:has\(>\.tactical-ring-group:nth-child\(3\)\)\{overflow:auto\}/);
 assert.match(css,/grid-template-rows:26px minmax\(0,1fr\)/);assert.match(css,/aspect-ratio:328\/390/);
 assert.doesNotMatch(css,/\.(shared-power|hacking-board|hacking-targets)\{[^}]*overflow:hidden/);
});
test('Hacking ship headings expose full names without modifying crew labels',()=>{
 const js=fs.readFileSync('console-common.js','utf8');assert.match(js,/if\(view.classList.contains\('hacking-console'\)\)rings.querySelectorAll\('\.tactical-ring-group>h3'\)\.forEach\(heading=>\{heading.title=heading.textContent;heading.setAttribute\('aria-label',heading.textContent\);\}\)/);
 const css=fs.readFileSync('console-common.css','utf8').split('/* End Hacking ring layout. */')[0];assert.match(css,/font:11px\/13px Arial!important;height:26px/);assert.match(css,/-webkit-line-clamp:2/);
});
