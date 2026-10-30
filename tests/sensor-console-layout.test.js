const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../console-common.css'),'utf8');
const block=css.slice(css.indexOf('/* Sensors desktop side panels:'),css.indexOf('/* Sensors approved control placement;'));
const controls=css.slice(css.indexOf('/* Sensors approved control placement;'),css.indexOf('/* Sensors ring geometry only:'));
test('Sensors alone compacts the redundant empty-crew message after rendering',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../sensor-console-ui.js'),'utf8');
 assert.match(source,/SALiveDOM\.render\(get\('\[data-rings\]'\),rings\);\s*get\('\[data-rings\]'\)\.querySelectorAll\('\.tactical-ring-empty'\)\.forEach\(empty=>\{empty\.textContent='No combatants aboard\.';\}\);/);
 const renderer=fs.readFileSync(path.join(__dirname,'../tactical-ring-renderer.js'),'utf8');
 assert.match(renderer,/No combatants loaded\./);assert.match(renderer,/No combatants are currently aboard\./);
 assert.doesNotMatch(renderer,/No combatants aboard\./);
});
test('Sensors geometry preserves canonical proportional SVG and scopes native horizontal scrolling to three or more groups',()=>{
 const ring=css.slice(css.indexOf('/* Sensors ring geometry only:'));
 assert.match(ring,/@media\(min-width:901px\)/);assert.match(ring,/aspect-ratio:328\/390/);assert.match(ring,/flex-wrap:nowrap/);assert.match(ring,/nth-child\(3\)\)\{overflow:auto\}/);assert.match(ring,/only-child/);
 const heading=ring.match(/[^{}]*\.tactical-ring-group>h3\{[^}]*\}/)?.[0];assert.ok(heading);
 assert.match(heading,/font:11px\/13px Arial!important/);assert.match(heading,/height:26px/);assert.match(heading,/-webkit-line-clamp:2/);
 assert.doesNotMatch(ring.replace(heading,''),/overflow[^;}:]*:[^;}]*(hidden|clip)|ring-slice-name|ring-core-text|text-overflow|line-clamp/);
 assert.match(ring,/grid-template-rows:26px minmax\(0,1fr\)/);
 assert.match(ring,/\.tactical-ring-view\{[^}]*container-type:size/);
 assert.match(ring,/100cqh - 2px/);
 for(const [,selector] of ring.matchAll(/([^{}]+)\{/g)){if(selector.includes('@media'))continue;assert.ok(selector.trim().startsWith('dialog.sensor-console.shared-console-layout[data-console-owner]:not(.combat-order-dialog):not(.probe-console)'),selector);}
});
test('Sensors heading overflow retains full DOM name and exposes title and accessible label',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../sensor-console-ui.js'),'utf8');
 assert.match(source,/querySelectorAll\('\.tactical-ring-group>h3'\)\.forEach\(heading=>\{\s*const fullName=heading\.textContent;heading\.title=fullName;heading\.setAttribute\('aria-label',fullName\);/);
});
test('Sensors spacing stays desktop-only and excludes compact prompts and Probe',()=>{
 assert.match(block,/@media\(min-width:901px\)/);
 const rules=[...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>!m[1].includes('@media'));
 assert.ok(rules.length>=7);
 for(const [,selectors] of rules)for(const selector of selectors.trim().split(',')){
  assert.ok(selector.trim().startsWith('dialog.sensor-console.shared-console-layout[data-console-owner]:not(.combat-order-dialog):not(.probe-console)'),selector);
 }
});
test('only approved difficulty typography changes; map and overflow remain protected',()=>{
 assert.doesNotMatch(block,/overflow\s*:\s*(hidden|clip)|font\s*:|display\s*:\s*none|\.sensor-chart|\.space-map/);
 const fontRules=[...block.matchAll(/([^{}]+)\{([^{}]*font-size[^{}]*)\}/g)];assert.equal(fontRules.length,1);assert.ok(fontRules[0][1].trim().endsWith('[data-difficulty]'));assert.match(fontRules[0][2],/font-size:14px!important/);
 assert.match(block,/\[data-common-fleet\]\{max-height:none;overflow:visible;scrollbar-gutter:auto\}/);
 assert.match(block,/\.tactical-ring-group\{padding:0!important;overflow:visible\}/);
 // The outer panels retain the existing accessible scroll owner.
 assert.match(css,/\.shared-console-layout section:not\(\.space-map\):not\(\[popover\]\)\{[^}]*overflow:auto/);
});
test('Sensors shell removes only requested decorative backings and preserves scrolling panels',()=>{
 assert.match(block,/\.tactical-ring-group\{border:0;background:transparent;box-shadow:none\}/);
 assert.match(block,/\.shared-seat\{background:transparent;border:0;box-shadow:none;padding:0\}/);
 assert.match(block,/\[data-selector\]\{[^}]*flex-wrap:nowrap/);
 assert.doesNotMatch(block,/background-image|url\(|\.sensor-reports\{[^}]*overflow:hidden/);
});

test('normal-content savings use spacing rather than smaller fonts or targets',()=>{
 assert.match(block,/\.sensor-reports article p\{margin:0\}/);
 assert.match(block,/\.sensor-reports article\{padding:2px 0\}/);
 assert.match(block,/\.console-service-panel button\{min-height:28px/);
 assert.match(block,/\.sensor-controls button\{min-height:28px/);
});

test('offline Sensors warning has an explicit chart cell and cannot create an Exit footer row',()=>{
 assert.match(block,/\.is-powered-off>section\.console-compromised\{position:relative!important;inset:auto!important;grid-column:2!important;grid-row:2!important/);
 assert.match(block,/align-self:start;margin:64px 12px 0;height:auto!important/);
});

test('Sensors surplus space expands Reports and narrows only action rows',()=>{
 assert.match(block,/height:min\(410px,calc\(100% - 88px\)\)/);
 assert.match(block,/height:max\(80px,calc\(100% - 418px\)\)/);
 assert.match(block,/grid-template-rows:max-content max-content minmax\(0,1fr\) max-content max-content max-content max-content minmax\(0,1fr\) max-content/);
 assert.match(block,/grid-template-columns:minmax\(0,1fr\) minmax\(max-content,calc\(\(100% - 34px\)\*\.67\)\) minmax\(0,1fr\);column-gap:0/);
 assert.match(block,/\[data-action-help\]\{grid-column:3;justify-self:start!important;margin-left:6px\}/);
});

test('selection reservation uses actual viewport height and leaves short views accessible',()=>{
 assert.match(block,/@media\(min-width:901px\) and \(min-height:704px\)/);
 assert.match(block,/\[data-scan-planner\]\[hidden\]\{visibility:hidden;pointer-events:none\}/);
 assert.match(block,/height:472px!important/);
 assert.match(block,/height:calc\(100% - 480px\)!important/);
 assert.match(block,/\.shared-power>\[data-common-power-note\]\{grid-row:7\}/);
});

test('enlarged Sensors owns a footer rather than inheriting the normal Tactical Ring row',()=>{
 assert.match(block,/:not\(\.map-focus\)\{grid-template-rows:64px/);
 assert.match(block,/\.map-focus\{grid-template-rows:64px minmax\(0,1fr\) 72px!important/);
 assert.match(block,/\.map-focus \.sensor-controls\{grid-row:2!important;align-self:stretch;height:100%!important/);
 assert.doesNotMatch(block,/\[data-leave\]/);
});

test('live Sensors readout retains approved identification thumbnail and operational information',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../sensor-console-ui.js'),'utf8');
 const readout=source.match(/<div class="sensor-readout">([\s\S]*?)<\/section>/)?.[1];
 assert.ok(readout,'live readout exists');
 assert.match(readout,/^<img src="\$\{initial\.item\.type\}-card\.png" alt="\$\{esc\(initial\.definition\.name\)\}">/);
 assert.equal((readout.match(/<img\b/g)||[]).length,1,'one small identification thumbnail');
 assert.match(readout,/<h3>\$\{esc\(initial\.definition\.name\)\}<\/h3>/);
 for(const attribute of ['data-dice','data-factors','data-input','data-input-text'])assert.ok(readout.includes(attribute),attribute);
 assert.match(readout,/aria-label="Sensor input"/);
});

test('Sensors control refinement reuses focus control and removes only movement shortcut',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../sensor-console-ui.js'),'utf8');
 assert.doesNotMatch(source,/data-leave|openMove/);
 assert.match(source,/mapfocuschange/);assert.match(source,/get\('\.sensor-chart>h3'\):zoom\)\.append\(get\('\[data-map-focus\]'\)\)/);
 assert.match(controls,/\.shared-seat\{justify-content:center\}/);
 assert.match(controls,/\[data-hold\]:not\(\.resume-ready\)\{background:linear-gradient/);
 assert.match(controls,/\[data-hold\]:focus-visible\{outline:2px solid #fff;outline-offset:-4px\}/);
 assert.match(controls,/left:50%;bottom:0;transform:translateX\(-50%\);height:34px/);
 assert.match(controls,/\[data-confirm-scan\]:not\(:disabled\)\{background:#216b40/);
 assert.doesNotMatch(controls,/overflow|grid-template|font-size|data-leave/);
 for(const [,selectors]of controls.matchAll(/([^{}]+)\{[^{}]*\}/g))if(!selectors.includes('@media'))for(const selector of selectors.trim().split(','))assert.ok(selector.startsWith('dialog.sensor-console.shared-console-layout[data-console-owner]:not(.combat-order-dialog):not(.probe-console)'),selector);
});
