const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../space-map.js'),'utf8');
const c={};vm.runInNewContext(source.slice(source.indexOf('  function affiliation('),source.indexOf('  function bindCallouts(')),c);
test('callouts use only projected affiliation, with unknown knowledge taking precedence',()=>{
 assert.equal(c.affiliation({controlType:'pc'}),'ALLY');assert.equal(c.affiliation({controlType:'gm'}),'HOSTILE');assert.equal(c.affiliation({}),'UNKNOWN');
 for(const hidden of [{uncertainty:1},{contactLevel:'unknown'},{contactLevel:'last-known'},{gmContactMarker:true}])assert.equal(c.affiliation({controlType:'gm',...hidden}),'UNKNOWN');
 assert.equal(c.affiliation({id:'target',controlType:'gm'},{id:'own',sensorState:{contacts:{}}}),'UNKNOWN');
 assert.equal(c.affiliation({id:'target',controlType:'gm'},{id:'own',sensorState:{contacts:{target:{level:'detected'}}}}),'HOSTILE');
});
test('leader shape and label colors are present, objects have no ship affiliation',()=>{
 for(const [controlType,label,color] of [['pc','ALLY','#ffe277'],['gm','HOSTILE','#ff656d'],[undefined,'UNKNOWN','#be8cff']]){const html=c.calloutMarkup({controlType});assert.ok(html.includes(label));assert.ok(html.includes(color));assert.ok(html.includes('M.6 .5 L1.6 1.5 H5'));assert.ok(html.includes('pointer-events="none"'));}
 for(const flag of ['spaceObject','isDrone','isProbe','isMissile'])assert.equal(c.calloutMarkup({[flag]:true}),'');
});

test('callout switch reuses shared interior visual rules and native accessible state',()=>{const css=fs.readFileSync(require.resolve('../space-map.css'),'utf8');assert.match(source,/role="switch" data-ship-callouts-toggle/);assert.match(source,/button.checked=showCallouts/);assert.match(source,/button.onchange=/);assert.ok(css.includes('.expanded-interior-dialog .inline-map-view-controls,.ship-callout-switch'));assert.ok(!css.includes('[data-ship-callouts-toggle][aria-pressed'));});
